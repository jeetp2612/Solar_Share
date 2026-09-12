/**
 * Live-list logic for the energy ledger's "Recent blocks" feed.
 *
 * The ledger dialog re-reads the chain on a timer (other members mint blocks
 * while you watch). Replacing the whole array on every poll made the dialog
 * reload from scratch: all ten rows re-rendered and re-animated at once, a row
 * you had opened collapsed, the reader's position jumped, and the "verified"
 * banner was wiped. This module turns that into an *incremental* update:
 *
 *  - rows whose content is unchanged are **reused by object identity**, so
 *    memoised row components skip them entirely (no re-render, no re-animate),
 *  - blocks that are genuinely new are never spliced straight into the visible
 *    list — they wait in `pending` and are released **one at a time** by the
 *    UI, oldest first, so the chain grows the way a chain actually does,
 *  - a poll that changes nothing returns `changed: false` and the *same* array
 *    references, so the caller can bail out of `setState` and React renders
 *    nothing at all,
 *  - a read that fails leaves the last known list untouched (see the dialog).
 *
 * Pure and dependency-free on purpose (no React, no node APIs) so it can be
 * unit tested and imported from the client bundle.
 */
import type { BlockDetail } from "./types";

/** Rows kept on screen. The chain API returns the last 10; headroom for queued ones. */
export const MAX_LEDGER_ROWS = 24;
/** Arrivals held back while the member is reading, before the oldest is dropped. */
export const MAX_PENDING_ROWS = 40;

export type LedgerFeed = {
  /** Visible rows, ascending by block number (the UI shows this reversed). */
  blocks: BlockDetail[];
  /** Blocks that landed but have not been released into the list yet, arrival order. */
  pending: BlockDetail[];
  /** Wall clock of the last change to `blocks` — 0 = nothing landed yet. */
  updatedAt: number;
};

export function emptyLedgerFeed(): LedgerFeed {
  return { blocks: [], pending: [], updatedAt: 0 };
}

/**
 * Everything the UI renders from a block, in one cheap string. The block hash
 * covers (blockNo, prevHash, timestamp, txs), but the totals shown next to it
 * come from the same rows, so they are compared too — a hand-edited `trades`
 * row must not look "unchanged" and keep a stale render.
 */
export function blockSignature(b: BlockDetail): string {
  const txs = b.txs
    .map((t) => `${t.txHash}|${t.kind}|${t.fromName}|${t.toName}|${t.kwh}|${t.priceInr}|${t.amountInr}`)
    .join(",");
  return [
    b.blockNo,
    b.blockHash,
    b.prevHash,
    b.timestamp,
    b.txCount,
    b.totalKwh,
    b.totalInr,
    b.txs.length,
    txs,
  ].join("~");
}

// Rows are reused by identity, so each row's signature is computed once.
const signatures = new WeakMap<BlockDetail, string>();
function sigOf(b: BlockDetail): string {
  const hit = signatures.get(b);
  if (hit !== undefined) return hit;
  const s = blockSignature(b);
  signatures.set(b, s);
  return s;
}

const sameBlock = (a: BlockDetail, b: BlockDetail): boolean =>
  a.blockNo === b.blockNo && sigOf(a) === sigOf(b);

const ascending = (list: BlockDetail[]): BlockDetail[] =>
  [...list].sort((a, b) => a.blockNo - b.blockNo);

export type AbsorbOptions = {
  /** Cap on visible rows (newest win). */
  maxRows?: number;
  /** Cap on the hold queue (oldest drop off). */
  maxPending?: number;
  /** Injectable clock, for tests. */
  now?: number;
};

export type AbsorbResult = {
  feed: LedgerFeed;
  /** False ⇒ `feed` is the exact same object as before; skip the state update. */
  changed: boolean;
  /** Block numbers already visible that came back different (re-minted / edited). */
  updated: number[];
  /** Block numbers newly queued. */
  queued: number[];
  /** Block numbers whose *held* copy came back different and was refreshed in place. */
  refreshed: number[];
};

/**
 * Fold a freshly read slice of the chain into the feed.
 *
 * Known-and-identical rows are carried over untouched, changed rows are
 * replaced in place, and unknown blocks only ever enter `pending` — the caller
 * decides when to release them (see {@link drainPending}).
 */
export function absorbBlocks(
  prev: LedgerFeed,
  incoming: BlockDetail[],
  opts: AbsorbOptions = {},
): AbsorbResult {
  const maxRows = Math.max(1, opts.maxRows ?? MAX_LEDGER_ROWS);
  const maxPending = Math.max(1, opts.maxPending ?? MAX_PENDING_ROWS);
  const now = opts.now ?? 0;

  const updated: number[] = [];
  const queued: number[] = [];
  const refreshed: number[] = [];
  if (incoming.length === 0) return { feed: prev, changed: false, updated, queued, refreshed };

  const visibleByNo = new Map(prev.blocks.map((b) => [b.blockNo, b]));
  const pendingByNo = new Map(prev.pending.map((b) => [b.blockNo, b]));
  let blocks = prev.blocks;
  let pending = prev.pending;

  for (const next of ascending(incoming)) {
    const seen = visibleByNo.get(next.blockNo);
    if (seen) {
      if (sameBlock(seen, next)) continue; // identical ⇒ keep the old object, row stays put
      blocks = blocks === prev.blocks ? [...blocks] : blocks;
      blocks[blocks.indexOf(seen)] = next;
      visibleByNo.set(next.blockNo, next);
      updated.push(next.blockNo);
      continue;
    }
    const waiting = pendingByNo.get(next.blockNo);
    if (waiting) {
      if (sameBlock(waiting, next)) continue; // already lined up, unchanged
      pending = pending === prev.pending ? [...pending] : pending;
      pending[pending.indexOf(waiting)] = next;
      pendingByNo.set(next.blockNo, next);
      refreshed.push(next.blockNo);
      continue;
    }
    pending = pending === prev.pending ? [...pending] : pending;
    pending.push(next);
    pendingByNo.set(next.blockNo, next);
    queued.push(next.blockNo);
  }

  const changed = updated.length > 0 || queued.length > 0 || refreshed.length > 0;
  if (!changed) return { feed: prev, changed: false, updated, queued, refreshed };

  if (blocks.length > maxRows) blocks = blocks.slice(blocks.length - maxRows);
  if (pending.length > maxPending) pending = pending.slice(pending.length - maxPending);
  return { feed: { blocks, pending, updatedAt: now }, changed: true, updated, queued, refreshed };
}

export type DrainOptions = {
  /** How many queued blocks to release (1 = "one by one"). */
  count?: number;
  maxRows?: number;
  /** Injectable clock, for tests. */
  now?: number;
};

export type DrainResult = {
  feed: LedgerFeed;
  changed: boolean;
  /** Block numbers that just became visible, in the order they were released. */
  drained: number[];
};

/**
 * Move queued arrivals into the visible list — the "add the next block" step.
 * Release order is arrival order (chain order), so rows land in the same order
 * whether they arrive one at a time or all at once.
 */
export function drainPending(prev: LedgerFeed, opts: DrainOptions = {}): DrainResult {
  const count = Math.max(1, opts.count ?? 1);
  const maxRows = Math.max(1, opts.maxRows ?? MAX_LEDGER_ROWS);
  const now = opts.now ?? 0;

  const take = prev.pending.slice(0, count);
  const rest = prev.pending.slice(take.length);
  if (take.length === 0) return { feed: prev, changed: false, drained: [] };

  const merged = ascending([...prev.blocks, ...take]);
  const blocks = merged.length > maxRows ? merged.slice(merged.length - maxRows) : merged;
  return {
    feed: { blocks, pending: rest, updatedAt: now },
    changed: true,
    drained: take.map((b) => b.blockNo),
  };
}
