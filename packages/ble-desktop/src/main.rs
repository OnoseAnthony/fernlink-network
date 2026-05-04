mod central;
mod fragmentation;
mod peripheral;
mod rpc;
mod router;
mod uuids;

use std::sync::Arc;

use anyhow::Result;
use clap::Parser;
use fernlink_core::crypto::Keypair;
use tokio::sync::Mutex;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "fernlink-node", about = "Fernlink desktop BLE mesh node")]
struct Cli {
    /// Solana RPC endpoint
    #[arg(long, default_value = "https://api.mainnet-beta.solana.com")]
    rpc: String,

    /// 32-byte hex keypair seed (a fresh one is generated if omitted)
    #[arg(long)]
    seed: Option<String>,

    /// Device name advertised over BLE (Linux peripheral only)
    #[arg(long, default_value = "Fernlink Node")]
    name: String,

    /// Minimum matching proofs required for consensus
    #[arg(long, default_value_t = 2)]
    min_proofs: usize,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("fernlink=info".parse()?))
        .init();

    let cli = Cli::parse();

    let keypair = match &cli.seed {
        Some(hex) => {
            let arr: [u8; 32] = hex::decode(hex)?
                .try_into()
                .map_err(|_| anyhow::anyhow!("seed must be exactly 32 bytes"))?;
            Keypair::from_bytes(&arr)
        }
        None => Keypair::generate(),
    };

    let pubkey: String = keypair.public_key_bytes().iter().map(|b| format!("{b:02x}")).collect();
    info!("public key: {pubkey}");

    // ── Central (cross-platform scanner + client) ─────────────────────────────
    let (central, proof_rx) = central::FernlinkCentral::new().await?;
    let central = Arc::new(central);
    central.start_scanning().await?;

    let proof_store: router::ProofStore = Arc::new(Mutex::new(vec![]));

    // ── Linux: peripheral (GATT server + advertiser) ──────────────────────────
    #[cfg(target_os = "linux")]
    let (peripheral, request_rx) = peripheral::FernlinkPeripheral::start(&cli.name).await?;
    #[cfg(target_os = "linux")]
    let peripheral = Arc::new(peripheral);

    // ── Task: handle incoming REQUEST writes from the GATT server (Linux) ─────
    #[cfg(target_os = "linux")]
    {
        let central2    = Arc::clone(&central);
        let peripheral2 = Arc::clone(&peripheral);
        let rpc_url     = cli.rpc.clone();
        let seed        = keypair.signing_key.to_bytes();
        let mut req_rx  = request_rx;

        tokio::spawn(async move {
            let kp = Keypair::from_bytes(&seed);
            while let Some(payload) = req_rx.recv().await {
                let c = Arc::clone(&central2);
                let p = Arc::clone(&peripheral2);
                let url = rpc_url.clone();
                let seed2 = kp.signing_key.to_bytes();
                tokio::spawn(async move {
                    let kp2 = Keypair::from_bytes(&seed2);
                    if let Err(e) = router::handle_request(payload, &kp2, &url, &c, &p).await {
                        tracing::warn!("request handler error: {e}");
                    }
                });
            }
        });
    }

    // ── Task: collect proofs from peers, forward upstream (Linux) ────────────
    #[cfg(target_os = "linux")]
    {
        let store       = Arc::clone(&proof_store);
        let peripheral2 = Arc::clone(&peripheral);
        tokio::spawn(router::collect_proofs(proof_rx, store, peripheral2));
    }

    // ── macOS / Windows: central-only, no advertising ─────────────────────────
    #[cfg(not(target_os = "linux"))]
    {
        let store = Arc::clone(&proof_store);
        tokio::spawn(router::collect_proofs(proof_rx, store));
        info!("peripheral role requires Linux; running as central-only (scan + verify for others)");
    }

    // ── Status loop ───────────────────────────────────────────────────────────
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        let peers = central.connected_peer_count().await;
        let proofs = proof_store.lock().await.len();
        info!("peers: {peers}  proofs collected: {proofs}");
    }
}
