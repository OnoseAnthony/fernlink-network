package xyz.fernlink.sdk.transport

enum class TransportType(val priority: Int) {
    BLE(10),
    WIFI_DIRECT(20),
    NFC_BOOTSTRAP(0),
}

/**
 * Common interface implemented by every Fernlink transport service
 * (BLE, WiFi Direct, etc.).
 *
 * FernlinkClient holds a list of FernlinkTransport instances and delegates
 * mesh operations to whichever transport has the highest priority and active peers.
 */
interface FernlinkTransport {
    val transportType: TransportType
    val connectedPeerCount: Int
    val pendingRequestCount: Int

    fun startMesh(keypairSeed: ByteArray, rpcEndpoint: String)
    fun stopMesh()

    fun broadcastRequest(txSignature: String, commitment: String = "confirmed", ttl: Int = 8)
    fun collectConsensusJson(minProofs: Int): String?
    fun clearProofs()
}
