use crate::message::CompressionCodec;
use crate::error::{FernlinkError, Result};

/// Compress `data` with the given codec.
///
/// LZ4 uses block format with a 4-byte little-endian original-size prefix,
/// matching the layout produced by `lz4js` in the TypeScript SDK for
/// cross-language interoperability.
pub fn compress(codec: CompressionCodec, data: &[u8]) -> Result<Vec<u8>> {
    match codec {
        CompressionCodec::None => Ok(data.to_vec()),
        #[cfg(feature = "lz4")]
        CompressionCodec::Lz4 => {
            Ok(lz4_flex::block::compress_prepend_size(data))
        }
        #[cfg(feature = "zstd")]
        CompressionCodec::Zstd => {
            zstd::encode_all(data, 3).map_err(|e| FernlinkError::Compression(e.to_string()))
        }
        #[allow(unreachable_patterns)]
        _ => Ok(data.to_vec()),
    }
}

/// Decompress `data` using the codec declared in the message header.
pub fn decompress(codec: CompressionCodec, data: &[u8]) -> Result<Vec<u8>> {
    match codec {
        CompressionCodec::None => Ok(data.to_vec()),
        #[cfg(feature = "lz4")]
        CompressionCodec::Lz4 => {
            lz4_flex::block::decompress_size_prepended(data)
                .map_err(|e| FernlinkError::Compression(e.to_string()))
        }
        #[cfg(feature = "zstd")]
        CompressionCodec::Zstd => {
            zstd::decode_all(data).map_err(|e| FernlinkError::Compression(e.to_string()))
        }
        #[allow(unreachable_patterns)]
        _ => Ok(data.to_vec()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::CompressionCodec;

    // Realistic Fernlink proof payload: base58 tx sig + metadata + Ed25519 bytes
    const SAMPLE: &[u8] = b"\
5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d\
confirmed\x00\x01\x00\x00\x00\x00\x00\x00\
\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\
\xde\xad\xbe\xef\xca\xfe\xba\xbe\xde\xad\xbe\xef\
\xca\xfe\xba\xbe\xde\xad\xbe\xef\xca\xfe\xba\xbe\
\xde\xad\xbe\xef\xca\xfe\xba\xbe\xde\xad\xbe\xef\
\xca\xfe\xba\xbe\xde\xad\xbe\xef\xca\xfe\xba\xbe\
\xde\xad\xbe\xef\xca\xfe\xba\xbe\xde\xad\xbe\xef\
\xca\xfe\xba\xbe\xde\xad\xbe\xef\xca\xfe\xba\xbe";

    #[test]
    fn roundtrip_none() {
        let compressed   = compress(CompressionCodec::None, SAMPLE).unwrap();
        let decompressed = decompress(CompressionCodec::None, &compressed).unwrap();
        assert_eq!(decompressed, SAMPLE);
    }

    #[cfg(all(feature = "lz4", feature = "zstd"))]
    #[test]
    fn roundtrip_lz4() {
        let compressed   = compress(CompressionCodec::Lz4, SAMPLE).unwrap();
        let decompressed = decompress(CompressionCodec::Lz4, &compressed).unwrap();
        assert_eq!(decompressed, SAMPLE);
    }

    #[cfg(all(feature = "lz4", feature = "zstd"))]
    #[test]
    fn roundtrip_zstd() {
        let compressed   = compress(CompressionCodec::Zstd, SAMPLE).unwrap();
        let decompressed = decompress(CompressionCodec::Zstd, &compressed).unwrap();
        assert_eq!(decompressed, SAMPLE);
    }

    #[cfg(all(feature = "lz4", feature = "zstd"))]
    #[test]
    fn lz4_reduces_compressible_data() {
        // A highly compressible payload (repeated bytes) should shrink
        let data: Vec<u8> = b"confirmed:slot:".iter().cloned().cycle().take(300).collect();
        let compressed = compress(CompressionCodec::Lz4, &data).unwrap();
        assert!(compressed.len() < data.len(), "LZ4 should compress repetitive data");
    }

    #[cfg(all(feature = "lz4", feature = "zstd"))]
    #[test]
    fn zstd_reduces_compressible_data() {
        let data: Vec<u8> = b"confirmed:slot:".iter().cloned().cycle().take(300).collect();
        let compressed = compress(CompressionCodec::Zstd, &data).unwrap();
        assert!(compressed.len() < data.len(), "zstd should compress repetitive data");
    }

    #[test]
    fn none_codec_is_identity() {
        let data = vec![0xde, 0xad, 0xbe, 0xef];
        assert_eq!(compress(CompressionCodec::None, &data).unwrap(), data);
        assert_eq!(decompress(CompressionCodec::None, &data).unwrap(), data);
    }
}
