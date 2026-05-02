package xyz.fernlink.sdk.ble

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import org.json.JSONArray
import org.json.JSONObject
import xyz.fernlink.sdk.FernlinkJni

/**
 * Wires the GATT server and client together with the Fernlink crypto layer.
 *
 * Incoming REQUEST payloads trigger signProof via JNI; the result is sent back
 * as a PROOF notification to all subscribed centrals.
 *
 * Outbound requests are forwarded to peers if connected, or buffered in
 * [proofStore] for store-and-forward delivery when a peer reconnects.
 *
 * Incoming PROOF notifications are queued for FernlinkClient to collect.
 */
internal class BleMessageRouter(
    private val server: GattServerManager,
    private val client: GattClientManager,
    private val proofStore: ProofStore,
    private val keypairSeed: ByteArray,
    private val scope: CoroutineScope,
) {
    private val collectedProofsList = ArrayDeque<String>()
    val collectedProofs: List<String> get() = collectedProofsList.toList()

    fun clearProofs() = collectedProofsList.clear()

    fun start() {
        server.incomingRequests
            .onEach { payload -> handleIncomingRequest(payload) }
            .launchIn(scope)

        client.incomingProofs
            .onEach { payload -> collectedProofsList.add(String(payload, Charsets.UTF_8)) }
            .launchIn(scope)
    }

    private fun handleIncomingRequest(payload: ByteArray) {
        runCatching {
            val json       = JSONObject(String(payload, Charsets.UTF_8))
            val txSig      = json.getString("txSignature")
            val statusByte = json.getInt("statusByte").toByte()
            val slot       = json.getLong("slot")
            val blockTime  = json.getLong("blockTime")

            val proofJson = FernlinkJni.signProof(
                keypairSeed = keypairSeed,
                txSignature = txSig,
                statusByte  = statusByte,
                slot        = slot,
                blockTime   = blockTime,
                errorCode   = 0,
            ) ?: return

            server.sendProof(proofJson.toByteArray(Charsets.UTF_8))
        }
    }

    fun broadcastRequest(
        txSignature: String,
        statusByte: Byte,
        slot: Long,
        blockTime: Long,
    ) {
        if (client.connectedPeerCount == 0) {
            // No peers right now — buffer for store-and-forward
            proofStore.enqueue(ProofStore.PendingRequest(txSignature, statusByte, slot, blockTime))
            return
        }

        val payload = JSONObject().apply {
            put("txSignature", txSignature)
            put("statusByte",  statusByte.toInt())
            put("slot",        slot)
            put("blockTime",   blockTime)
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
