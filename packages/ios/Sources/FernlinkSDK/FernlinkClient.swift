import Foundation

/// Public entry point for the Fernlink iOS SDK.
///
/// Usage:
/// ```swift
/// let client = FernlinkClient(rpcEndpoint: "https://api.mainnet-beta.solana.com")
/// client.start()
///
/// // From UIApplication / your AppDelegate once the BLE service binds:
/// client.startMesh()
///
/// let result = try await client.verifyTransaction("5VERv8...")
/// ```
public final class FernlinkClient {

    public let publicKey: String

    private let keypair:     FernlinkKeypair
    private let rpc:         SolanaRpc
    private let config:      FernlinkClientConfig
    private var proofStore:  ProofStore?
    private var peripheral:  FernlinkPeripheralManager?
    private var central:     FernlinkCentralManager?
    private var router:      MessageRouter?
    private var started      = false
    private var meshStarted  = false

    public init(config: FernlinkClientConfig = FernlinkClientConfig()) {
        self.config  = config
        self.keypair = (try? config.keypairSeed.map { try FernlinkKeypair(seed: $0) }) ?? FernlinkKeypair()
        self.rpc     = SolanaRpc(config.rpcEndpoint)
        self.publicKey = keypair.publicKeyBytes.map { String(format: "%02x", $0) }.joined()
    }

    public func start() { started = true }

    public func stop() {
        started = false
        stopMesh()
    }

    /// Boot the BLE mesh layer. Call this once Bluetooth permission is granted.
    public func startMesh() {
        guard !meshStarted else { return }
        let store      = ProofStore()
        let peripheral = FernlinkPeripheralManager()
        let central    = FernlinkCentralManager(proofStore: store)
        let router     = MessageRouter(
            peripheral:  peripheral,
            central:     central,
            keypair:     keypair,
            rpcEndpoint: config.rpcEndpoint,
            proofStore:  store
        )
        self.proofStore = store
        self.peripheral = peripheral
        self.central    = central
        self.router     = router

        peripheral.start()
        central.startScanning()
        router.start()
        meshStarted = true
    }

    public func stopMesh() {
        peripheral?.stop()
        central?.stop()
        meshStarted = false
    }

    public var connectedPeerCount: Int { central?.connectedPeerCount ?? 0 }

    /// Verify a Solana transaction through the mesh.
    ///
    /// Broadcasts to BLE peers, waits up to `timeoutMs` for proofs,
    /// applies consensus, then falls back to direct RPC if needed.
    public func verifyTransaction(
        _ txSignature: String,
        commitment:    Commitment = .confirmed,
        timeoutMs:     Int        = 15_000
    ) async throws -> ConsensusResult {
        guard started else { throw FernlinkError.notStarted }

        if meshStarted, let router, (central?.connectedPeerCount ?? 0) > 0 {
            router.clearProofs()
            router.broadcastRequest(txSignature: txSignature, commitment: commitment.rawValue, ttl: 8)

            try await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)

            let proofs = router.collectedProofsList()
            if let result = consensus(proofs: proofs, minProofs: config.minProofs) {
                return result
            }
        }

        // Direct RPC fallback
        let status = try await rpc.getSignatureStatus(txSignature)
        let proof  = try keypair.signProof(
            txSignature: txSignature,
            status:      status.status,
            slot:        status.slot,
            blockTime:   status.blockTime,
            errorCode:   0
        )
        return ConsensusResult(settled: true, status: proof.status,
                               slot: proof.slot, blockTime: proof.blockTime, proofCount: 1)
    }

    // MARK: - Consensus (mirrors fernlink-core consensus.rs rules)

    private func consensus(proofs: [VerificationProof], minProofs: Int) -> ConsensusResult? {
        if proofs.isEmpty { return nil }

        var tally: [(key: (TxStatus, UInt64), count: Int, blockTime: UInt64)] = []
        for proof in proofs {
            let key = (proof.status, proof.slot)
            if let i = tally.firstIndex(where: { $0.key == key }) {
                tally[i].count += 1
            } else {
                tally.append((key: key, count: 1, blockTime: proof.blockTime))
            }
        }
        guard let best = tally.max(by: { $0.count < $1.count }),
              best.count >= minProofs
        else { return nil }

        return ConsensusResult(settled: true, status: best.key.0,
                               slot: best.key.1, blockTime: best.blockTime, proofCount: best.count)
    }
}

public struct FernlinkClientConfig {
    public var rpcEndpoint: String
    public var keypairSeed: Data?
    public var minProofs:   Int

    public init(
        rpcEndpoint: String = "https://api.mainnet-beta.solana.com",
        keypairSeed: Data?  = nil,
        minProofs:   Int    = 2
    ) {
        self.rpcEndpoint = rpcEndpoint
        self.keypairSeed = keypairSeed
        self.minProofs   = minProofs
    }
}
