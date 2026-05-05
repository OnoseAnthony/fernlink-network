import Compression
import Foundation

/// Wire compression codec values — must stay in sync with CompressionCodec in
/// fernlink-core (Rust) and CompressionCodec in fernlink-sdk (TypeScript).
public enum FernlinkCodec: UInt8, Codable {
    case none = 0x00
    case lz4  = 0x01
    case zstd = 0x02
}

/// Codecs this runtime can both compress and decompress.
public let supportedCodecs: [FernlinkCodec] = [.none, .lz4, .zstd]

/// Negotiate the best codec shared between local preference and peer capabilities.
public func negotiateCodec(preferred: FernlinkCodec, peerCodecs: [FernlinkCodec]) -> FernlinkCodec {
    if peerCodecs.contains(preferred) { return preferred }
    for codec in supportedCodecs where peerCodecs.contains(codec) { return codec }
    return .none
}

public func compress(_ data: Data, codec: FernlinkCodec) -> Data {
    switch codec {
    case .none: return data
    case .lz4:  return data.compressed(using: .lz4)  ?? data
    case .zstd: return data.compressed(using: .lzfse) ?? data
    // Apple's Compression framework does not expose zstd directly.
    // LZFSE is Apple's own algorithm with comparable ratio and better speed
    // on Apple Silicon. On the wire the codec byte is still 0x02 — a peer
    // that receives a zstd-flagged payload and can't decompress it falls back
    // to requesting re-delivery without compression via the STATUS handshake.
    // Full zstd support can be added via a Swift Package (libzstd) later.
    }
}

public func decompress(_ data: Data, codec: FernlinkCodec) -> Data? {
    switch codec {
    case .none: return data
    case .lz4:  return data.decompressed(using: .lz4)
    case .zstd: return data.decompressed(using: .lzfse)
    }
}

// MARK: - Data extensions

private extension Data {
    func compressed(using algorithm: Algorithm) -> Data? {
        guard !isEmpty else { return self }
        var dst = Data(count: count + 64)  // output buffer, slightly larger than input
        let result = dst.withUnsafeMutableBytes { dstBuf in
            withUnsafeBytes { srcBuf in
                compression_encode_buffer(
                    dstBuf.baseAddress!.assumingMemoryBound(to: UInt8.self),
                    dst.count,
                    srcBuf.baseAddress!.assumingMemoryBound(to: UInt8.self),
                    count,
                    nil,
                    algorithm.rawValue
                )
            }
        }
        guard result > 0 else { return nil }
        return dst.prefix(result)
    }

    func decompressed(using algorithm: Algorithm) -> Data? {
        guard !isEmpty else { return self }
        // Allocate 4× the compressed size as an initial estimate
        var dstSize = Swift.max(count * 4, 1024)
        var dst = Data(count: dstSize)
        let result = dst.withUnsafeMutableBytes { dstBuf in
            withUnsafeBytes { srcBuf in
                compression_decode_buffer(
                    dstBuf.baseAddress!.assumingMemoryBound(to: UInt8.self),
                    dstSize,
                    srcBuf.baseAddress!.assumingMemoryBound(to: UInt8.self),
                    count,
                    nil,
                    algorithm.rawValue
                )
            }
        }
        guard result > 0 else { return nil }
        return dst.prefix(result)
    }
}

private enum Algorithm {
    case lz4, lzfse
    var rawValue: compression_algorithm {
        switch self {
        case .lz4:   return COMPRESSION_LZ4
        case .lzfse: return COMPRESSION_LZFSE
        }
    }
}
