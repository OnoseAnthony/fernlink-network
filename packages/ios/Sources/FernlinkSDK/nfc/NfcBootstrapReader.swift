import CoreBluetooth
import CoreNFC
import Foundation

/// iOS NFC bootstrap reader.
///
/// An iPhone can READ an NFC bootstrap record emitted by an Android device's
/// Host Card Emulation (HCE) service. On successful tap, the Android peer's
/// BLE public key is extracted and the callback fires — allowing the app to
/// display UI and call CentralManager.connectDirect() to skip BLE scanning.
///
/// Limitations:
/// - iOS cannot EMIT NFC to be read by Android (no HCE on iOS).
///   This is one-directional: iPhone reads Android.
/// - For iPhone↔iPhone pairing use Multipeer Connectivity instead;
///   MCF handles discovery automatically without NFC.
/// - Requires iPhone 7+ (iOS 11+).
/// - The app must declare NFCReaderUsageDescription in Info.plist.
///
/// Usage:
/// ```swift
/// let reader = client.createNfcBootstrapReader { peerPubKey, bleAddress in
///     print("Tapped Android peer: \(peerPubKey)")
/// }
/// // Trigger from a button (must be called from a user interaction):
/// reader.beginReading()
/// ```
@available(iOS 13.0, *)
public final class NfcBootstrapReader: NSObject {

    private let onBootstrapReceived: (String, String?) -> Void
    private var session: NFCNDEFReaderSession?

    private static let mimeType = "application/x-fernlink-bootstrap"

    init(onBootstrapReceived: @escaping (String, String?) -> Void) {
        self.onBootstrapReceived = onBootstrapReceived
    }

    /// Start an NFC reader session. Must be called from a user interaction (button tap).
    public func beginReading() {
        guard NFCNDEFReaderSession.readingAvailable else { return }
        let s = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
        s.alertMessage = "Hold your phone near the Android device to pair."
        s.begin()
        session = s
    }
}

@available(iOS 13.0, *)
extension NfcBootstrapReader: NFCNDEFReaderSessionDelegate {

    public func readerSession(_ session: NFCNDEFReaderSession,
                              didDetectNDEFs messages: [NFCNDEFMessage]) {
        for message in messages {
            for record in message.records {
                guard record.typeNameFormat == .media,
                      let mimeString = String(data: record.type, encoding: .utf8),
                      mimeString == Self.mimeType,
                      let payload = String(data: record.payload, encoding: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: record.payload) as? [String: Any],
                      let pubKey = json["pk"] as? String
                else { continue }

                let bleAddress = json["mac"] as? String
                DispatchQueue.main.async {
                    self.onBootstrapReceived(pubKey, bleAddress)
                }
                return
            }
        }
    }

    public func readerSession(_ session: NFCNDEFReaderSession,
                              didInvalidateWithError error: Error) {}
}
