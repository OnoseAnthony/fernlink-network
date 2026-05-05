use std::collections::HashMap;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tokio::net::{TcpStream, tcp::OwnedWriteHalf};
use tokio::sync::{mpsc, Mutex};
use anyhow::Result;

use super::tcp_framing::{read_frame_async, write_frame_async, TYPE_PROOF, TYPE_REQUEST};

type WriteHalf = Arc<Mutex<OwnedWriteHalf>>;

pub struct TcpClient {
    writes: Arc<Mutex<HashMap<String, WriteHalf>>>,
    count:  Arc<AtomicUsize>,
}

impl TcpClient {
    pub fn new() -> Self {
        Self {
            writes: Arc::new(Mutex::new(HashMap::new())),
            count:  Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Establish an outbound TCP connection. Incoming proofs are forwarded to `proof_tx`.
    /// No-op if already connected to this peer.
    pub async fn connect(
        &self,
        host:     &str,
        port:     u16,
        proof_tx: mpsc::Sender<Vec<u8>>,
    ) -> Result<()> {
        let key = format!("{host}:{port}");
        if self.writes.lock().await.contains_key(&key) {
            return Ok(());
        }

        let socket = TcpStream::connect(format!("{host}:{port}")).await?;
        let (mut rd, wr) = socket.into_split();
        let wr: WriteHalf = Arc::new(Mutex::new(wr));

        self.writes.lock().await.insert(key.clone(), Arc::clone(&wr));
        self.count.fetch_add(1, Ordering::Relaxed);

        let writes2 = Arc::clone(&self.writes);
        let count2  = Arc::clone(&self.count);

        tokio::spawn(async move {
            loop {
                match read_frame_async(&mut rd).await {
                    Ok(Some((t, p))) if t == TYPE_PROOF => { proof_tx.send(p).await.ok(); }
                    Ok(Some(_))                        => {}
                    Ok(None) | Err(_)                  => break,
                }
            }
            writes2.lock().await.remove(&key);
            count2.fetch_sub(1, Ordering::Relaxed);
        });

        Ok(())
    }

    pub async fn send_request(&self, payload: Vec<u8>) -> Result<()> {
        self.broadcast(TYPE_REQUEST, &payload).await
    }

    pub async fn send_proof(&self, payload: Vec<u8>) -> Result<()> {
        self.broadcast(TYPE_PROOF, &payload).await
    }

    pub fn connected_count(&self) -> usize {
        self.count.load(Ordering::Relaxed)
    }

    async fn broadcast(&self, type_tag: u8, payload: &[u8]) -> Result<()> {
        let snapshot: Vec<WriteHalf> = self.writes.lock().await.values().cloned().collect();
        for wh in &snapshot {
            let mut w = wh.lock().await;
            write_frame_async(&mut *w, type_tag, payload).await.ok();
        }
        Ok(())
    }
}
