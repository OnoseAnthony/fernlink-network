use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tokio::net::{TcpListener, tcp::OwnedWriteHalf};
use tokio::sync::{mpsc, Mutex};
use anyhow::Result;

use super::tcp_framing::{read_frame_async, write_frame_async, TYPE_PROOF, TYPE_REQUEST};

type WriteHalf = Arc<Mutex<OwnedWriteHalf>>;

pub struct TcpServer {
    pub port: u16,
    writes:   Arc<Mutex<Vec<WriteHalf>>>,
    count:    Arc<AtomicUsize>,
}

impl TcpServer {
    pub async fn start(
        request_tx: mpsc::Sender<Vec<u8>>,
        proof_tx:   mpsc::Sender<Vec<u8>>,
    ) -> Result<Self> {
        let listener = TcpListener::bind("0.0.0.0:0").await?;
        let port     = listener.local_addr()?.port();
        let writes   = Arc::new(Mutex::new(Vec::<WriteHalf>::new()));
        let count    = Arc::new(AtomicUsize::new(0));

        let writes2 = Arc::clone(&writes);
        let count2  = Arc::clone(&count);

        tokio::spawn(async move {
            loop {
                let Ok((socket, _)) = listener.accept().await else { break };
                let (mut rd, wr) = socket.into_split();
                let wr: WriteHalf = Arc::new(Mutex::new(wr));

                writes2.lock().await.push(Arc::clone(&wr));
                count2.fetch_add(1, Ordering::Relaxed);

                let writes3   = Arc::clone(&writes2);
                let count3    = Arc::clone(&count2);
                let req_tx2   = request_tx.clone();
                let proof_tx2 = proof_tx.clone();
                let wr2       = Arc::clone(&wr);

                tokio::spawn(async move {
                    loop {
                        match read_frame_async(&mut rd).await {
                            Ok(Some((t, p))) if t == TYPE_REQUEST => { req_tx2.send(p).await.ok(); }
                            Ok(Some((t, p))) if t == TYPE_PROOF   => { proof_tx2.send(p).await.ok(); }
                            Ok(Some(_))                           => {}
                            Ok(None) | Err(_)                     => break,
                        }
                    }
                    writes3.lock().await.retain(|w| !Arc::ptr_eq(w, &wr2));
                    count3.fetch_sub(1, Ordering::Relaxed);
                });
            }
        });

        Ok(Self { port, writes, count })
    }

    pub async fn send_proof(&self, payload: Vec<u8>) -> Result<()> {
        self.broadcast(TYPE_PROOF, &payload).await
    }

    pub async fn send_request(&self, payload: Vec<u8>) -> Result<()> {
        self.broadcast(TYPE_REQUEST, &payload).await
    }

    pub fn connected_count(&self) -> usize {
        self.count.load(Ordering::Relaxed)
    }

    async fn broadcast(&self, type_tag: u8, payload: &[u8]) -> Result<()> {
        let snapshot: Vec<WriteHalf> = self.writes.lock().await.clone();
        for wh in &snapshot {
            let mut w = wh.lock().await;
            write_frame_async(&mut *w, type_tag, payload).await.ok();
        }
        Ok(())
    }
}
