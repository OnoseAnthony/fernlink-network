import type { TxStatus } from "./types.js";

export interface RpcConfirmation {
  status: TxStatus;
  slot: number;
  blockTime: number;
  error?: string;
}

/**
 * Query a Solana JSON-RPC endpoint for the confirmation status of a transaction.
 */
export async function getSignatureStatus(
  rpcEndpoint: string,
  signature: string
): Promise<RpcConfirmation> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getSignatureStatuses",
    params: [[signature], { searchTransactionHistory: true }],
  };

  const res = await fetch(rpcEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP error: ${res.status}`);
  }

  const json = await res.json() as {
    result?: { value: Array<{ slot: number; confirmationStatus?: string; err?: unknown } | null> };
    error?: { message: string };
  };

  if (json.error) throw new Error(`RPC error: ${json.error.message}`);

  const value = json.result?.value?.[0];
  if (!value) {
    return { status: "unknown", slot: 0, blockTime: 0 };
  }

  return {
    status: value.err ? "failed" : "confirmed",
    slot: value.slot,
    blockTime: 0,
    error: value.err ? JSON.stringify(value.err) : undefined,
  };
}
