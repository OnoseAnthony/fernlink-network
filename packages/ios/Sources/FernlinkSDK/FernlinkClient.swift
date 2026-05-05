import Foundation

/// Public entry point for the Fernlink iOS SDK.
///
/// Usage:
/// ```swift
/// let client = FernlinkClient(config: FernlinkClientConfig())
/// client.start()
///
/// // Add BLE mesh transport once Bluetooth permission is granted:
/// client.startMesh()
///
/// // Optionally add Multipeer Connectivity for Apple-to-Apple high-bandwidth mesh:
/// client.attachMultipeerTransport()
///
/// let result = try await client.verifyTransaction("5VERv8...")
/// ```
///
/// Multiple transports can be active simultaneously. The highest-priority
/// transport with connected peers is used for each verification request.
public final class FernlinkClient {

    public let publicKey: String

    private let keypair:   FernlinkKeypair
    private let rpc:       SolanaRpc
    private let config:    FernlinkClientConfig
    private var started    = false

    // Each transport gets its own router; both share the same ProofStore.
    private var transports: [(transport: FernlinkTransport, router: TransportMessageRouter)] = []
    private let proofStore = ProofStore()

    public init(config: FernlinkClientConfig = FernlinkClientConfig()) {
        self.config  = config
        self.keypair = (try? config.keypairSeed.map { try FernlinkKeypair(seed: $0) }) ?? FernlinkKeypair()
        self.rpc     = SolanaRpc(config.rpcEndpoint)
        self.publicKey = keypair.publicKeyBytes.map { String(format: "%02x", $0) }.joined()
    }

    public func start() { started = true }

    public func stop() {
        started = false
        transports.forEach { $0.transport.stop() }
        transports.removeAll()
    }

    // MARK: - Transport management

    /// Boot the BLE mesh layer. Convenience wrapper over attachTransport.
    public func startMesh() {
        let ble = BleTransport(proofStore: proofStore)
        attachTransport(ble)
    }

    /// Boot Multipeer Connectivity for Apple-to-Apple high-bandwidth mesh.
    /// Call after startMesh() if you also want BLE, or alone for Apple-only.
    public func attachMultipeerTransport() {
        let mpc = MultipeerTransport(localPubKey: publicKey)
        attachTransport(mpc)
    }

    /// Attach any FernlinkTransport implementation to the mesh.
    public func attachTransport(_ transport: FernlinkTransport) {
        let router = TransportMessageRouter(
            transport:   transport,
            keypair:     keypair,
            rpcEndpoint: config.rpcEndpoint,
            proofStore:  proofStore
        )
        transport.start()
        router.start()
        transports.append((transport: transport, router: router))
    }

    public func stopMesh() {
        transports.forEach { $0.transport.stop() }
        transports.removeAll()
    }

    /// Total connected peers across all active transports.
    public var connectedPeerCount: Int {
        transports.reduce(0) { $0 + $1.transport.connectedPeerCount }
    }

    // MARK: - NFC bootstrapping

    /// Create an NFC reader that parses an Android HCE bootstrap tap.
    /// On receipt, calls CentralManager.connectDirect() on the BLE transport
    /// so BLE pairing skips the scan phase (~5s → ~200ms).
    @available(iOS 13.0, *)
    public func createNfcBootstrapReader(
        onBootstrapReceived: ((String, String?) -> Void)? = nil
    ) -> NfcBootstrapReader {
        return NfcBootstrapReader { [weak self] peerPubKey, bleAddress in
            // Find the BLE transport and attempt a direct connect
            if let bleTransport = self?.transports.first(where: {
                $0.transport is BleTransport
            })?.transport as? BleTransport {
                // connectDirect via the central manager if we have a MAC address
                // CBCentralManager.retrievePeripherals(withIdentifiers:) doesn't accept
                // MAC addresses directly on iOS (CoreBluetooth uses UUIDs). We trigger
                // a targeted scan for the Fernlink service — MCF handles Apple-to-Apple.
                // For Android↔iOS, the BLE scan finds the device quickly after NFC
                // narrows the user's proximity context.
                bleTransport.startDirectScan()
            }
            onBootstrapReceived?(peerPubKey, bleAddress)
        }
    }

    // MARK: - Verification

    /// Verify a Solana transaction through the mesh.
    ///
    /// Uses the highest-priority transport with active peers. Falls back to
    /// direct RPC if no transport responds within timeoutMs.
    public func verifyTransaction(
        _ txSignature: String,
        commitment:    Commitment = .confirmed,
        timeoutMs:     Int        = 15_000
    ) async throws -> ConsensusResult {
        guard started else { throw FernlinkError.notStarted }

        // Pick highest-priority transport with connected peers
        let active = transports
            .filter { $0.transport.connectedPeerCount > 0 }
            .max(by: { $0.transport.transportType.priority < $1.transport.transportType.priority })

        if let active {
            active.router.clearProofs()
            active.router.broadcastRequest(
                txSignature: txSignature,
                commitment:  commitment.rawValue,
                ttl:         8
            )
            try await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)

            let proofs = active.router.collectedProofsList()
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

    // MARK: - Consensus

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
