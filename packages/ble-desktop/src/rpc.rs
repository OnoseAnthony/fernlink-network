use anyhow::{bail, Result};
use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TxStatus {
    Confirmed,
    Failed,
    Unknown,
}

#[derive(Debug)]
pub struct ConfirmationStatus {
    pub status:     TxStatus,
    pub slot:       u64,
    pub block_time: u64,
}

#[derive(Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error:  Option<RpcError>,
}
#[derive(Deserialize)]
struct RpcError { message: String }

#[derive(Deserialize)]
struct SigStatusResult { value: Vec<Option<SigStatus>> }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SigStatus {
    slot:                u64,
    confirmation_status: Option<String>,
    err:                 Option<serde_json::Value>,
}

pub async fn get_signature_status(rpc_url: &str, sig: &str) -> Result<ConfirmationStatus> {
    let body = serde_json::json!({
        "jsonrpc": "2.0", "id": 1,
        "method": "getSignatureStatuses",
        "params": [[sig], { "searchTransactionHistory": true }]
    });

    let resp = reqwest::Client::new()
        .post(rpc_url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?
        .json::<RpcResponse<SigStatusResult>>()
        .await?;

    if let Some(e) = resp.error { bail!("RPC error: {}", e.message); }

    let result = resp.result.ok_or_else(|| anyhow::anyhow!("empty RPC result"))?;
    let status = result.value.into_iter().next().flatten();

    match status {
        None => Ok(ConfirmationStatus { status: TxStatus::Unknown, slot: 0, block_time: 0 }),
        Some(s) => Ok(ConfirmationStatus {
            status: if s.err.is_some() { TxStatus::Failed } else { TxStatus::Confirmed },
            slot: s.slot,
            block_time: 0,
        }),
    }
}
