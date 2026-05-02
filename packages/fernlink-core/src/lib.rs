pub mod consensus;
pub mod crypto;
pub mod error;
pub mod gossip;
pub mod message;

#[cfg(feature = "rpc")]
pub mod rpc;

pub use consensus::{evaluate, ConsensusResult};
pub use crypto::{verify_proof, Keypair};
pub use error::{FernlinkError, Result};
pub use gossip::SeenCache;
pub use message::{
    Commitment, Header, MessageType, TxStatus, VerificationProof, VerificationRequest,
    PROTOCOL_VERSION,
};

#[cfg(feature = "rpc")]
pub use rpc::get_signature_status;
