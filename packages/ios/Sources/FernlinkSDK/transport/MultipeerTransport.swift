import Foundation
import MultipeerConnectivity
#if canImport(UIKit)
import UIKit
#endif

/// Fernlink transport over Apple's Multipeer Connectivity Framework.
///
/// MCF automatically selects the best available radio — peer-to-peer WiFi,
/// Bluetooth, or infrastructure WiFi — for Apple-to-Apple communication.
/// Range and throughput far exceed BLE when peer-to-peer WiFi is available.
///
/// Limitations:
/// - Apple devices only (iOS ↔ iOS, iOS ↔ macOS). Android peers require BLE.
/// - Must run with the app in the foreground for reliable discovery.
///
/// GO election equivalent: MCF handles session negotiation internally;
/// no manual Group Owner assignment is needed.
public final class MultipeerTransport: NSObject, FernlinkTransport {

    public let transportType: TransportType = .multipeer

    public var onIncomingRequest: ((Data) -> Void)?
    public var onIncomingProof:   ((Data) -> Void)?

    public var connectedPeerCount: Int { session.connectedPeers.count }

    private let serviceType = "fernlink"      // max 15 chars, alphanumeric + hyphens
    private let localPeer:   MCPeerID
    private let session:     MCSession
    private var advertiser:  MCNearbyServiceAdvertiser?
    private var browser:     MCNearbyServiceBrowser?

    // Discovery info carries the local public key so peers can identify us
    // before accepting the session invitation.
    private let localPubKey: String

    public init(localPubKey: String) {
        self.localPubKey = localPubKey
        #if canImport(UIKit)
        let deviceName = UIDevice.current.name
        #else
        let deviceName = Host.current().localizedName ?? ProcessInfo.processInfo.hostName
        #endif
        self.localPeer   = MCPeerID(displayName: deviceName)
        self.session     = MCSession(peer: localPeer, securityIdentity: nil,
                                     encryptionPreference: .required)
        super.init()
        session.delegate = self
    }

    // MARK: - FernlinkTransport

    public func start() {
        let discoveryInfo = ["pk": localPubKey, "v": "1"]
        advertiser = MCNearbyServiceAdvertiser(peer: localPeer,
                                               discoveryInfo: discoveryInfo,
                                               serviceType: serviceType)
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()

        browser = MCNearbyServiceBrowser(peer: localPeer, serviceType: serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()
    }

    public func stop() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session.disconnect()
        advertiser = nil
        browser    = nil
    }

    public func sendProof(_ data: Data) {
        sendToAll(typeTag: 0x02, payload: data)
    }

    public func sendRequest(_ data: Data) {
        sendToAll(typeTag: 0x01, payload: data)
    }

    // MARK: - Private

    private func sendToAll(typeTag: UInt8, payload: Data) {
        guard !session.connectedPeers.isEmpty else { return }
        var frame = Data([typeTag])
        var len = UInt32(payload.count).bigEndian
        frame.append(Data(bytes: &len, count: 4))
        frame.append(payload)
        try? session.send(frame, toPeers: session.connectedPeers, with: .reliable)
    }

    private func parseFrame(_ data: Data) -> (typeTag: UInt8, payload: Data)? {
        guard data.count >= 5 else { return nil }
        let typeTag = data[0]
        let length  = Int(UInt32(bigEndian: data[1..<5].withUnsafeBytes { $0.load(as: UInt32.self) }))
        guard data.count == 5 + length else { return nil }
        return (typeTag, data[5...])
    }
}

// MARK: - MCSessionDelegate

extension MultipeerTransport: MCSessionDelegate {

    public func session(_ session: MCSession, peer: MCPeerID,
                        didChange state: MCSessionState) {}

    public func session(_ session: MCSession, didReceive data: Data,
                        fromPeer: MCPeerID) {
        guard let (typeTag, payload) = parseFrame(data) else { return }
        switch typeTag {
        case 0x01: onIncomingRequest?(payload)
        case 0x02: onIncomingProof?(payload)
        default:   break
        }
    }

    public func session(_ session: MCSession, didReceive stream: InputStream,
                        withName: String, fromPeer: MCPeerID) {}
    public func session(_ session: MCSession,
                        didStartReceivingResourceWithName: String,
                        fromPeer: MCPeerID, with: Progress) {}
    public func session(_ session: MCSession,
                        didFinishReceivingResourceWithName: String,
                        fromPeer: MCPeerID, at: URL?, withError: Error?) {}
}

// MARK: - MCNearbyServiceAdvertiserDelegate

extension MultipeerTransport: MCNearbyServiceAdvertiserDelegate {

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                           didReceiveInvitationFromPeer peer: MCPeerID,
                           withContext context: Data?,
                           invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // Accept all Fernlink peer invitations
        invitationHandler(true, session)
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                           didNotStartAdvertisingPeer error: Error) {}
}

// MARK: - MCNearbyServiceBrowserDelegate

extension MultipeerTransport: MCNearbyServiceBrowserDelegate {

    public func browser(_ browser: MCNearbyServiceBrowser,
                        foundPeer peer: MCPeerID,
                        withDiscoveryInfo info: [String: String]?) {
        // Only invite if our pubkey is lower — same deterministic rule as Android WiFi Direct.
        let peerPubKey = info?["pk"] ?? ""
        if localPubKey < peerPubKey {
            browser.invitePeer(peer, to: session, withContext: nil, timeout: 10)
        }
        // else: wait for the other side to invite us
    }

    public func browser(_ browser: MCNearbyServiceBrowser,
                        lostPeer peer: MCPeerID) {}

    public func browser(_ browser: MCNearbyServiceBrowser,
                        didNotStartBrowsingForPeers error: Error) {}
}
