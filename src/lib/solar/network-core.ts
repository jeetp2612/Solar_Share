/**
 * Pure, isomorphic helpers for the public-chain bridge (no fetch, no node APIs)
 * so the "live network" panel can be reasoned about — and unit tested — without
 * touching the network.
 *
 * Two problems this module exists to solve:
 *
 *  1. **The reported endpoint used to jump around.** The bridge tried a list of
 *     public RPCs in a fixed order and reported whichever happened to answer,
 *     and that list mixed *different networks* (a Polygon **mainnet** URL sat
 *     next to testnet URLs), so the block number and hash changed identity
 *     between refreshes and could even go backwards. Every endpoint here is
 *     pinned to one network (Polygon **Amoy**, the Polygon PoS testnet,
 *     chainId 80002) and the chainId is verified before a reading is accepted.
 *     The last healthy endpoint becomes "sticky" and is tried first, so the
 *     displayed URL stays put.
 *
 *  2. **The status was unreadable.** Raw JSON-RPC errors ("RPC HTTP 429",
 *     "The operation was aborted") were surfaced verbatim. Everything is now
 *     classified into a `reason` plus a plain-language `headline`/`detail`, and
 *     hashes are grouped so a human can actually read and compare them.
 */

/** The public chain the bridge reads (read-only, no keys, no writes). */
export const BRIDGE_NETWORK = {
  id: "polygon-amoy",
  /** Display name. Polygon's PoS testnet is Amoy (there is no "Polygon Sepolia"). */
  label: "Polygon Amoy",
  kind: "testnet" as const,
  chainId: 80002,
  nativeCurrency: "POL",
  explorerName: "PolygonScan (Amoy)",
  explorerBase: "https://amoy.polygonscan.com",
  /** ~2s blocks on Amoy — used to estimate how fresh a head is. */
  blockTimeMs: 2000,
};

export type RpcEndpoint = {
  url: string;
  /** Short, human label shown in the UI instead of a long URL. */
  label: string;
  /** Who runs it (used in the "why did this fail" copy). */
  provider: string;
};

/**
 * Keyless public RPCs, all serving **Polygon Amoy (80002)**. Order = preference;
 * the sticky last-healthy endpoint is promoted to the front at runtime.
 */
export const RPC_ENDPOINTS: RpcEndpoint[] = [
  { url: "https://rpc-amoy.polygon.technology", label: "polygon.technology", provider: "Polygon Labs" },
  { url: "https://polygon-amoy-bor-rpc.publicnode.com", label: "publicnode.com", provider: "PublicNode" },
  { url: "https://polygon-amoy.gateway.tenderly.co", label: "gateway.tenderly.co", provider: "Tenderly" },
  { url: "https://polygon-amoy.blockpi.network/v1/rpc/public", label: "blockpi.network", provider: "BlockPI" },
  { url: "https://polygon-amoy.drpc.org", label: "drpc.org", provider: "dRPC" },
  { url: "https://1rpc.io/amoy", label: "1rpc.io", provider: "1RPC" },
];

/** Why a bridge reading is not live. Drives the plain-language copy. */
export type BridgeReason =
  | "ok"
  | "checking"
  | "no-egress"
  | "timeout"
  | "rate-limited"
  | "http-error"
  | "wrong-network"
  | "rpc-error";

export type RpcFailureInput = {
  /** HTTP status, when the call got that far. */
  status?: number;
  /** Error name, e.g. "AbortError" or "TypeError". */
  name?: string;
  /** Raw message — kept for the debug line only. */
  message?: string;
  /** Set when the endpoint answered but for a different chainId. */
  wrongNetwork?: boolean;
  gotChainId?: number;
};

export type RpcFailure = {
  reason: BridgeReason;
  headline: string;
  detail: string;
};

const REASON_COPY: Record<Exclude<BridgeReason, "ok">, { headline: string; detail: string }> = {
  checking: {
    headline: "Reading the public chain…",
    detail: "First read of this session — the embedded SolarShare ledger is already authoritative.",
  },
  "no-egress": {
    headline: "No outbound internet from this environment",
    detail:
      "This sandbox/deployment cannot reach public RPC hosts, so the live head cannot be read. Every SolarShare trade still settles and hashes on the embedded Postgres ledger — nothing is blocked by this.",
  },
  timeout: {
    headline: "Public RPC timed out",
    detail:
      "The endpoint did not answer inside the read budget. The bridge keeps the last known head and retries on the next refresh.",
  },
  "rate-limited": {
    headline: "Public RPC rate limit",
    detail:
      "Keyless public endpoints throttle bursts. The bridge keeps the last known head and falls back to the next provider on the next refresh.",
  },
  "http-error": {
    headline: "Public RPC returned an HTTP error",
    detail: "The endpoint responded but not with data. Another provider is tried on the next refresh.",
  },
  "wrong-network": {
    headline: "Endpoint served a different network",
    detail:
      "The RPC answered with a chainId that is not Polygon Amoy (80002), so the reading is discarded rather than shown — mixing networks is what makes block numbers jump around.",
  },
  "rpc-error": {
    headline: "Public RPC rejected the call",
    detail: "The endpoint returned a JSON-RPC error. Another provider is tried on the next refresh.",
  },
};

/**
 * Turn any fetch/RPC failure into a classified, human-readable reason.
 * Deterministic and dependency-free so it can be unit tested.
 */
export function classifyRpcFailure(input: RpcFailureInput = {}): RpcFailure {
  const message = (input.message ?? "").trim();
  const lower = message.toLowerCase();

  if (input.wrongNetwork) {
    const copy = REASON_COPY["wrong-network"];
    return {
      reason: "wrong-network",
      headline: copy.headline,
      detail: input.gotChainId
        ? `${copy.detail} Got chainId ${input.gotChainId}.`
        : copy.detail,
    };
  }

  // Node/Deno/browsers throw TypeError (or "fetch failed") when DNS/connect is
  // blocked — the sandbox's no-egress case.
  const blocked =
    input.name === "TypeError" ||
    lower.includes("fetch failed") ||
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("network") ||
    lower.includes("certificate") ||
    lower.includes("dns");

  if (input.name === "AbortError" || lower.includes("abort") || lower.includes("timed out")) {
    return {
      reason: "timeout",
      headline: REASON_COPY.timeout.headline,
      detail: withRaw(REASON_COPY.timeout.detail, message),
    };
  }
  if (
    input.status === 429 ||
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return {
      reason: "rate-limited",
      headline: REASON_COPY["rate-limited"].headline,
      detail: withRaw(REASON_COPY["rate-limited"].detail, message),
    };
  }
  if (typeof input.status === "number" && input.status >= 400) {
    return {
      reason: "http-error",
      headline: `${REASON_COPY["http-error"].headline} (HTTP ${input.status})`,
      detail: withRaw(REASON_COPY["http-error"].detail, message),
    };
  }
  if (blocked) {
    return {
      reason: "no-egress",
      headline: REASON_COPY["no-egress"].headline,
      detail: withRaw(REASON_COPY["no-egress"].detail, message),
    };
  }
  return {
    reason: "rpc-error",
    headline: REASON_COPY["rpc-error"].headline,
    detail: withRaw(REASON_COPY["rpc-error"].detail, message),
  };
}

function withRaw(detail: string, raw: string): string {
  return raw ? `${detail} (${raw.slice(0, 90)})` : detail;
}

/** Copy for the healthy state. */
export function onlineCopy(blockNumber: number | null, latencyMs: number | null): RpcFailure {
  return {
    reason: "ok",
    headline:
      blockNumber != null
        ? `Live head #${blockNumber.toLocaleString("en-IN")} on ${BRIDGE_NETWORK.label}`
        : `Live on ${BRIDGE_NETWORK.label}`,
    detail:
      latencyMs != null
        ? `Read-only JSON-RPC · ${latencyMs} ms round trip · chainId ${BRIDGE_NETWORK.chainId} verified.`
        : `Read-only JSON-RPC · chainId ${BRIDGE_NETWORK.chainId} verified.`,
  };
}

/** Copy for "showing the last good reading, currently unreachable". */
export function staleCopy(ageMs: number, reason: BridgeReason = "no-egress"): RpcFailure {
  const base = reason === "checking" ? "no-egress" : reason;
  const why = REASON_COPY[base === "ok" ? "no-egress" : base];
  return {
    reason: base === "ok" ? "no-egress" : base,
    headline: "Showing last known head — public chain not reachable right now",
    detail: `Last good read ${formatAge(ageMs)} · ${why.headline.toLowerCase()}. The embedded SolarShare ledger keeps settling and hashing regardless.`,
  };
}

/**
 * Promote the last healthy endpoint to the front so the displayed URL is stable
 * across refreshes instead of rotating through the list.
 */
export function orderEndpoints(
  endpoints: RpcEndpoint[] = RPC_ENDPOINTS,
  stickyUrl?: string | null,
): RpcEndpoint[] {
  if (!stickyUrl) return endpoints;
  const sticky = endpoints.find((e) => e.url === stickyUrl);
  if (!sticky) return endpoints;
  return [sticky, ...endpoints.filter((e) => e.url !== stickyUrl)];
}

/**
 * Never let the displayed head go backwards: a lagging public RPC can answer
 * with an older block than the one already shown, which reads as "the numbers
 * keep changing". Keep the higher head (and the hash that belongs to it).
 */
export function keepMonotonicHead<T extends { blockNumber: number | null; latestBlockHash: string | null }>(
  previous: T | null,
  incoming: T,
): T {
  if (!previous || previous.blockNumber == null || incoming.blockNumber == null) return incoming;
  if (incoming.blockNumber >= previous.blockNumber) return incoming;
  return {
    ...incoming,
    blockNumber: previous.blockNumber,
    latestBlockHash: previous.latestBlockHash,
  };
}

/** Group a 0x hash into readable 4-hex chunks: `0x8f2c 1a90 b3d4 …`. */
export function groupHash(hash: string | null, chunk = 4): string {
  if (!hash) return "—";
  const body = hash.startsWith("0x") ? hash.slice(2) : hash;
  const parts = body.match(new RegExp(`.{1,${chunk}}`, "g")) ?? [];
  return `0x${parts.join(" ")}`;
}

/** `0x8f2c 1a90 … c8d0` — grouped, with the middle elided. */
export function shortGroupedHash(hash: string | null, head = 2, tail = 1): string {
  if (!hash) return "—";
  const body = hash.startsWith("0x") ? hash.slice(2) : hash;
  const parts = body.match(/.{1,4}/g) ?? [];
  if (parts.length <= head + tail) return groupHash(hash);
  return `0x${parts.slice(0, head).join(" ")} … ${parts.slice(-tail).join(" ")}`;
}

export function explorerBlockUrl(blockNumber: number | null): string | null {
  if (blockNumber == null) return null;
  return `${BRIDGE_NETWORK.explorerBase}/block/${blockNumber}`;
}

export function explorerHashUrl(hash: string | null): string | null {
  if (!hash) return null;
  return `${BRIDGE_NETWORK.explorerBase}/block/${hash}`;
}

/** "12s ago" / "3m ago" — used for "as of" so the panel reads as a snapshot. */
export function formatAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Block time from an RPC hex timestamp (`0x66e0…`) → ISO string. */
export function hexBlockTimeToIso(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

export function hexToNumber(hex: unknown): number | null {
  if (typeof hex === "number") return Number.isFinite(hex) ? hex : null;
  if (typeof hex !== "string" || !hex) return null;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : null;
}
