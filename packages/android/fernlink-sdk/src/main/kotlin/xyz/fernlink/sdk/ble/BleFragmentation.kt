package xyz.fernlink.sdk.ble

/**
 * Splits an arbitrary payload into MTU-sized fragments with a 2-byte header [index, total].
 * Matches the fragmentation scheme in packages/ble/src/fragmentation.ts.
 */
object BleFragmentation {

    fun fragment(payload: ByteArray, mtu: Int = BleUuids.MTU): List<ByteArray> {
        val body = mtu - 2
        val chunks = (payload.size + body - 1) / body
        return (0 until chunks).map { i ->
            val start = i * body
            val end   = minOf(start + body, payload.size)
            byteArrayOf(i.toByte(), chunks.toByte()) + payload.sliceArray(start until end)
        }
    }

    class Reassembler {
        private val parts = mutableMapOf<Int, ByteArray>()
        private var expected = -1

        /** Returns complete payload once all fragments received, null otherwise. */
        fun feed(fragment: ByteArray): ByteArray? {
            if (fragment.size < 2) return null
            val index = fragment[0].toInt() and 0xFF
            val total = fragment[1].toInt() and 0xFF
            expected  = total
            parts[index] = fragment.sliceArray(2 until fragment.size)
            if (parts.size < expected) return null
            val out = (0 until expected).flatMap { parts[it]!!.toList() }.toByteArray()
            parts.clear()
            expected = -1
            return out
        }

        fun reset() { parts.clear(); expected = -1 }
    }
}
