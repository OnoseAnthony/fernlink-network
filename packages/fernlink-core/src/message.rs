use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use uuid::Uuid;

pub const PROTOCOL_VERSION: u8 = 2;
pub const DEFAULT_TTL: u8 = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[repr(u8)]
pub enum CompressionCodec {
    #[default]
    None = 0x00,
    Lz4  = 0x01,
    Zstd = 0x02,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MessageType {
    Request = 0x01,
    Proof   = 0x02,
    Ack     = 0x03,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum Commitment {
    Processed  = 0,
    Confirmed  = 1,
    Finalized  = 2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum TxStatus {
    Confirmed = 0,
    Failed    = 1,
    Unknown   = 2,
}

/// Compact wire header present on every Fernlink message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Header {
    pub version:      u8,
    pub message_type: MessageType,
    pub message_id:   Uuid,
    pub timestamp_ms: u64,
    pub ttl:          u8,
    #[serde(default)]
    pub compression:  CompressionCodec,
}

impl Header {
    pub fn new(message_type: MessageType) -> Self {
        Self {
            version: PROTOCOL_VERSION,
            message_type,
            message_id: Uuid::new_v4(),
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            ttl: DEFAULT_TTL,
            compression: CompressionCodec::None,
        }
    }

    /// Decrement TTL; returns false if the message should be dropped.
    pub fn hop(&mut self) -> bool {
        if self.ttl == 0 {
            return false;
        }
        self.ttl -= 1;
        true
    }
}

/// Broadcast by the originating device to request verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationRequest {
    pub header:            Header,
    #[serde(with = "BigArray")]
    pub tx_signature:      [u8; 64],
    pub commitment:        Commitment,
    pub timeout_secs:      u16,
    pub originator_pubkey: [u8; 32],
}

impl VerificationRequest {
    pub fn new(
        tx_signature: [u8; 64],
        commitment: Commitment,
        timeout_secs: u16,
        originator_pubkey: [u8; 32],
    ) -> Self {
        Self {
            header: Header::new(MessageType::Request),
            tx_signature,
            commitment,
            timeout_secs,
            originator_pubkey,
        }
    }
}

/// Cryptographically signed proof created by a verification node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationProof {
    pub header:          Header,
    #[serde(with = "BigArray")]
    pub tx_signature:    [u8; 64],
    pub status:          TxStatus,
    pub slot:            u64,
    pub block_time:      u64,
    pub error_code:      u16,
    pub verifier_pubkey: [u8; 32],
    #[serde(with = "BigArray")]
    pub signature:       [u8; 64],
}

impl VerificationProof {
    /// Bytes covered by the Ed25519 signature.
    pub fn signable_bytes(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(64 + 1 + 8 + 8 + 2 + 32);
        buf.extend_from_slice(&self.tx_signature);
        buf.push(self.status as u8);
        buf.extend_from_slice(&self.slot.to_le_bytes());
        buf.extend_from_slice(&self.block_time.to_le_bytes());
        buf.extend_from_slice(&self.error_code.to_le_bytes());
        buf.extend_from_slice(&self.verifier_pubkey);
        buf
    }
}
