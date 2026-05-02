package xyz.fernlink.sdk.ble

import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Store-and-forward buffer for outbound verification requests.
 *
 * When no BLE peers are reachable, requests are queued here.
 * GattClientManager drains the queue each time a new peer connects.
 */
internal class ProofStore {

    data class PendingRequest(
        val txSignature: String,
        val statusByte: Byte,
        val slot: Long,
        val blockTime: Long,
    )

    private val queue = ConcurrentLinkedQueue<PendingRequest>()

    val size: Int get() = queue.size
    val isEmpty: Boolean get() = queue.isEmpty()

    fun enqueue(req: PendingRequest) {
        // Cap at 64 entries to bound memory use on long-offline devices
        if (queue.size < 64) queue.add(req)
    }

    /** Drain and return all buffered requests, clearing the queue. */
    fun drain(): List<PendingRequest> {
        val out = mutableListOf<PendingRequest>()
        while (true) out.add(queue.poll() ?: break)
        return out
    }

    fun clear() = queue.clear()
}
