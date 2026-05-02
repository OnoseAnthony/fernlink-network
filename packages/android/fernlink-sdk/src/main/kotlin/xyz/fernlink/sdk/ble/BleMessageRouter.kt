package xyz.fernlink.sdk.ble

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import org.json.JSONArray
import org.json.JSONObject
import xyz.fernlink.sdk.FernlinkJni

/**
 * Wires the GATT server and client together with the Fernlink crypto layer.
 *
 * Incoming REQUEST payloads (from remote centrals) are treated as verification
 * requests: the router signs a proof via the Rust JNI core and sends it back
 * to all subscribed centrals via the PROOF characteristic.
 *
 * Incoming PROOF payloads (notified by remote peripherals) are queued for the
 * owning FernlinkClient to collect and feed into consensus.
 */
internal class BleMessageRouter(
    private val server: GattServerManager,
    private val client: GattClientManager,
    private val keypairSeed: ByteArray,
    private val scope: CoroutineScope,
) {
    private val _collectedProofs = ArrayDeque<String>()
    val collectedProofs: List<String> get() = _collectedProofs.toList()

    fun clearProofs() = _collectedProofs.clear()

    fun start() {
        // Remote peer wrote a REQUEST → sign a proof and notify back
        server.incomingRequests
            .onEach { payload -> handleIncomingRequest(payload) }
            .launchIn(scope)

        // Remote peripheral notified a PROOF → buffer it for consensus
        client.incomingProofs
            .onEach { payload -> _collectedProofs.add(String(payload, Charsets.UTF_8)) }
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
