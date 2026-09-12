/**
 * Public-chain bridge — a **read-only** status feed for Polygon's PoS testnet
 * (**Amoy**, chainId 80002) via keyless public JSON-RPC endpoints.
 *
 * Purpose for the pitch:
 *  - proves the settlement design is chain-shaped (blocks, hashes, peers — the
 *    same primitives the embedded ledger uses),
 *  - shows the integration point where a deployed `EnergyPool` contract and a
 *    funded operator key would broadcast SolarShare blocks publicly.
 *
 * What changed vs. the first version (the "the live URL keeps changing and I
 * can't read it" bug):
 *  - **One network only.** The old list mixed a Polygon *mainnet* URL with
 *    testnet URLs, so consecutive refreshes could report different chains —
 *    different block numbers, different hashes, no stable reading. Every
 *    endpoint is now Amoy, and `eth_chainId` is verified before a reading is
 *    accepted (`wrong-network` readings are discarded, never displayed).
 *  - **Sticky endpoint.** The last healthy endpoint is remembered and tried
 *    first, so the displayed URL stops rotating between providers.
 *  - **Pinnable.** Set `SOLARSHARE_RPC_URL` to pin one endpoint (your own
 *    Alchemy/Infura/QuickNode URL) — then nothing rotates at all.
 *  - **Stale-while-revalidate + monotonic head.** When the environment has no
 *    egress (this sandbox), the last known good head is served with `stale`
 *    and its age instead of blanking out, and a lagging RPC can never move the
 *    displayed block number backwards.
 *  - **Readable output.** Classified `reason` + plain-language `headline` /
 *    `detail`, latency, explorer deep links, block timestamp — no raw
 *    "RPC HTTP 429" strings in the UI.
 *
 * SERVER-ONLY. Never import from client code (the pure helpers live in
 * `network-core.ts`, which is safe anywhere).
 */
import { env } from "../env.server";
import type { TestnetStatus } from "./types";
import {
  BRIDGE_NETWORK,
  RPC_ENDPOINTS,
  classifyRpcFailure,
  explorerBlockUrl,
  explorerHashUrl,
  hexBlockTimeToIso,
  hexToNumber,
  keepMonotonicHead,
  onlineCopy,
  orderEndpoints,
  staleCopy,
  type BridgeReason,
  type RpcEndpoint,
} from "./network-core";

const RPC_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 15_000;
/** Serve the last good reading for up to an hour before dropping it. */
const STALE_MAX_AGE_MS = 60 * 60_000;

type RpcResult = { result?: unknown; error?: { message?: string; code?: number } };

type RpcFailure = Error & { status?: number; wrongNetwork?: boolean; gotChainId?: number };

async function rpc(endpoint: RpcEndpoint, method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err: RpcFailure = new Error(`RPC HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const body = (await res.json()) as RpcResult;
    if (body.error) throw new Error(body.error.message ?? "RPC error");
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

/** A pinned endpoint (env) is always tried first and reported as `pinned`. */
function configuredEndpoints(): { endpoints: RpcEndpoint[]; pinned: boolean } {
  const custom = env("SOLARSHARE_RPC_URL") ?? env("POLYGON_RPC_URL");
  if (!custom) return { endpoints: RPC_ENDPOINTS, pinned: false };
  let host = "custom RPC";
  try {
    host = new URL(custom).host;
  } catch {
    /* keep the generic label */
  }
  return {
    endpoints: [{ url: custom, label: host, provider: "Pinned (SOLARSHARE_RPC_URL)" }, ...RPC_ENDPOINTS],
    pinned: true,
  };
}

type Cache = {
  at: number;
  status: TestnetStatus;
  /** Last endpoint that produced a verified reading — sticky preference. */
  stickyUrl: string | null;
  lastGood: { blockNumber: number | null; latestBlockHash: string | null; latestBlockTime: string | null; peerCount: number | null; endpoint: RpcEndpoint | null } | null;
};

let cache: Cache | null = null;

function emptyStatus(now: number, reason: BridgeReason, headline: string, detail: string): TestnetStatus {
  return {
    chain: BRIDGE_NETWORK.label,
    network: BRIDGE_NETWORK.id,
    networkKind: BRIDGE_NETWORK.kind,
    chainId: null,
    chainIdExpected: BRIDGE_NETWORK.chainId,
    explorerName: BRIDGE_NETWORK.explorerName,
    online: false,
    stale: false,
    pinned: false,
    blockNumber: null,
    latestBlockHash: null,
    latestBlockTime: null,
    peerCount: null,
    syncing: false,
    latencyMs: null,
    endpoint: null,
    endpointsTried: [],
    explorerBlockUrl: null,
    explorerHashUrl: null,
    reason,
    headline,
    detail,
    error: null,
    checkedAt: now,
    ageMs: 0,
    nextCheckInMs: CACHE_TTL_MS,
  };
}

export async function getTestnetStatus(force = false): Promise<TestnetStatus> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL_MS) {
    return { ...cache.status, ageMs: Math.max(0, now - cache.at), nextCheckInMs: Math.max(0, CACHE_TTL_MS - (now - cache.at)) };
  }

  const { endpoints, pinned } = configuredEndpoints();
  const ordered = orderEndpoints(endpoints, cache?.stickyUrl);
  const tried: string[] = [];
  let lastFailure: { reason: BridgeReason; headline: string; detail: string; raw: string } | null = null;

  for (const endpoint of ordered) {
    const startedAt = Date.now();
    try {
      // 1. Verify the network identity FIRST — never display another chain's head.
      const chainId = hexToNumber(await rpc(endpoint, "eth_chainId", []));
      if (chainId !== BRIDGE_NETWORK.chainId) {
        const err: RpcFailure = new Error(`chainId ${chainId ?? "unknown"} != ${BRIDGE_NETWORK.chainId}`);
        err.wrongNetwork = true;
        err.gotChainId = chainId ?? undefined;
        throw err;
      }

      // 2. Head, hash, timestamp, peers.
      const blockNumber = hexToNumber(await rpc(endpoint, "eth_blockNumber", []));
      const block = (await rpc(endpoint, "eth_getBlockByNumber", ["latest", false])) as
        | { hash?: string; timestamp?: string }
        | null;
      const peerCount = hexToNumber(await rpc(endpoint, "net_peerCount", []));
      const syncingRaw = await rpc(endpoint, "eth_syncing", []).catch(() => false);
      const latencyMs = Date.now() - startedAt;
      tried.push(endpoint.label);

      const reading = {
        blockNumber,
        latestBlockHash: block?.hash ?? null,
        latestBlockTime: hexBlockTimeToIso(block?.timestamp),
        peerCount,
        endpoint: { url: endpoint.url, label: endpoint.label, provider: endpoint.provider },
      };
      const head = keepMonotonicHead(cache?.lastGood ?? null, reading);
      const copy = onlineCopy(head.blockNumber, latencyMs);

      const status: TestnetStatus = {
        ...emptyStatus(Date.now(), "ok", copy.headline, copy.detail),
        chainId: BRIDGE_NETWORK.chainId,
        online: true,
        stale: false,
        pinned,
        blockNumber: head.blockNumber,
        latestBlockHash: head.latestBlockHash,
        latestBlockTime: head.latestBlockTime,
        peerCount: head.peerCount,
        syncing: Boolean(syncingRaw),
        latencyMs,
        endpoint: head.endpoint,
        endpointsTried: tried,
        explorerBlockUrl: explorerBlockUrl(head.blockNumber),
        explorerHashUrl: explorerHashUrl(head.latestBlockHash),
        error: null,
        ageMs: 0,
        nextCheckInMs: CACHE_TTL_MS,
      };

      cache = { at: Date.now(), status, stickyUrl: endpoint.url, lastGood: head };
      return status;
    } catch (err) {
      tried.push(endpoint.label);
      const e = err as RpcFailure;
      const failure = classifyRpcFailure({
        status: e.status,
        name: e.name,
        message: e.message,
        wrongNetwork: e.wrongNetwork,
        gotChainId: e.gotChainId,
      });
      lastFailure = { ...failure, raw: e.message ?? String(err) };
      // No egress at all → the rest of the list will fail the same way. Fail fast
      // so the dialog answers immediately instead of burning 6s per endpoint.
      if (failure.reason === "no-egress" && !pinned) break;
    }
  }

  const failure =
    lastFailure ??
    (() => {
      const fallback = classifyRpcFailure({
        message: "all RPC endpoints failed",
        name: "TypeError",
      });
      return { ...fallback, raw: "all RPC endpoints failed" };
    })();

  // Stale-while-revalidate: keep showing the last verified head, labelled as old.
  const lastGood = cache?.lastGood ?? null;
  const lastAt = cache?.at ?? now;
  const ageMs = Math.max(0, now - lastAt);
  const freshEnough = lastGood?.blockNumber != null && ageMs < STALE_MAX_AGE_MS;
  const copy = freshEnough ? staleCopy(ageMs, failure.reason) : failure;

  const status: TestnetStatus = {
    ...emptyStatus(now, copy.reason, copy.headline, copy.detail ?? failure.detail),
    pinned,
    stale: freshEnough,
    blockNumber: freshEnough ? lastGood?.blockNumber ?? null : null,
    latestBlockHash: freshEnough ? lastGood?.latestBlockHash ?? null : null,
    latestBlockTime: freshEnough ? lastGood?.latestBlockTime ?? null : null,
    peerCount: freshEnough ? lastGood?.peerCount ?? null : null,
    endpoint: freshEnough ? lastGood?.endpoint ?? null : null,
    endpointsTried: tried,
    explorerBlockUrl: freshEnough ? explorerBlockUrl(lastGood?.blockNumber ?? null) : null,
    explorerHashUrl: freshEnough ? explorerHashUrl(lastGood?.latestBlockHash ?? null) : null,
    error: failure.raw,
    checkedAt: now,
    ageMs: freshEnough ? ageMs : 0,
    nextCheckInMs: CACHE_TTL_MS,
  };

  cache = { at: now, status, stickyUrl: cache?.stickyUrl ?? null, lastGood };
  return status;
}

/** Last served reading without hitting the network (used by the UI poller). */
export function peekTestnetStatus(): TestnetStatus | null {
  return cache?.status ?? null;
}
