/**
 * Testnet bridge — live status of the public **Polygon Sepolia** chain via
 * keyless public JSON-RPC endpoints (read-only).
 *
 * Purpose for the hackathon story:
 *  - proves the settlement design is chain-shaped (blocks, hashes, peers —
 *    the same primitives our embedded ledger uses),
 *  - shows the integration point where a deployed `EnergyPool` contract and
 *    a funded operator key would broadcast our blocks to the public chain.
 *
 * The sandbox may have no internet egress: every read fails fast (6s budget)
 * and reports `online: false` so the app keeps running on its embedded ledger.
 *
 * SERVER-ONLY. Never import from client code.
 */
import type { TestnetStatus } from "./types";

const RPC_ENDPOINTS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon-sepolia.public.blastapi.io",
  "https://rpc-sepolia.org",
  "https://polygon-sepolia.gateway.tenderly.co",
];

const RPC_TIMEOUT_MS = 6000;

type RpcResult = { result?: unknown; error?: { message?: string } };

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const body = (await res.json()) as RpcResult;
    if (body.error) throw new Error(body.error.message ?? "RPC error");
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcFirst(method: string, params: unknown[]): Promise<unknown> {
  let lastErr: unknown = null;
  for (const url of RPC_ENDPOINTS) {
    try {
      return await rpc(url, method, params);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all RPC endpoints failed");
}

let cache: { at: number; status: TestnetStatus } | null = null;
const CACHE_TTL_MS = 20_000;

export async function getTestnetStatus(force = false): Promise<TestnetStatus> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.status;

  const status: TestnetStatus = {
    chain: "Polygon Sepolia",
    online: false,
    blockNumber: null,
    latestBlockHash: null,
    peerCount: null,
    error: null,
    checkedAt: Date.now(),
  };

  try {
    const blockNumberHex = (await rpcFirst("eth_blockNumber", [])) as string;
    status.blockNumber = parseInt(blockNumberHex, 16);
    const block = (await rpcFirst("eth_getBlockByNumber", ["latest", false])) as
      | { hash?: string }
      | null;
    status.latestBlockHash = block?.hash ?? null;
    const peerHex = (await rpcFirst("net_peerCount", [])) as string;
    status.peerCount = parseInt(peerHex, 16);
    status.online = true;
  } catch (err) {
    status.error = err instanceof Error ? err.message : "testnet unreachable";
  }

  cache = { at: Date.now(), status };
  return status;
}
