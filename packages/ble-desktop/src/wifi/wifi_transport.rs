use std::{future::Future, pin::Pin, sync::Arc};

use anyhow::Result;
use tokio::sync::mpsc;
use tracing::{info, warn};

use crate::transport::{SendFn, TransportHandle};
use super::mdns::MdnsService;
use super::tcp_client::TcpClient;
use super::tcp_server::TcpServer;

/// Build a TransportHandle backed by a local TCP server + mDNS-discovered peers.
///
/// The returned handle is ready to be passed to `router::run_router` alongside
/// (or instead of) the BLE handle.
pub async fn build_wifi_transport(pubkey_hex: &str) -> Result<TransportHandle> {
    let (request_tx, request_rx) = mpsc::channel::<Vec<u8>>(64);
    let (proof_tx,   proof_rx)   = mpsc::channel::<Vec<u8>>(64);

    // TCP server binds to an OS-assigned port.
    let server = Arc::new(
        TcpServer::start(request_tx, proof_tx.clone()).await?,
    );
    info!("wifi TCP server on port {}", server.port);

    // TCP client manages outbound connections.
    let client = Arc::new(TcpClient::new());

    // mDNS: advertise our service and browse for peers.
    let mdns         = MdnsService::new(server.port, pubkey_hex)?;
    let peer_std_rx  = mdns.start_browse()?;

    // Bridge the blocking std Receiver to an async channel, keeping the
    // MdnsService (and its daemon) alive inside the spawned thread.
    let (peer_tx, mut peer_rx) = mpsc::channel(32);
    std::thread::spawn(move || {
        let _mdns = mdns; // daemon lives as long as this thread
        while let Ok(p) = peer_std_rx.recv() {
            if peer_tx.blocking_send(p).is_err() {
                break;
            }
        }
    });

    // Peer-connection task: apply the deterministic "lower pubkey connects" rule.
    {
        let client2   = Arc::clone(&client);
        let proof_tx2 = proof_tx.clone();
        let local_pk  = pubkey_hex.to_string();

        tokio::spawn(async move {
            while let Some(peer) = peer_rx.recv().await {
                if peer.pubkey == local_pk { continue; }   // skip self
                if peer.pubkey > local_pk  { continue; }   // higher pubkey waits

                let c   = Arc::clone(&client2);
                let ptx = proof_tx2.clone();
                let (host, port) = (peer.host.clone(), peer.port);

                tokio::spawn(async move {
                    if let Err(e) = c.connect(&host, port, ptx).await {
                        warn!("wifi connect {host}:{port} failed: {e}");
                    } else {
                        info!("wifi connected to {host}:{port}");
                    }
                });
            }
        });
    }

    // ── SendFn closures ───────────────────────────────────────────────────────

    let send_proof: SendFn = {
        let s = Arc::clone(&server);
        let c = Arc::clone(&client);
        Arc::new(move |data: Vec<u8>| {
            let s2 = Arc::clone(&s);
            let c2 = Arc::clone(&c);
            Box::pin(async move {
                s2.send_proof(data.clone()).await?;
                c2.send_proof(data).await?;
                Ok(())
            }) as Pin<Box<dyn Future<Output = Result<()>> + Send>>
        })
    };

    let send_request: SendFn = {
        let s = Arc::clone(&server);
        let c = Arc::clone(&client);
        Arc::new(move |data: Vec<u8>| {
            let s2 = Arc::clone(&s);
            let c2 = Arc::clone(&c);
            Box::pin(async move {
                s2.send_request(data.clone()).await?;
                c2.send_request(data).await?;
                Ok(())
            }) as Pin<Box<dyn Future<Output = Result<()>> + Send>>
        })
    };

    let peer_count = {
        let s = Arc::clone(&server);
        let c = Arc::clone(&client);
        Arc::new(move || s.connected_count() + c.connected_count())
            as Arc<dyn Fn() -> usize + Send + Sync>
    };

    Ok(TransportHandle::new(
        Some(request_rx),
        proof_rx,
        send_proof,
        send_request,
        peer_count,
    ))
}
