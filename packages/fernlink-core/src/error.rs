use thiserror::Error;

#[derive(Debug, Error)]
pub enum FernlinkError {
    #[error("invalid signature: {0}")]
    InvalidSignature(String),

    #[error("invalid message format: {0}")]
    InvalidMessage(String),

    #[error("RPC error: {0}")]
    RpcError(String),

    #[error("consensus failed: {0}")]
    ConsensusFailed(String),

    #[error("serialization error: {0}")]
    SerializationError(String),

    #[error("proof expired (TTL exhausted)")]
    ProofExpired,

    #[error("duplicate message: {0}")]
    Duplicate(String),
}

pub type Result<T> = std::result::Result<T, FernlinkError>;
