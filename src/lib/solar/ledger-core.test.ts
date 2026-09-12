import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBlockHash,
  genesisBlock,
  newTxHash,
  verifyBlocks,
  type CoreBlock,
  type CoreTx,
} from "./ledger-core.ts";

function mkBlock(no: number, prevHash: string, ts: string, txs: CoreTx[]): CoreBlock {
  return {
    blockNo: no,
    prevHash,
    blockHash: computeBlockHash({ blockNo: no, prevHash, timestamp: ts, txs }),
    timestamp: ts,
    txs,
  };
}

test("genesis is deterministic across fresh 'installs'", () => {
  const a = genesisBlock();
  const b = genesisBlock();
  assert.equal(a.blockHash, b.blockHash);
  assert.equal(a.prevHash, "0".repeat(64));
  assert.match(a.blockHash, /^0x[0-9a-f]{64}$/);
});

test("computeBlockHash is deterministic and sensitive to every field", () => {
  const txs: CoreTx[] = [
    {
      txHash: newTxHash(),
      kind: "trade",
      fromName: "A",
      toName: "B",
      kwh: 2.5,
      priceInr: 8.5,
      amountInr: 21.25,
    },
  ];
  const base = { blockNo: 1, prevHash: "0x" + "ab".repeat(32), timestamp: "2026-09-12T10:00:00.000Z", txs };
  const h1 = computeBlockHash(base);
  const h2 = computeBlockHash(base);
  assert.equal(h1, h2);
  assert.notEqual(h1, computeBlockHash({ ...base, txs: [{ ...txs[0], kwh: 2.6 }] }));
  assert.notEqual(h1, computeBlockHash({ ...base, blockNo: 2 }));
  assert.notEqual(h1, computeBlockHash({ ...base, timestamp: "2026-09-12T10:00:01.000Z" }));
  assert.notEqual(h1, computeBlockHash({ ...base, txs: [{ ...txs[0], toName: "C" }] }));
});

test("verifyBlocks accepts a valid chain", () => {
  const g = genesisBlock();
  const b1 = mkBlock(1, g.blockHash, "2026-09-12T10:00:00.000Z", [
    {
      txHash: newTxHash(),
      kind: "trade",
      fromName: "Sharma Rooftop",
      toName: "Aarav Sharma",
      kwh: 5,
      priceInr: 8.4,
      amountInr: 42,
    },
  ]);
  const b2 = mkBlock(2, b1.blockHash, "2026-09-12T10:05:00.000Z", []);
  const res = verifyBlocks([g, b1, b2]);
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.checked, 3);
});

test("verifyBlocks catches a tampered amount (hash-mismatch)", () => {
  const g = genesisBlock();
  const txs: CoreTx[] = [
    { txHash: newTxHash(), kind: "trade", fromName: "A", toName: "B", kwh: 5, priceInr: 8.4, amountInr: 42 },
  ];
  const b1 = mkBlock(1, g.blockHash, "2026-09-12T10:00:00.000Z", txs);
  const tampered = { ...b1, txs: [{ ...txs[0], amountInr: 420 }] }; // SQL row edited
  const res = verifyBlocks([g, tampered]);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.firstBad.blockNo, 1);
    assert.equal(res.firstBad.reason, "hash-mismatch");
  }
});

test("verifyBlocks catches a broken link (prevHash edit)", () => {
  const g = genesisBlock();
  const b1 = mkBlock(1, g.blockHash, "2026-09-12T10:00:00.000Z", []);
  const broken = { ...b1, prevHash: "0x" + "11".repeat(32) };
  const res = verifyBlocks([g, broken]);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.firstBad.blockNo, 1);
    assert.equal(res.firstBad.reason, "broken-link");
  }
});

test("verifyBlocks catches a missing block (gap)", () => {
  const g = genesisBlock();
  const b1 = mkBlock(1, g.blockHash, "2026-09-12T10:00:00.000Z", []);
  const b3 = mkBlock(3, b1.blockHash, "2026-09-12T10:10:00.000Z", []);
  const res = verifyBlocks([g, b1, b3]);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.firstBad.reason, "broken-link");
});
