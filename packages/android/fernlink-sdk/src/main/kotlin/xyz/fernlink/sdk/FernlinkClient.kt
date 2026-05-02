package xyz.fernlink.sdk

import kotlinx.coroutines.*
import kotlinx.serialization.json.Json
import org.json.JSONArray
import org.json.JSONObject
import xyz.fernlink.sdk.ble.FernlinkBleService

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
 * client.attachBleService(bleService)   // call from onServiceConnected
 * val result = client.verifyTransaction(txSignature)  // now collects peer proofs over BLE
 * ```
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
    private var bleService: FernlinkBleService? = null

    fun start() { started = true }
    fun stop()  { started = false; scope.cancel() }

    /**
     * Attach an already-started FernlinkBleService.
     * Once attached, verifyTransaction() will also broadcast over BLE and
     * collect peer proofs before running consensus.
     */
    fun attachBleService(service: FernlinkBleService) {
        bleService = service
        service.startMesh(keypairBytes.sliceArray(0..31))
    }

    fun detachBleService() {
        bleService?.stopMesh()
        bleService = null
    }

    val connectedPeerCount: Int get() = bleService?.connectedPeerCount ?: 0

    /**
     * Verify a Solana transaction.
     *
     * If a BleService is attached and peers are connected, broadcasts a
     * verification request over BLE and collects peer proofs before consensus.
     * Falls back to a single local proof when no peers respond.
     *
     * @param txSignature  Base58-encoded transaction signature
     * @param commitment   Required commitment level (default: CONFIRMED)
     * @param timeoutMs    Max time to wait for BLE peer proofs (default: 15s)
     */
    suspend fun verifyTransaction(
        txSignature: String,
        commitment: Commitment = Commitment.CONFIRMED,
        timeoutMs: Long = 15_000,
    ): ConsensusResult = withContext(Dispatchers.IO) {
        check(started) { "Call client.start() before verifyTransaction()" }

        val sigStatus = rpc.getSignatureStatus(txSignature)

        val statusByte: Byte = when (sigStatus.status) {
            TxStatus.CONFIRMED -> 0
            TxStatus.FAILED    -> 1
            TxStatus.UNKNOWN   -> 2
        }

        // Sign our own local proof
        val proofJson = FernlinkJni.signProof(
            keypairSeed = keypairBytes.sliceArray(0..31),
            txSignature  = txSignature,
            statusByte   = statusByte,
            slot         = sigStatus.slot,
            blockTime    = sigStatus.blockTime,
            errorCode    = 0,
        ) ?: throw RuntimeException("Failed to sign proof")

        val valid = FernlinkJni.verifyProof(proofJson)
        if (!valid) throw RuntimeException("Self-signed proof failed verification")

        // If BLE service is attached, broadcast to peers and wait for their proofs
        val ble = bleService
        if (ble != null && ble.connectedPeerCount > 0) {
            ble.clearProofs()
            ble.broadcastRequest(txSignature, statusByte, sigStatus.slot, sigStatus.blockTime)
            delay(timeoutMs)

            val consensusJson = ble.collectConsensusJson(config.minProofs)
            if (consensusJson != null) {
                return@withContext json.decodeFromString<ConsensusResult>(consensusJson)
            }
            // Fall through to single-proof consensus if BLE yielded nothing
        }

        // Single-proof consensus (local only)
        val proofsArray  = JSONArray().apply { put(JSONObject(proofJson)) }
        val consensusJson = FernlinkJni.evaluateProofs(proofsArray.toString(), 1)
            ?: throw RuntimeException("Consensus evaluation failed")

        json.decodeFromString<ConsensusResult>(consensusJson)
    }
}
