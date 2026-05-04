package xyz.fernlink.sdk.ble

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import xyz.fernlink.sdk.FernlinkJni
import xyz.fernlink.sdk.SolanaRpc
import java.util.concurrent.ConcurrentLinkedQueue
import xyz.fernlink.sdk.TxStatus

/**
 * Wires the GATT server and client together with the Fernlink crypto layer.
 *
 * When a REQUEST arrives from a remote peer:
 *   1. This device calls the Solana RPC independently to verify the transaction.
 *   2. If RPC succeeds: sign the result and send a PROOF back to the requester.
 *   3. If RPC fails (no internet): forward the request to our own peers with
 *      TTL decremented by 1, so the request hops further through the mesh.
 *
 * When a PROOF arrives from a downstream peer (one we forwarded to):
 *   - Collect it locally for consensus.
 *   - Forward it back upstream via server.sendProof so multi-hop return works
 *     (e.g. C verifies → sends proof to B → B forwards to A who originally asked).
 */
internal class BleMessageRouter(
    private val server: GattServerManager,
    private val client: GattClientManager,
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
        // Each incoming request gets its own coroutine so parallel requests
        // don't queue behind each other's RPC calls
        server.incomingRequests
            .onEach { payload -> scope.launch { handleIncomingRequest(payload) } }
            .launchIn(scope)

        // Proofs from downstream peers: collect locally AND forward back upstream.
        // This is the return path for multi-hop: C → B → A.
        client.incomingProofs
            .onEach { payload ->
                collectedProofsList.add(String(payload, Charsets.UTF_8))
                server.sendProof(payload)
            }
            .launchIn(scope)
    }

    private suspend fun handleIncomingRequest(payload: ByteArray) {
        runCatching {
            val json       = JSONObject(String(payload, Charsets.UTF_8))
            val txSig      = json.getString("txSignature")
            val commitment = json.optString("commitment", "confirmed")
            val ttl        = json.optInt("ttl", 0)

            try {
                // Independently verify by calling Solana RPC ourselves
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

                // Send signed proof back to whoever asked us
                server.sendProof(proofJson.toByteArray(Charsets.UTF_8))

            } catch (_: Exception) {
                // No internet — forward the request further into the mesh if TTL allows
                if (ttl > 0) {
                    val forwarded = JSONObject().apply {
                        put("txSignature", txSig)
                        put("commitment",  commitment)
                        put("ttl",         ttl - 1)
                    }.toString().toByteArray(Charsets.UTF_8)
                    client.sendRequest(forwarded)
                }
            }
        }
    }

    fun broadcastRequest(txSignature: String, commitment: String = "confirmed", ttl: Int = 8) {
        if (client.connectedPeerCount == 0) {
            proofStore.enqueue(ProofStore.PendingRequest(txSignature, commitment, ttl))
            return
        }
        val payload = JSONObject().apply {
            put("txSignature", txSignature)
            put("commitment",  commitment)
            put("ttl",         ttl)
        }.toString().toByteArray(Charsets.UTF_8)
        client.sendRequest(payload)
    }

    fun collectConsensusJson(minProofs: Int): String? {
        val proofs = collectedProofs
        if (proofs.isEmpty()) return null
        val arr = JSONArray().apply { proofs.forEach { put(JSONObject(it)) } }
        return FernlinkJni.evaluateProofs(arr.toString(), minProofs)
    }
}
