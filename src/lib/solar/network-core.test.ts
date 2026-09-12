import test from "node:test";
import assert from "node:assert/strict";
import {
  BRIDGE_NETWORK,
  RPC_ENDPOINTS,
  classifyRpcFailure,
  explorerBlockUrl,
  formatAge,
  groupHash,
  hexBlockTimeToIso,
  hexToNumber,
  keepMonotonicHead,
  orderEndpoints,
  shortGroupedHash,
  staleCopy,
} from "./network-core.ts";

test("every configured RPC endpoint serves the same network (no mixed chains)", () => {
  // The original bug: a Polygon *mainnet* URL sat in the list next to testnet
  // URLs, so consecutive refreshes reported different chains.
  assert.ok(RPC_ENDPOINTS.length >= 3);
  for (const e of RPC_ENDPOINTS) {
    assert.match(e.url, /^https:\/\//, `${e.url} must be https`);
    assert.match(
      e.url.toLowerCase(),
      /amoy|1rpc\.io\/amoy|polygon\.technology/,
      `${e.url} does not look like a Polygon Amoy (testnet) endpoint`,
    );
    assert.ok(!/polygon-bor-rpc\.publicnode\.com$/.test(e.url), `${e.url} is Polygon mainnet`);
    assert.ok(e.label.length > 0 && e.provider.length > 0);
  }
  assert.equal(BRIDGE_NETWORK.chainId, 80002);
  assert.equal(BRIDGE_NETWORK.kind, "testnet");
});

test("orderEndpoints promotes the sticky endpoint and keeps the list intact", () => {
  const sticky = RPC_ENDPOINTS[3].url;
  const ordered = orderEndpoints(RPC_ENDPOINTS, sticky);
  assert.equal(ordered[0].url, sticky);
  assert.equal(ordered.length, RPC_ENDPOINTS.length);
  assert.deepEqual(
    ordered.map((e) => e.url).sort(),
    RPC_ENDPOINTS.map((e) => e.url).sort(),
  );
  // No sticky → unchanged preference order.
  assert.deepEqual(orderEndpoints(RPC_ENDPOINTS, null), RPC_ENDPOINTS);
  assert.deepEqual(orderEndpoints(RPC_ENDPOINTS, "https://unknown.example"), RPC_ENDPOINTS);
});

test("keepMonotonicHead never lets the displayed head go backwards", () => {
  const previous = { blockNumber: 100, latestBlockHash: "0xaa" };
  const lagging = { blockNumber: 97, latestBlockHash: "0xbb" };
  const merged = keepMonotonicHead(previous, lagging);
  assert.equal(merged.blockNumber, 100);
  assert.equal(merged.latestBlockHash, "0xaa");

  const ahead = { blockNumber: 101, latestBlockHash: "0xcc" };
  assert.deepEqual(keepMonotonicHead(previous, ahead), ahead);
  // Nothing seen before → accept as-is.
  assert.deepEqual(keepMonotonicHead(null, lagging), lagging);
  const empty: { blockNumber: number | null; latestBlockHash: string | null } = {
    blockNumber: null,
    latestBlockHash: null,
  };
  assert.deepEqual(keepMonotonicHead(empty, lagging), lagging);
});

test("classifyRpcFailure turns raw errors into readable, classified copy", () => {
  const egress = classifyRpcFailure({ name: "TypeError", message: "fetch failed" });
  assert.equal(egress.reason, "no-egress");
  assert.match(egress.headline, /No outbound internet/i);
  assert.ok(egress.detail.length > 20);

  const timeout = classifyRpcFailure({ name: "AbortError", message: "This operation was aborted" });
  assert.equal(timeout.reason, "timeout");

  const limited = classifyRpcFailure({ status: 429, message: "Too Many Requests" });
  assert.equal(limited.reason, "rate-limited");
  assert.match(limited.headline, /rate limit/i);

  const http = classifyRpcFailure({ status: 502, message: "RPC HTTP 502" });
  assert.equal(http.reason, "http-error");
  assert.match(http.headline, /502/);

  const wrong = classifyRpcFailure({ wrongNetwork: true, gotChainId: 137 });
  assert.equal(wrong.reason, "wrong-network");
  assert.match(wrong.detail, /137/);

  const rpcErr = classifyRpcFailure({ message: "method not supported" });
  assert.equal(rpcErr.reason, "rpc-error");

  // Nothing is ever surfaced as an empty string.
  for (const f of [egress, timeout, limited, http, wrong, rpcErr]) {
    assert.ok(f.headline.trim().length > 0);
    assert.ok(f.detail.trim().length > 0);
  }
});

test("staleCopy reports the age of the last known head", () => {
  const copy = staleCopy(45_000, "timeout");
  assert.equal(copy.reason, "timeout");
  assert.match(copy.headline, /last known head/i);
  assert.match(copy.detail, /45s ago/);
});

test("hashes are grouped so they can be read and compared", () => {
  const hash = "0x8f2c1a90b3d47e6c12a0f88b91c3d5e7a4b6c8d0e1f23456789abcde01234567";
  const grouped = groupHash(hash);
  assert.ok(grouped.startsWith("0x8f2c 1a90 b3d4"));
  // Grouping must not lose or reorder characters.
  assert.equal(grouped.replace(/ /g, ""), hash);

  const short = shortGroupedHash(hash, 2, 1);
  assert.ok(short.includes("…"));
  assert.ok(short.startsWith("0x8f2c 1a90"));
  assert.ok(short.endsWith("4567"));

  assert.equal(groupHash(null), "—");
  assert.equal(shortGroupedHash(null), "—");
});

test("explorer links and hex parsing are correct", () => {
  assert.equal(explorerBlockUrl(1234), `${BRIDGE_NETWORK.explorerBase}/block/1234`);
  assert.equal(explorerBlockUrl(null), null);
  assert.equal(hexToNumber("0x50"), 80);
  assert.equal(hexToNumber("0x0"), 0);
  assert.equal(hexToNumber(null), null);
  assert.equal(hexToNumber("nope"), null);
  assert.equal(hexBlockTimeToIso("0x0"), null);
  const iso = hexBlockTimeToIso("0x66e0f100");
  assert.ok(iso && iso.endsWith("Z"));
});

test("formatAge reads like a snapshot label", () => {
  assert.equal(formatAge(0), "just now");
  assert.equal(formatAge(4_000), "just now");
  assert.equal(formatAge(12_000), "12s ago");
  assert.equal(formatAge(180_000), "3m ago");
  assert.equal(formatAge(7_200_000), "2h ago");
  assert.equal(formatAge(-5), "just now");
});
