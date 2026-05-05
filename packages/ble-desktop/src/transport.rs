use std::{future::Future, pin::Pin, sync::Arc};

use anyhow::Result;
use tokio::sync::{mpsc, Mutex};

/// A type-erased async function for sending bytes to peers.
pub type SendFn = Arc<dyn Fn(Vec<u8>) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync>;

/// Handle to a running Fernlink transport.
///
/// Wraps any combination of sender halves + peer-count getter into a uniform
/// interface that [crate::router] can operate against without depending on
/// BLE-specific types. Construct one per transport using the `for_ble_*`
/// helpers below, or build your own for WiFi/TCP.
pub struct TransportHandle {
    /// Incoming verification requests from remote peers.
    pub request_rx: Option<mpsc::Receiver<Vec<u8>>>,
    /// Incoming signed proofs from remote peers.
    pub proof_rx: mpsc::Receiver<Vec<u8>>,
    /// Send a signed proof back to all connected peers.
    pub send_proof: SendFn,
    /// Broadcast a verification request to all connected peers.
    pub send_request: SendFn,
    /// Number of currently connected remote peers.
    pub connected_peer_count: Arc<dyn Fn() -> usize + Send + Sync>,
    /// Collected proofs shared across the transport session.
    pub proof_store: ProofStore,
}

pub type ProofStore = Arc<Mutex<Vec<String>>>;

impl TransportHandle {
    pub fn new(
        request_rx:          Option<mpsc::Receiver<Vec<u8>>>,
        proof_rx:            mpsc::Receiver<Vec<u8>>,
        send_proof:          SendFn,
        send_request:        SendFn,
        connected_peer_count: Arc<dyn Fn() -> usize + Send + Sync>,
    ) -> Self {
        Self {
            request_rx,
            proof_rx,
            send_proof,
            send_request,
            connected_peer_count,
            proof_store: Arc::new(Mutex::new(vec![])),
        }
    }
}
