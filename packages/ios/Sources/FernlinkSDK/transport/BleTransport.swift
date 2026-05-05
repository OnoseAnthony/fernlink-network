import Foundation

/// Wraps FernlinkPeripheralManager + FernlinkCentralManager into a single
/// FernlinkTransport, making the BLE layer interchangeable with other transports.
final class BleTransport: FernlinkTransport {

    let transportType: TransportType = .ble

    var onIncomingRequest: ((Data) -> Void)?
    var onIncomingProof: ((Data) -> Void)?

    private let peripheral: FernlinkPeripheralManager
    private let central: FernlinkCentralManager

    init(proofStore: ProofStore) {
        peripheral = FernlinkPeripheralManager()
        central    = FernlinkCentralManager(proofStore: proofStore)
    }

    var connectedPeerCount: Int { central.connectedPeerCount }

    func start() {
        peripheral.onRequest = { [weak self] data in self?.onIncomingRequest?(data) }
        central.onProof      = { [weak self] data in self?.onIncomingProof?(data) }
        peripheral.start()
        central.startScanning()
    }

    func stop() {
        peripheral.stop()
        central.stop()
    }

    func sendProof(_ data: Data) {
        peripheral.sendProof(data)
    }

    func sendRequest(_ data: Data) {
        central.sendRequest(data)
    }

    /// Trigger an immediate BLE scan after NFC tap — no change in logic,
    /// but signals the transport to re-scan with low-latency settings.
    func startDirectScan() {
        central.startScanning()
    }
}
