package xyz.fernlink.sdk

/**
 * Wire-level codec-byte encoding matching the TypeScript WebBluetoothPeer and Rust BLE layers.
 *
 * Format: [1 byte: codec (0x00–0x02)] [compressed or raw JSON bytes]
 * Backwards compat: messages starting with '{' (0x7B) are treated as legacy uncompressed JSON.
 */
internal object WirePayload {

    private const val CODEC_LZ4 = 1

    fun encode(json: ByteArray, codec: Int = CODEC_LZ4): ByteArray {
        val compressed = runCatching { FernlinkJni.compress(codec, json) }.getOrDefault(json)
        return byteArrayOf(codec.toByte()) + compressed
    }

    fun decode(data: ByteArray): ByteArray {
        if (data.isEmpty()) return data
        val first = data[0].toInt() and 0xFF
        if (first == 0x7B || first > 2) return data   // legacy '{' or unknown codec byte
        val body = data.copyOfRange(1, data.size)
        return runCatching { FernlinkJni.decompress(first, body) }.getOrDefault(body)
    }
}
