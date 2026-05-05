package xyz.fernlink.sdk

import kotlinx.coroutines.*
import kotlinx.serialization.json.Json
import org.json.JSONArray
import org.json.JSONObject
import xyz.fernlink.sdk.ble.FernlinkBleService
import xyz.fernlink.sdk.transport.FernlinkTransport
import xyz.fernlink.sdk.transport.TransportType

/**
 * FernlinkClient is the main entry point for the Fernlink Android SDK.
 *
 * Single-device (RPC-only) usage:
 * ```kotlin
 * val client = FernlinkClient(FernlinkClientConfig(rpcEndpoint = "https://api.mainnet-beta.solana.com"))
 * client.start()
 * val result = client.verifyTransaction(txSignature)
 * ```
 *
 * With BLE mesh (bind FernlinkBleService first, then attach):
 * ```kotlin
 * client.attachTransport(bleService)   // call from onServiceConnected
 * val result = client.verifyTransaction(txSignature)
 * ```
 *
 * Multiple transports can be attached simultaneously. WiFi Direct is preferred
 * over BLE when both are connected (higher bandwidth, longer range).
 */
class FernlinkClient(private val config: FernlinkClientConfig) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val rpc   = SolanaRpc(config.rpcEndpoint)
    private val json  = Json { ignoreUnknownKeys = true }

    private val keypairBytes: ByteArray = config.keypairSeed?.let { seed ->
        val kp = FernlinkJni.generateKeypair()
        seed.copyInto(kp, destinationOffset = 0, endIndex = 32)
        kp
    } ?: FernlinkJni.generateKeypair()

    val publicKey: String
        get() = keypairBytes.drop(32).joinToString("") { "%02x".format(it) }

    private var started    = false
    private val transports = mutableListOf<FernlinkTransport>()

    fun start() { started = true }
    fun stop()  {
        started = false
        transports.forEach { it.stopMesh() }
        scope.cancel()
    }

    // ── Transport management ──────────────────────────────────────────────────

    /** Attach any FernlinkTransport (BLE, WiFi Direct, etc.) to the mesh. */
    fun attachTransport(transport: FernlinkTransport) {
        transports.add(transport)
        if (started) {
            transport.startMesh(
                keypairSeed = keypairBytes.sliceArray(0..31),
                rpcEndpoint = config.rpcEndpoint,
            )
        }
    }

    /** Convenience overload — kept for backwards compatibility. */
    fun attachBleService(service: FernlinkBleService) = attachTransport(service)

    fun detachTransport(transport: FernlinkTransport) {
        transport.stopMesh()
        transports.remove(transport)
    }

    fun detachBleService() {
        transports.filterIsInstance<FernlinkBleService>().forEach { detachTransport(it) }
    }

    /** Total connected peers across all active transports. */
    val connectedPeerCount: Int
        get() = transports.sumOf { it.connectedPeerCount }

    // ── Verification ─────────────────────────────────────────────────────────

    /**
     * Verify a Solana transaction.
     *
     * Delegates to the highest-priority transport that has connected peers.
     * Falls back to direct RPC if no transport has peers or none respond
     * within [timeoutMs].
     */
    suspend fun verifyTransaction(
        txSignature: String,
        commitment: Commitment = Commitment.CONFIRMED,
        timeoutMs: Long = 15_000,
    ): ConsensusResult = withContext(Dispatchers.IO) {
        check(started) { "Call client.start() before verifyTransaction()" }

        // Pick highest-priority transport with active peers
        val activeTransport = transports
            .filter { it.connectedPeerCount > 0 }
            .maxByOrNull { it.transportType.priority }

        if (activeTransport != null) {
            activeTransport.clearProofs()
            activeTransport.broadcastRequest(
                txSignature = txSignature,
                commitment  = commitment.name.lowercase(),
                ttl         = 8,
            )
            delay(timeoutMs)

            val consensusJson = activeTransport.collectConsensusJson(config.minProofs)
            if (consensusJson != null) {
                return@withContext json.decodeFromString<ConsensusResult>(consensusJson)
            }
        }

        // Direct RPC fallback
        val sigStatus = rpc.getSignatureStatus(txSignature)
        val statusByte: Byte = when (sigStatus.status) {
            TxStatus.CONFIRMED -> 0
            TxStatus.FAILED    -> 1
            TxStatus.UNKNOWN   -> 2
        }
        val proofJson = FernlinkJni.signProof(
            keypairSeed = keypairBytes.sliceArray(0..31),
            txSignature  = txSignature,
            statusByte   = statusByte,
            slot         = sigStatus.slot,
            blockTime    = sigStatus.blockTime,
            errorCode    = 0,
        ) ?: throw RuntimeException("Failed to sign proof")

        val proofsArray   = JSONArray().apply { put(JSONObject(proofJson)) }
        val consensusJson = FernlinkJni.evaluateProofs(proofsArray.toString(), 1)
            ?: throw RuntimeException("Consensus evaluation failed")
        json.decodeFromString<ConsensusResult>(consensusJson)
    }
}
