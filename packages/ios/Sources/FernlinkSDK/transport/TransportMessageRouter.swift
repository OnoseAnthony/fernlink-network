import Foundation

/// Transport-agnostic message router. Mirrors TransportMessageRouter.kt on Android.
///
/// Works against any FernlinkTransport — BLE, Multipeer Connectivity, etc.
/// The routing logic (verify → sign → proof, multi-hop forward, proof collection)
/// is identical regardless of the underlying radio.
final class TransportMessageRouter {

    private let transport:  FernlinkTransport
    private let keypair:    FernlinkKeypair
    private let rpc:        SolanaRpc
    private let proofStore: ProofStore

    private let proofsLock   = NSLock()
    private var collectedProofs: [VerificationProof] = []

    init(
        transport:   FernlinkTransport,
        keypair:     FernlinkKeypair,
        rpcEndpoint: String,
        proofStore:  ProofStore
    ) {
        self.transport  = transport
        self.keypair    = keypair
        self.rpc        = SolanaRpc(rpcEndpoint)
        self.proofStore = proofStore
    }

    func start() {
        transport.onIncomingRequest = { [weak self] data in
            self?.handleIncomingRequest(data)
        }
        transport.onIncomingProof = { [weak self] data in
            self?.handleIncomingProof(data)
        }
    }

    func clearProofs() { proofsLock.withLock { collectedProofs = [] } }

    func collectedProofsList() -> [VerificationProof] {
        proofsLock.withLock { collectedProofs }
    }

    func broadcastRequest(txSignature: String, commitment: String, ttl: Int) {
        if transport.connectedPeerCount == 0 {
            proofStore.enqueue(.init(txSignature: txSignature, commitment: commitment, ttl: ttl))
            return
        }
        sendRequest(txSignature: txSignature, commitment: commitment, ttl: ttl)
    }

    // MARK: - Private

    private func handleIncomingRequest(_ data: Data) {
        Task {
            guard let json = try? JSONDecoder().decode(VerificationRequest.self, from: data) else { return }
            do {
                let status = try await rpc.getSignatureStatus(json.txSignature)
                let proof  = try keypair.signProof(
                    txSignature: json.txSignature,
                    status:      status.status,
                    slot:        status.slot,
                    blockTime:   status.blockTime,
                    errorCode:   0
                )
                if let proofData = try? JSONEncoder().encode(proof) {
                    transport.sendProof(proofData)
                }
            } catch {
                if json.ttl > 0 {
                    sendRequest(txSignature: json.txSignature, commitment: json.commitment, ttl: json.ttl - 1)
                }
            }
        }
    }

    private func handleIncomingProof(_ data: Data) {
        guard let proof = try? JSONDecoder().decode(VerificationProof.self, from: data),
              verifyProof(proof)
        else { return }
        proofsLock.withLock { collectedProofs.append(proof) }
        transport.sendProof(data)
    }

    private func sendRequest(txSignature: String, commitment: String, ttl: Int) {
        let req = VerificationRequest(txSignature: txSignature, commitment: commitment, ttl: ttl)
        guard let data = try? JSONEncoder().encode(req) else { return }
        transport.sendRequest(data)
    }
}
