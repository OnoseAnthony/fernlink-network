package xyz.fernlink.sdk

import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.json.JSONArray
import org.json.JSONObject

/**
 * FernlinkClient is the main entry point for the Fernlink Android SDK.
 *
 * It coordinates peer communication, proof collection, and consensus
 * evaluation using the native Rust core (fernlink-core) via JNI.
 *
 * Usage:
 * ```kotlin
 * val client = FernlinkClient(FernlinkClientConfig(
 *     rpcEndpoint = "https://api.mainnet-beta.solana.com"
 * ))
 * client.start()
 *
 * val result = client.verifyTransaction(txSignature)
 * if (result.settled) Log.d("Fernlink", "Status: ${result.status}")
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

    private var started = false

    fun start() { started = true }
    fun stop()  { started = false; scope.cancel() }

    /**
     * Verify a Solana transaction.
     *
     * Queries the configured RPC endpoint, signs a proof with this device's
     * Ed25519 key, and returns the consensus result.
     *
     * In the full mesh implementation this broadcasts over BLE and collects
     * proofs from nearby peers before applying consensus rules. This release
     * demonstrates the complete cryptographic flow end-to-end.
     *
     * @param txSignature  Base58-encoded transaction signature
     * @param commitment   Required commitment level (default: CONFIRMED)
     * @param timeoutMs    Max time to wait for mesh proofs (default: 15s)
     * @return ConsensusResult with settled status and verified proof count
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

        val proofJson = FernlinkJni.signProof(
            keypairSeed = keypairBytes.sliceArray(0..31),
            txSignature  = txSignature,
            statusByte   = statusByte,
            slot         = sigStatus.slot,
            blockTime    = sigStatus.blockTime,
            errorCode    = 0,
        ) ?: throw RuntimeException("Failed to sign proof")

        // Verify our own proof before trusting it
        val valid = FernlinkJni.verifyProof(proofJson)
        if (!valid) throw RuntimeException("Self-signed proof failed verification")

        val proofsArray = JSONArray().apply { put(JSONObject(proofJson)) }
        val consensusJson = FernlinkJni.evaluateProofs(proofsArray.toString(), 1)
            ?: throw RuntimeException("Consensus evaluation failed")

        json.decodeFromString<ConsensusResult>(consensusJson)
    }
}
