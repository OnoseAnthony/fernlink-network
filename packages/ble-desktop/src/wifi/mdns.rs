use std::collections::HashMap;
use std::sync::mpsc;
use anyhow::Result;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
const SERVICE_TYPE: &str = "_fernlink._tcp.local.";

pub struct PeerInfo {
    pub host:   String,
    pub port:   u16,
    pub pubkey: String,
}

pub struct MdnsService {
    daemon: ServiceDaemon,
}

impl MdnsService {
    pub fn new(port: u16, pubkey_hex: &str) -> Result<Self> {
        let daemon = ServiceDaemon::new()
            .map_err(|e| anyhow::anyhow!("mdns daemon: {e}"))?;

        let short         = &pubkey_hex[..8.min(pubkey_hex.len())];
        let instance_name = format!("fernlink-{short}");
        let host_name     = format!("{instance_name}.local.");
        let host_ip       = local_ip();

        let mut props = HashMap::new();
        props.insert("pk".to_string(), pubkey_hex.to_string());

        let info = ServiceInfo::new(
            SERVICE_TYPE,
            &instance_name,
            &host_name,
            host_ip.as_str(),
            port,
            Some(props),
        ).map_err(|e| anyhow::anyhow!("service info: {e}"))?;

        daemon.register(info)
            .map_err(|e| anyhow::anyhow!("mdns register: {e}"))?;

        Ok(Self { daemon })
    }

    /// Start browsing; returns a receiver that yields resolved peer infos.
    /// Spawns a background thread to handle the blocking mDNS receiver.
    pub fn start_browse(&self) -> Result<mpsc::Receiver<PeerInfo>> {
        let browse_rx = self.daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| anyhow::anyhow!("mdns browse: {e}"))?;

        let (tx, rx) = mpsc::channel();

        std::thread::spawn(move || {
            while let Ok(event) = browse_rx.recv() {
                if let ServiceEvent::ServiceResolved(info) = event {
                    let pk = match get_pk(&info) {
                        Some(p) if !p.is_empty() => p,
                        _ => continue,
                    };
                    let Some(addr) = info.get_addresses().iter().next() else { continue };
                    let peer = PeerInfo {
                        host:   addr.to_string(),
                        port:   info.get_port(),
                        pubkey: pk,
                    };
                    if tx.send(peer).is_err() {
                        break;
                    }
                }
            }
        });

        Ok(rx)
    }
}

fn get_pk(info: &ServiceInfo) -> Option<String> {
    // mdns-sd 0.9 returns TxtProperties; access via .get(key) -> Option<&TxtProperty>
    // then .val_str() -> Option<Cow<str>> to retrieve the UTF-8 value.
    // mdns-sd 0.9: TxtProperty::val_str() -> &str (always returns a string)
    info.get_properties()
        .get("pk")
        .map(|p| p.val_str().to_owned())
}

/// Get the local outbound IP via a UDP socket (no traffic is sent).
fn local_ip() -> String {
    std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| { s.connect("8.8.8.8:80")?; s.local_addr() })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}
