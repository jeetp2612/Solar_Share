/**
 * Pure blockchain primitives for the SolarShare embedded ledger — no DB, no
 * network. `ledger.server.ts` is the Postgres adapter around this core.
 *
 * A block is a record; its hash is SHA-256 over a canonical (domain-tagged,
 * key-ordered) serialisation of (blockNo, prevHash, timestamp, txs). Chaining:
 * every block's prevHash must equal its predecessor's blockHash. `verifyBlocks`
 * recomputes everything from genesis and reports the first corruption.
 */
import { createHash, randomBytes } from "node:crypto";

export const GENESIS_PREV_HASH = "0".repeat(64);
export const GENESIS_TIMESTAMP = "2026-09-11T06:30:00.000Z"; // 12:00 IST
const CHAIN_DOMAIN = "solarshare/mumbai/1";

export type CoreTx = {
  txHash: string;
  kind: string;
  fromName: string;
  toName: string;
  kwh: number;
  priceInr: number;
  amountInr: number;
};

export type CoreBlock = {
  blockNo: number;
  prevHash: string;
  blockHash: string;
  timestamp: string;
  txs: CoreTx[];
};

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function newTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

function canonicalPayload(b: { n: number; p: string; t: string; x: CoreTx[] }): string {
  return JSON.stringify({
    d: CHAIN_DOMAIN,
    n: b.n,
    p: b.p,
    t: b.t,
    x: b.x.map((t) => [t.txHash, t.kind, t.fromName, t.toName, t.kwh, t.priceInr, t.amountInr]),
  });
}

export function computeBlockHash(
  b: { blockNo: number; prevHash: string; timestamp: string; txs: CoreTx[] },
): string {
  return `0x${sha256Hex(canonicalPayload({ n: b.blockNo, p: b.prevHash, t: b.timestamp, x: b.txs }))}`;
}

export type ChainCheck =
  | { ok: true; checked: number }
  | {
      ok: false;
      checked: number;
      firstBad: {
        blockNo: number;
        reason: "hash-mismatch" | "broken-link";
        expected: string;
        actual: string;
      };
    };

/**
 * Verify an ordered block list. Accepts either the full chain (starting at
 * genesis, block 0) or a suffix starting at block ≥ 1 (which must link to the
 * given genesis-only context implicitly — used with full chains in practice).
 */
export function verifyBlocks(blocks: CoreBlock[]): ChainCheck {
  let expectedPrev = GENESIS_PREV_HASH;
  let prevNo = 0;
  for (const b of blocks) {
    const isGenesis = b.blockNo === 0;
    if (
      (isGenesis && b.prevHash !== GENESIS_PREV_HASH) ||
      (!isGenesis && (b.blockNo !== prevNo + 1 || b.prevHash !== expectedPrev))
    ) {
      return {
        ok: false,
        checked: blocks.length,
        firstBad: {
          blockNo: b.blockNo,
          reason: "broken-link",
          expected: expectedPrev,
          actual: b.prevHash,
        },
      };
    }
    const recomputed = computeBlockHash(b);
    if (recomputed !== b.blockHash) {
      return {
        ok: false,
        checked: blocks.length,
        firstBad: {
          blockNo: b.blockNo,
          reason: "hash-mismatch",
          expected: b.blockHash,
          actual: recomputed,
        },
      };
    }
    expectedPrev = b.blockHash;
    prevNo = b.blockNo;
  }
  return { ok: true, checked: blocks.length };
}

/** Build the genesis block (deterministic — same hash on every install). */
export function genesisBlock(): CoreBlock {
  return {
    blockNo: 0,
    prevHash: GENESIS_PREV_HASH,
    blockHash: computeBlockHash({
      blockNo: 0,
      prevHash: GENESIS_PREV_HASH,
      timestamp: GENESIS_TIMESTAMP,
      txs: [],
    }),
    timestamp: GENESIS_TIMESTAMP,
    txs: [],
  };
}
