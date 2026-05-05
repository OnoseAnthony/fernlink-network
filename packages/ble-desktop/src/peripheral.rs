#![cfg(target_os = "linux")]

use anyhow::Result;
use std::sync::{Arc, Mutex};
use bluer::{
    adv::{Advertisement, AdvertisementHandle},
    gatt::local::{
        Application, ApplicationHandle, Characteristic, CharacteristicNotify,
        CharacteristicNotifyMethod, CharacteristicWrite, CharacteristicWriteMethod, Service,
    },
    Adapter, Session,
};
use tokio::sync::mpsc;
use tracing::info;

use crate::fragmentation::{fragment, Reassembler};
use crate::uuids::{CHAR_PROOF, CHAR_REQUEST, CHAR_STATUS, FERNLINK_SERVICE};

/// Advertises the Fernlink GATT service.
///
/// `start()` returns `(peripheral, request_rx)` so the receiver can be moved
/// into a dedicated task while `peripheral` is wrapped in `Arc` for shared use.
pub struct FernlinkPeripheral {
    _adv:     AdvertisementHandle,
    _app:     ApplicationHandle,
    proof_tx: mpsc::Sender<Vec<u8>>,
}

impl FernlinkPeripheral {
    /// Start advertising. Returns the peripheral handle and an exclusive
    /// receiver for fully-reassembled incoming REQUEST payloads.
    pub async fn start(device_name: &str) -> Result<(Self, mpsc::Receiver<Vec<u8>>)> {
        let session = Session::new().await?;
        let adapter = session.default_adapter().await?;
        adapter.set_powered(true).await?;

        let (request_tx, request_rx) = mpsc::channel::<Vec<u8>>(32);
        let (proof_tx, mut proof_stream) = mpsc::channel::<Vec<u8>>(32);
        let (notify_tx, _) = tokio::sync::broadcast::channel::<Vec<u8>>(32);
        let notify_tx_clone = notify_tx.clone();

        tokio::spawn(async move {
            while let Some(frag) = proof_stream.recv().await {
                let _ = notify_tx_clone.send(frag);
            }
        });

        let app = build_application(request_tx, notify_tx);
        let app_handle = adapter.serve_gatt_application(app).await?;
        let adv_handle = advertise(&adapter, device_name).await?;
        info!("Fernlink peripheral advertising as '{device_name}'");

        Ok((Self { _adv: adv_handle, _app: app_handle, proof_tx }, request_rx))
    }

    /// Send a signed proof to all subscribed centrals (fragmented if needed).
    pub async fn send_proof(&self, proof_bytes: &[u8]) -> Result<()> {
        for frag in fragment(proof_bytes)? {
            self.proof_tx.send(frag).await?;
        }
        Ok(())
    }
}

fn build_application(
    request_tx: mpsc::Sender<Vec<u8>>,
    notify_tx: tokio::sync::broadcast::Sender<Vec<u8>>,
) -> Application {
    let reassembler = Arc::new(Mutex::new(Reassembler::default()));

    let request_char = Characteristic {
        uuid: CHAR_REQUEST,
        write: Some(CharacteristicWrite {
            write: true,
            write_without_response: true,
            method: CharacteristicWriteMethod::Fun(Box::new(move |data, _| {
                let tx           = request_tx.clone();
                let reassembler  = reassembler.clone();
                Box::pin(async move {
                    let complete = reassembler.lock().unwrap().feed(&data);
                    if let Some(complete) = complete {
                        let _ = tx.send(complete).await;
                    }
                    Ok(())
                })
            })),
            ..Default::default()
        }),
        ..Default::default()
    };

    let proof_char = Characteristic {
        uuid: CHAR_PROOF,
        notify: Some(CharacteristicNotify {
            notify: true,
            method: CharacteristicNotifyMethod::Fun(Box::new(move |mut notifier| {
                let mut rx = notify_tx.subscribe();
                Box::pin(async move {
                    while let Ok(data) = rx.recv().await {
                        if notifier.is_stopped() { break; }
                        let _ = notifier.notify(data).await;
                    }
                })
            })),
            ..Default::default()
        }),
        ..Default::default()
    };

    let status_char = Characteristic {
        uuid: CHAR_STATUS,
        read: Some(bluer::gatt::local::CharacteristicRead {
            read: true,
            fun: Box::new(|_| Box::pin(async {
                Ok(br#"{"version":1,"commitment":["confirmed","finalized"]}"#.to_vec())
            })),
            ..Default::default()
        }),
        ..Default::default()
    };

    Application {
        services: vec![Service {
            uuid: FERNLINK_SERVICE,
            primary: true,
            characteristics: vec![request_char, proof_char, status_char],
            ..Default::default()
        }],
        ..Default::default()
    }
}

async fn advertise(adapter: &Adapter, name: &str) -> Result<AdvertisementHandle> {
    Ok(adapter.advertise(Advertisement {
        service_uuids: std::collections::BTreeSet::from([FERNLINK_SERVICE]),
        local_name: Some(name.to_string()),
        discoverable: Some(true),
        ..Default::default()
    }).await?)
}
