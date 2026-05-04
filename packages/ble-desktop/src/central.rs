use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use btleplug::api::{Central as _, Manager as _, Peripheral as _, ScanFilter, WriteType};
use btleplug::platform::{Manager, Peripheral};
use futures::StreamExt;
use tokio::sync::{mpsc, Mutex};
use tracing::{debug, info, warn};

use crate::fragmentation::{fragment, Reassembler};
use crate::uuids::{CHAR_PROOF, CHAR_REQUEST, FERNLINK_SERVICE};

/// Manages BLE scanning and connections to Fernlink peripherals.
///
/// `new()` returns `(central, proof_rx)` so the receiver can be moved into a
/// dedicated collection task while `central` is wrapped in `Arc` for shared
/// use of `broadcast_request`.
pub struct FernlinkCentral {
    manager: Manager,
    peers:   Arc<Mutex<HashMap<String, Peripheral>>>,
    proof_tx: mpsc::Sender<Vec<u8>>,
}

impl FernlinkCentral {
    pub async fn new() -> Result<(Self, mpsc::Receiver<Vec<u8>>)> {
        let manager = Manager::new().await?;
        let (proof_tx, proof_rx) = mpsc::channel(64);
        Ok((Self { manager, peers: Arc::new(Mutex::new(HashMap::new())), proof_tx }, proof_rx))
    }

    /// Start scanning and spawn a background task per discovered peer.
    pub async fn start_scanning(self: &Arc<Self>) -> Result<()> {
        let adapters = self.manager.adapters().await?;
        let adapter  = adapters.into_iter().next()
            .ok_or_else(|| anyhow::anyhow!("no BLE adapter found"))?;

        adapter.start_scan(ScanFilter { services: vec![FERNLINK_SERVICE] }).await?;
        info!("BLE scan started");

        let peers    = Arc::clone(&self.peers);
        let proof_tx = self.proof_tx.clone();

        tokio::spawn(async move {
            let mut events = match adapter.events().await {
                Ok(e) => e,
                Err(e) => { warn!("adapter events error: {e}"); return; }
            };
            while let Some(event) = events.next().await {
                use btleplug::api::CentralEvent::DeviceDiscovered;
                if let DeviceDiscovered(id) = event {
                    let Ok(peripheral) = adapter.peripheral(&id).await else { continue };
                    let addr = peripheral.address().to_string();
                    if peers.lock().await.contains_key(&addr) { continue; }

                    info!("discovered peer {addr}");
                    let peers2    = Arc::clone(&peers);
                    let proof_tx2 = proof_tx.clone();
                    tokio::spawn(async move {
                        if let Err(e) = connect_peer(peripheral, peers2, proof_tx2).await {
                            warn!("peer {addr} error: {e}");
                        }
                    });
                }
            }
        });

        Ok(())
    }

    pub async fn connected_peer_count(&self) -> usize {
        self.peers.lock().await.len()
    }

    /// Write a fragmented request payload to every connected peer.
    pub async fn broadcast_request(&self, payload: &[u8]) -> Result<()> {
        let fragments = fragment(payload)?;
        let peers = self.peers.lock().await;
        for peer in peers.values() {
            let chars = peer.characteristics();
            let Some(req_char) = chars.iter().find(|c| c.uuid == CHAR_REQUEST) else { continue };
            for frag in &fragments {
                if let Err(e) = peer.write(req_char, frag, WriteType::WithoutResponse).await {
                    warn!("write error: {e}");
                }
            }
        }
        Ok(())
    }
}

async fn connect_peer(
    peripheral: Peripheral,
    peers:      Arc<Mutex<HashMap<String, Peripheral>>>,
    proof_tx:   mpsc::Sender<Vec<u8>>,
) -> Result<()> {
    peripheral.connect().await?;
    peripheral.discover_services().await?;

    let chars      = peripheral.characteristics();
    let proof_char = chars.iter()
        .find(|c| c.uuid == CHAR_PROOF)
        .ok_or_else(|| anyhow::anyhow!("PROOF characteristic not found"))?
        .clone();

    peripheral.subscribe(&proof_char).await?;

    let addr = peripheral.address().to_string();
    peers.lock().await.insert(addr.clone(), peripheral.clone());
    info!("connected to {addr}");

    let mut notifications = peripheral.notifications().await?;
    let mut reassemblers: HashMap<u8, Reassembler> = HashMap::new();

    while let Some(notif) = notifications.next().await {
        if notif.uuid != CHAR_PROOF { continue; }
        let key = notif.value.first().copied().unwrap_or(0);
        if let Some(complete) = reassemblers.entry(key).or_default().feed(&notif.value) {
            debug!("complete proof from {addr} ({} bytes)", complete.len());
            let _ = proof_tx.send(complete).await;
            reassemblers.remove(&key);
        }
    }

    peers.lock().await.remove(&addr);
    info!("peer {addr} disconnected");
    Ok(())
}
