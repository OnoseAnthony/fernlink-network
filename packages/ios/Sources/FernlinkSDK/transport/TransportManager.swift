import Foundation

/// Convenience wrapper that starts all available Fernlink transports.
///
/// Creates and manages both BLE and Multipeer Connectivity (Apple-to-Apple)
/// transports under a single lifecycle. For most apps this is the only
/// transport-management code you need:
///
/// ```swift
/// let manager = TransportManager()
/// manager.start()
/// let result = try await manager.client.verifyTransaction("5VER…")
/// manager.stop()
/// ```
///
/// You can still call `client.attachTransport(_:)` to plug in additional
/// custom transports after calling `start()`.
public final class TransportManager {

    /// The underlying FernlinkClient used for mesh verification.
    public let client: FernlinkClient

    public init(config: FernlinkClientConfig = FernlinkClientConfig()) {
        self.client = FernlinkClient(config: config)
    }

    /// Boot the client and attach all transports.
    /// - BLE: enabled on all devices (Apple ↔ Android + Apple ↔ Apple)
    /// - Multipeer Connectivity: enabled for high-bandwidth Apple-to-Apple links
    public func start() {
        client.start()
        client.startMesh()                // BLE transport
        client.attachMultipeerTransport() // MCF transport (priority 20)
    }

    /// Stop all transports and shut down the client.
    public func stop() {
        client.stopMesh()
    }

    /// Total connected peers across all active transports.
    public var connectedPeerCount: Int {
        client.connectedPeerCount
    }

    /// Verify a Solana transaction through the best available transport.
    public func verifyTransaction(
        _ txSignature: String,
        commitment:    Commitment = .confirmed,
        timeoutMs:     Int        = 15_000
    ) async throws -> ConsensusResult {
        try await client.verifyTransaction(
            txSignature,
            commitment: commitment,
            timeoutMs:  timeoutMs
        )
    }
}
