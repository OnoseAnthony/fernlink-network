import Foundation

/// Store-and-forward buffer for outbound verification requests.
/// Queues requests when no BLE peers are reachable; drained on reconnect.
final class ProofStore {
    struct PendingRequest {
        let txSignature: String
        let commitment:  String
        let ttl:         Int
    }

    private let lock  = NSLock()
    private var queue = [PendingRequest]()
    private let cap   = 64

    var isEmpty: Bool { lock.withLock { queue.isEmpty } }
    var count:   Int  { lock.withLock { queue.count } }

    func enqueue(_ req: PendingRequest) {
        lock.withLock { if queue.count < cap { queue.append(req) } }
    }

    func drain() -> [PendingRequest] {
        lock.withLock {
            let all = queue
            queue = []
            return all
        }
    }

    func clear() { lock.withLock { queue = [] } }
}
