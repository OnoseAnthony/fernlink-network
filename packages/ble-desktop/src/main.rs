mod central;
mod fragmentation;
mod peripheral;
mod rpc;
mod router;
mod transport;
mod uuids;

use std::sync::Arc;

use anyhow::Result;
use clap::Parser;
use fernlink_core::crypto::Keypair;
use tracing::info;
use tracing_subscriber::EnvFilter;

use transport::TransportHandle;

#[derive(Parser)]
#[command(name = "fernlink-node", about = "Fernlink desktop BLE mesh node")]
struct Cli {
    #[arg(long, default_value = "https://api.mainnet-beta.solana.com")]
    rpc: String,

    #[arg(long)]
    seed: Option<String>,

    #[arg(long, default_value = "Fernlink Node")]
    name: String,

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

    let mut ble_handle = build_ble_transport(&cli.name).await?;
    router::run_router(&mut ble_handle, &keypair, &cli.rpc).await;

    let proof_store = Arc::clone(&ble_handle.proof_store);

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        let peers  = (ble_handle.connected_peer_count)();
        let proofs = proof_store.lock().await.len();
        info!("peers: {peers}  proofs collected: {proofs}");
    }
}

/// Build a TransportHandle over BLE (central always-on; peripheral on Linux only).
async fn build_ble_transport(name: &str) -> Result<TransportHandle> {
    let (central, proof_rx) = central::FernlinkCentral::new().await?;
    let central = Arc::new(central);
    central.start_scanning().await?;

    let peer_count = {
        let c = Arc::clone(&central);
        Arc::new(move || {
            // connected_peer_count is async; we use a blocking snapshot via try_lock
            // In practice this is called from the status loop, never in hot path.
            futures::executor::block_on(c.connected_peer_count())
        }) as Arc<dyn Fn() -> usize + Send + Sync>
    };

    let send_request = {
        let c = Arc::clone(&central);
        Arc::new(move |data: Vec<u8>| {
            let c2 = Arc::clone(&c);
            Box::pin(async move {
                c2.broadcast_request(&data).await
            }) as std::pin::Pin<Box<dyn std::future::Future<Output = anyhow::Result<()>> + Send>>
        }) as transport::SendFn
    };

    // On Linux: peripheral available (GATT server + advertiser)
    #[cfg(target_os = "linux")]
    {
        let (peripheral, request_rx) =
            peripheral::FernlinkPeripheral::start(name).await?;
        let peripheral = Arc::new(peripheral);

        let send_proof = {
            let p = Arc::clone(&peripheral);
            Arc::new(move |data: Vec<u8>| {
                let p2 = Arc::clone(&p);
                Box::pin(async move {
                    p2.send_proof(&data).await
                }) as std::pin::Pin<Box<dyn std::future::Future<Output = anyhow::Result<()>> + Send>>
            }) as transport::SendFn
        };

        return Ok(TransportHandle::new(
            Some(request_rx),
            proof_rx,
            send_proof,
            send_request,
            peer_count,
        ));
    }

    // macOS / Windows: central-only, no peripheral advertising
    #[cfg(not(target_os = "linux"))]
    {
        info!("peripheral role requires Linux; running as central-only");
        let send_proof = Arc::new(|_data: Vec<u8>| {
            Box::pin(async { Ok(()) })
                as std::pin::Pin<Box<dyn std::future::Future<Output = anyhow::Result<()>> + Send>>
        }) as transport::SendFn;

        Ok(TransportHandle::new(
            None,
            proof_rx,
            send_proof,
            send_request,
            peer_count,
        ))
    }
}
