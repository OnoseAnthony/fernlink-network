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
 * val result = client.verifyTransaction(txSignature)
 * ```
 *
 * When BLE peers are connected, verifyTransaction() broadcasts the request into
 * the mesh. Peers independently call Solana RPC, sign the result, and return
 * cryptographic proofs. If a peer has no internet it forwards the request further
 * through the mesh (multi-hop) until a device with connectivity is reached.
 * Your device only falls back to direct RPC if no peers respond within timeoutMs.
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

    fun attachBleService(service: FernlinkBleService) {
        bleService = service
        service.startMesh(
            keypairSeed = keypairBytes.sliceArray(0..31),
            rpcEndpoint = config.rpcEndpoint,
        )
    }

    fun detachBleService() {
        bleService?.stopMesh()
        bleService = null
    }

    val connectedPeerCount: Int get() = bleService?.connectedPeerCount ?: 0

    /**
     * Verify a Solana transaction.
     *
     * If BLE peers are connected, broadcasts a request to the mesh. Each peer
     * independently verifies via its own Solana RPC connection and returns a
     * signed proof. Peers without internet forward the request further (multi-hop).
     * Consensus requires [config.minProofs] matching proofs.
     *
     * Falls back to a direct local RPC call if no peer proofs arrive within
     * [timeoutMs] or no BLE service is attached.
     */
    suspend fun verifyTransaction(
        txSignature: String,
        commitment: Commitment = Commitment.CONFIRMED,
        timeoutMs: Long = 15_000,
    ): ConsensusResult = withContext(Dispatchers.IO) {
        check(started) { "Call client.start() before verifyTransaction()" }

        val ble = bleService
        if (ble != null && ble.connectedPeerCount > 0) {
            ble.clearProofs()
            ble.broadcastRequest(
                txSignature = txSignature,
                commitment  = commitment.name.lowercase(),
                ttl         = 8,
            )
            delay(timeoutMs)

            val consensusJson = ble.collectConsensusJson(config.minProofs)
            if (consensusJson != null) {
                return@withContext json.decodeFromString<ConsensusResult>(consensusJson)
            }
            // Peers didn't respond in time — fall through to direct RPC
        }

        // Direct RPC fallback: this device calls Solana itself
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
