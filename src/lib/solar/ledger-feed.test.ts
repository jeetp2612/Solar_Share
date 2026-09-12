import test from "node:test";
import assert from "node:assert/strict";
import {
  absorbBlocks,
  blockSignature,
  drainPending,
  emptyLedgerFeed,
  MAX_LEDGER_ROWS,
  type LedgerFeed,
} from "./ledger-feed.ts";
import type { BlockDetail, LedgerTx } from "./types.ts";

function tx(over: Partial<LedgerTx> = {}): LedgerTx {
  return {
    txHash: `0x${"ab".repeat(32)}`,
    kind: "trade",
    fromName: "Sharma Rooftop",
    toName: "Aarav Sharma",
    kwh: 5,
    priceInr: 8.2,
    amountInr: 41,
    ...over,
  };
}

function block(no: number, over: Partial<BlockDetail> = {}): BlockDetail {
  return {
    blockNo: no,
    prevHash: `0x${"0".repeat(63)}${no % 10}`,
    blockHash: `0x${"f".repeat(63)}${no % 10}`,
    txCount: 1,
    totalKwh: 5,
    totalInr: 41,
    timestamp: `2026-09-12T10:0${no % 10}:00.000Z`,
    txs: [tx()],
    ...over,
  };
}

const feedOf = (blocks: BlockDetail[], pending: BlockDetail[] = []): LedgerFeed => ({
  blocks,
  pending,
  updatedAt: 0,
});

test("a poll with identical content changes nothing and keeps every identity", () => {
  const rows = [block(0), block(1), block(2)];
  const feed = feedOf(rows);
  const res = absorbBlocks(feed, rows.map((b) => ({ ...b, txs: b.txs.map((t) => ({ ...t })) })), {
    now: 1000,
  });
  assert.equal(res.changed, false);
  assert.equal(res.feed, feed, "same feed object so the caller can skip the state update");
  assert.deepEqual(res.updated, []);
  assert.deepEqual(res.queued, []);
});

test("unchanged rows are reused by reference so memoised rows never re-render", () => {
  const genesis = block(0);
  const head = block(1);
  const feed = feedOf([genesis, head]);
  // One brand new block arrives; the two existing ones come back as equal copies.
  const fresh = block(2);
  const res = absorbBlocks(feed, [genesis, head, fresh], { now: 2000 });
  assert.equal(res.changed, true);
  assert.equal(res.feed.blocks[0], genesis, "genesis row kept by identity");
  assert.equal(res.feed.blocks[1], head, "head row kept by identity");
  assert.equal(res.feed.blocks.length, 2, "the visible list only grows through a drain");
  assert.deepEqual(res.queued, [2], "only the new block is an arrival");
  assert.equal(res.feed.pending[0], fresh, "and it waits in the queue");
  assert.equal(res.feed.updatedAt, 2000);
});

test("a new block never lands in the visible list by itself — it queues", () => {
  const feed = feedOf([block(0), block(1)]);
  const res = absorbBlocks(feed, [block(0), block(1), block(2)]);
  assert.equal(res.feed.blocks.length, 2, "the list the reader is looking at is untouched");
  assert.equal(res.feed.pending.length, 1);
  assert.equal(res.feed.pending[0].blockNo, 2);
});

test("draining releases one block at a time, in chain order", () => {
  const rows = [block(0), block(1)];
  let feed = absorbBlocks(feedOf(rows), [block(0), block(1), block(2), block(3), block(4)]).feed;
  assert.equal(feed.pending.length, 3);

  const seen: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const res = drainPending(feed, { count: 1, now: 5000 + i });
    assert.equal(res.changed, i < 3, "the fourth drain has nothing left to do");
    feed = res.feed;
    seen.push(...res.drained);
  }
  assert.deepEqual(seen, [2, 3, 4], "oldest arrival first, so rows land in chain order");
  assert.deepEqual(
    feed.blocks.map((b) => b.blockNo),
    [0, 1, 2, 3, 4],
  );
  assert.equal(feed.pending.length, 0);
});

test("drain-all releases everything the queue held", () => {
  const feed = absorbBlocks(feedOf([block(0)]), [block(0), block(1), block(2)]).feed;
  const res = drainPending(feed, { count: 99 });
  assert.deepEqual(
    res.feed.blocks.map((b) => b.blockNo),
    [0, 1, 2],
  );
  assert.equal(res.feed.pending.length, 0);
});

test("an empty queue drains to nothing and reports no change", () => {
  const feed = feedOf([block(0)]);
  const res = drainPending(feed);
  assert.equal(res.changed, false);
  assert.equal(res.feed, feed);
  assert.deepEqual(res.drained, []);
});

test("a row that came back different is replaced in place, not queued", () => {
  const oldHead = block(7);
  const feed = feedOf([block(6), oldHead]);
  // Same block number, different content (a rewrite/tamper) — must update in place.
  const edited = block(7, { totalInr: 999 });
  const res = absorbBlocks(feed, [block(6), edited], { now: 9000 });
  assert.deepEqual(res.updated, [7]);
  assert.deepEqual(res.queued, [], "an update is not an arrival");
  assert.equal(res.feed.blocks[1], edited);
  assert.equal(res.feed.pending.length, 0);
});

test("the same arrival reported by two polls is not queued twice", () => {
  const feed = feedOf([block(0)]);
  const first = absorbBlocks(feed, [block(0), block(1)]);
  const second = absorbBlocks(first.feed, [block(0), block(1)], { now: 3000 });
  assert.equal(second.changed, false, "no second copy, no second state update");
  assert.equal(second.feed, first.feed);
  assert.equal(second.feed.pending.length, 1);
});

test("a queued block that changed while waiting is refreshed in the queue", () => {
  const feed = feedOf([block(0)]);
  const held = absorbBlocks(feed, [block(0), block(1)]).feed;
  const updated = absorbBlocks(held, [block(0), block(1, { totalKwh: 42 })], { now: 4000 });
  assert.equal(updated.changed, true, "a held row that changed must still reach the state");
  assert.deepEqual(updated.refreshed, [1]);
  assert.deepEqual(updated.queued, [], "it was already queued, so it is not a new arrival");
  assert.equal(updated.feed.pending[0].totalKwh, 42);
  assert.equal(updated.feed.blocks.length, 1, "still not visible");
});

test("visible rows are capped to the newest maxRows", () => {
  const many = Array.from({ length: 40 }, (_, i) => block(i));
  const res = drainPending(absorbBlocks(emptyLedgerFeed(), many, { maxRows: 5 }).feed, {
    count: 99,
    maxRows: 5,
  });
  assert.deepEqual(
    res.feed.blocks.map((b) => b.blockNo),
    [35, 36, 37, 38, 39],
  );
});

test("the hold queue is capped so a long absence cannot pile up rows", () => {
  const many = Array.from({ length: 60 }, (_, i) => block(i));
  const res = absorbBlocks(emptyLedgerFeed(), many, { maxRows: 5, maxPending: 10 });
  assert.equal(res.feed.pending.length, 10);
  assert.equal(res.feed.pending[0].blockNo, 50, "the oldest held arrivals drop off first");
  assert.equal(res.feed.blocks.length, 0, "nothing reaches the screen without a drain");
});

test("cap constants stay sane against the 10-block chain read", () => {
  assert.ok(MAX_LEDGER_ROWS >= 10, "the API hands back the last 10 blocks");
});

test("signature ignores object identity but catches every rendered field", () => {
  const a = block(3);
  assert.equal(blockSignature(a), blockSignature({ ...a, txs: a.txs.map((t) => ({ ...t })) }));
  assert.notEqual(blockSignature(a), blockSignature({ ...a, totalKwh: 6 }));
  assert.notEqual(blockSignature(a), blockSignature({ ...a, blockHash: `0x${"1".repeat(64)}` }));
  assert.notEqual(blockSignature(a), blockSignature({ ...a, txs: [tx({ kwh: 5.5 })] }));
  assert.notEqual(blockSignature(a), blockSignature({ ...a, timestamp: "2026-01-01T00:00:00.000Z" }));
});

test("an empty read never clears what the member is looking at", () => {
  const feed = feedOf([block(0), block(1)]);
  const res = absorbBlocks(feed, []);
  assert.equal(res.changed, false);
  assert.equal(res.feed, feed);
});
