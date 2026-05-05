import Foundation

public enum TransportType: Int {
    case ble         = 10
    case multipeer   = 20
    case nfcBootstrap = 0

    var priority: Int { rawValue }
}

/// Common protocol for all Fernlink transport layers (BLE, Multipeer, etc.).
///
/// TransportMessageRouter subscribes to incoming data via the two callbacks,
/// and sends outbound data via sendProof / sendRequest.
protocol FernlinkTransport: AnyObject {
    var transportType: TransportType { get }
    var connectedPeerCount: Int { get }

    /// Called by TransportMessageRouter when a full request payload is received.
    var onIncomingRequest: ((Data) -> Void)? { get set }
    /// Called by TransportMessageRouter when a full proof payload is received.
    var onIncomingProof: ((Data) -> Void)? { get set }

    func start()
    func stop()

    /// Send a signed proof to all connected peers.
    func sendProof(_ data: Data)
    /// Send a verification request to all connected peers.
    func sendRequest(_ data: Data)
}
