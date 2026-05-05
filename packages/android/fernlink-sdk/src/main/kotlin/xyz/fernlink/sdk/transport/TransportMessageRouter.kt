package xyz.fernlink.sdk.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import xyz.fernlink.sdk.FernlinkJni
import xyz.fernlink.sdk.SolanaRpc
import xyz.fernlink.sdk.TxStatus
import xyz.fernlink.sdk.ble.ProofStore
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Transport-agnostic message router.
 *
 * Drives the Fernlink request → verify → proof cycle over any transport that
 * exposes [incomingRequests] and [incomingProofs] flows plus [sendProof] and
 * [sendRequest] callbacks.
 *
 * This is a generalisation of BleMessageRouter that decouples the routing
 * logic from the BLE-specific GATT classes.
 */
internal class TransportMessageRouter(
    private val incomingRequests: SharedFlow<ByteArray>,
    private val incomingProofs: SharedFlow<ByteArray>,
    private val sendProof: (ByteArray) -> Unit,
    private val sendRequest: (ByteArray) -> Unit,
    private val connectedPeerCount: () -> Int,
    private val proofStore: ProofStore,
    private val keypairSeed: ByteArray,
    private val rpcEndpoint: String,
    private val scope: CoroutineScope,
) {
    private val rpc = SolanaRpc(rpcEndpoint)
    private val collectedProofsList = ConcurrentLinkedQueue<String>()
    val collectedProofs: List<String> get() = collectedProofsList.toList()

    fun clearProofs() = collectedProofsList.clear()

    fun start() {
        incomingRequests
            .onEach { payload -> scope.launch { handleIncomingRequest(payload) } }
            .launchIn(scope)

        // Proofs from downstream peers: verify signature, then collect + forward.
        incomingProofs
            .onEach { payload ->
                val json = String(payload, Charsets.UTF_8)
                if (FernlinkJni.verifyProof(json)) {
                    collectedProofsList.add(json)
                    sendProof(payload)
                }
            }
            .launchIn(scope)
    }

    private suspend fun handleIncomingRequest(payload: ByteArray) {
        runCatching {
            val json       = JSONObject(String(payload, Charsets.UTF_8))
            val txSig      = json.getString("txSignature")
            val commitment = json.optString("commitment", "confirmed")
            val ttl        = json.optInt("ttl", 0).coerceIn(0, 8)

            try {
                val status = rpc.getSignatureStatus(txSig)
                val statusByte: Byte = when (status.status) {
                    TxStatus.CONFIRMED -> 0
                    TxStatus.FAILED    -> 1
                    TxStatus.UNKNOWN   -> 2
                }
                val proofJson = FernlinkJni.signProof(
                    keypairSeed = keypairSeed,
                    txSignature = txSig,
                    statusByte  = statusByte,
                    slot        = status.slot,
                    blockTime   = status.blockTime,
                    errorCode   = 0,
                ) ?: return
                sendProof(proofJson.toByteArray(Charsets.UTF_8))
            } catch (_: Exception) {
                if (ttl > 0) {
                    val forwarded = JSONObject().apply {
                        put("txSignature", txSig)
                        put("commitment",  commitment)
                        put("ttl",         ttl - 1)
                    }.toString().toByteArray(Charsets.UTF_8)
                    sendRequest(forwarded)
                }
            }
        }
    }

    fun broadcastRequest(txSignature: String, commitment: String = "confirmed", ttl: Int = 8) {
        if (connectedPeerCount() == 0) {
            proofStore.enqueue(ProofStore.PendingRequest(txSignature, commitment, ttl))
            return
        }
        val payload = JSONObject().apply {
            put("txSignature", txSignature)
            put("commitment",  commitment)
            put("ttl",         ttl)
        }.toString().toByteArray(Charsets.UTF_8)
        sendRequest(payload)
    }

    fun collectConsensusJson(minProofs: Int): String? {
        val proofs = collectedProofs
        if (proofs.isEmpty()) return null
        val arr = JSONArray().apply { proofs.forEach { put(JSONObject(it)) } }
        return FernlinkJni.evaluateProofs(arr.toString(), minProofs)
    }
}
