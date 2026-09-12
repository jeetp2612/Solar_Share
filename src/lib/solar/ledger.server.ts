/**
 * SolarShare embedded settlement ledger — a real, verifiable blockchain.
 *
 * - Every user settlement mints a new block: SHA-256 over the canonical
 *   (blockNo, prevHash, timestamp, txs) payload, linked to the previous block
 *   by prevHash.
 * - Blocks + their txs are persisted in Postgres (tables `blocks`, `trades`),
 *   so the chain survives page reloads and is inspectable via SQL.
 * - `verifyChain()` recomputes every hash from genesis and reports the first
 *   corruption — the "reality check" shown in the UI.
 *
 * The hash function is the same primitive (SHA-256) used by real PoW chains;
 * what's absent vs. Ethereum is a decentralised miner network — for the demo
 * the trusted operator mints, and the testnet bridge (testnet.server.ts)
 * shows the integration point for a public chain.
 *
 * SERVER-ONLY: imports node:crypto. Never import from client code.
 */
import { getSql } from "../db";
import {
  GENESIS_PREV_HASH,
  GENESIS_TIMESTAMP,
  computeBlockHash,
  genesisBlock,
  newTxHash,
  verifyBlocks,
} from "./ledger-core";
import type { CoreBlock } from "./ledger-core";
import type {
  BlockDetail,
  BlockSummary,
  ChainHead,
  ChainVerification,
  LedgerTx,
} from "./types";

export { GENESIS_PREV_HASH, computeBlockHash, newTxHash };

type TradeRow = {
  id: string;
  block_no: number;
  tx_hash: string;
  kind: string;
  buyer_name: string;
  seller_name: string;
  kwh: number;
  price_inr: number;
  amount_inr: number;
};

type BlockRow = {
  block_no: number;
  prev_hash: string;
  block_hash: string;
  tx_count: number;
  total_kwh: number;
  total_inr: number;
  timestamp: Date | string;
};

function rowToSummary(r: BlockRow): BlockSummary {
  return {
    blockNo: Number(r.block_no),
    prevHash: String(r.prev_hash),
    blockHash: String(r.block_hash),
    txCount: Number(r.tx_count),
    totalKwh: Number(r.total_kwh),
    totalInr: Number(r.total_inr),
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  };
}

async function getHeadRow(): Promise<BlockRow | null> {
  const sql = await getSql();
  const rows = await sql.query<BlockRow>(
    `select block_no, prev_hash, block_hash, tx_count, total_kwh, total_inr, timestamp
       from blocks order by block_no desc limit 1`,
  );
  return rows[0] ?? null;
}

/** Ensure the genesis block exists (idempotent). */
export async function ensureGenesis(): Promise<void> {
  const head = await getHeadRow();
  if (head) return;
  const sql = await getSql();
  const genesis: BlockRow = {
    block_no: 0,
    prev_hash: GENESIS_PREV_HASH,
    block_hash: computeBlockHash({
      blockNo: 0,
      prevHash: GENESIS_PREV_HASH,
      timestamp: GENESIS_TIMESTAMP,
      txs: [],
    }),
    tx_count: 0,
    total_kwh: 0,
    total_inr: 0,
    timestamp: new Date(GENESIS_TIMESTAMP),
  };
  await sql.query(
    `insert into blocks (block_no, prev_hash, block_hash, tx_count, total_kwh, total_inr, timestamp)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (block_no) do nothing`,
    [
      genesis.block_no,
      genesis.prev_hash,
      genesis.block_hash,
      genesis.tx_count,
      genesis.total_kwh,
      genesis.total_inr,
      genesis.timestamp,
    ],
  );
}

/**
 * Mint a new block containing `txs`, returning its summary.
 * Concurrent mints are guarded by the primary key: a loser re-reads the head
 * and retries (bounded).
 */
export async function mintBlock(
  txs: LedgerTx[],
): Promise<BlockSummary> {
  if (txs.length === 0) throw new Error("mintBlock: at least one tx required");
  const sql = await getSql();
  await ensureGenesis();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const head = await getHeadRow();
    if (!head) throw new Error("ledger: genesis missing");
    const blockNo = Number(head.block_no) + 1;
    const prevHash = String(head.block_hash);
    const timestamp = new Date().toISOString();
    const blockHash = computeBlockHash({ blockNo, prevHash, timestamp, txs });
    const totalKwh = Number(txs.reduce((s, t) => s + t.kwh, 0).toFixed(2));
    const totalInr = Number(txs.reduce((s, t) => s + t.amountInr, 0).toFixed(2));

    try {
      await sql.query(
        `insert into blocks (block_no, prev_hash, block_hash, tx_count, total_kwh, total_inr, timestamp)
           values ($1, $2, $3, $4, $5, $6, $7)`,
        [blockNo, prevHash, blockHash, txs.length, totalKwh, totalInr, new Date(timestamp)],
      );
    } catch (err) {
      // PK conflict = someone minted first — retry against the new head.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate key") || msg.includes("unique")) continue;
      throw new Error(`ledger: failed to mint block: ${msg}`);
    }

    for (const tx of txs) {
      await sql.query(
        `insert into trades (id, block_no, tx_hash, kind, buyer_name, seller_name, kwh, price_inr, amount_inr, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [tx.txHash, blockNo, tx.txHash, tx.kind, tx.toName, tx.fromName, tx.kwh, tx.priceInr, tx.amountInr],
      );
    }
    return {
      blockNo,
      prevHash,
      blockHash,
      txCount: txs.length,
      totalKwh,
      totalInr,
      timestamp,
    };
  }
  throw new Error("ledger: could not mint block (contention)");
}

export async function getChainHead(): Promise<ChainHead> {
  await ensureGenesis();
  const head = await getHeadRow();
  if (!head) throw new Error("ledger: no head");
  const s = rowToSummary(head);
  return { blockNo: s.blockNo, blockHash: s.blockHash, verified: null };
}

export async function getRecentBlocks(limit: number): Promise<BlockDetail[]> {
  await ensureGenesis();
  const sql = await getSql();
  const blocks = await sql.query<BlockRow>(
    `select block_no, prev_hash, block_hash, tx_count, total_kwh, total_inr, timestamp
       from blocks order by block_no desc limit $1`,
    [Math.max(1, Math.min(50, limit))],
  );
  const details: BlockDetail[] = [];
  for (const b of blocks) {
    const txRows = await sql.query<TradeRow>(
      `select id, block_no, tx_hash, kind, buyer_name, seller_name, kwh, price_inr, amount_inr
         from trades where block_no = $1 order by created_at, tx_hash`,
      [b.block_no],
    );
    details.push({
      ...rowToSummary(b),
      txs: txRows.map((t) => ({
        txHash: String(t.tx_hash),
        kind: t.kind as LedgerTx["kind"],
        fromName: String(t.seller_name),
        toName: String(t.buyer_name),
        kwh: Number(t.kwh),
        priceInr: Number(t.price_inr),
        amountInr: Number(t.amount_inr),
      })),
    });
  }
  return details.reverse();
}

/**
 * Recompute the whole chain from genesis: every hash must match and every
 * prevHash must link to its predecessor. Returns the first bad link found.
 */
export async function verifyChain(): Promise<ChainVerification> {
  const sql = await getSql();
  await ensureGenesis();
  const blocks = await sql.query<BlockRow>(
    `select block_no, prev_hash, block_hash, tx_count, total_kwh, total_inr, timestamp
       from blocks order by block_no asc`,
  );

  const coreBlocks: CoreBlock[] = [];
  for (const b of blocks) {
    const no = Number(b.block_no);
    const txRows = await sql.query<TradeRow>(
      `select id, block_no, tx_hash, kind, buyer_name, seller_name, kwh, price_inr, amount_inr
         from trades where block_no = $1 order by created_at, tx_hash`,
      [no],
    );
    const txs: LedgerTx[] = txRows.map((t) => ({
      txHash: String(t.tx_hash),
      kind: t.kind as LedgerTx["kind"],
      fromName: String(t.seller_name),
      toName: String(t.buyer_name),
      kwh: Number(t.kwh),
      priceInr: Number(t.price_inr),
      amountInr: Number(t.amount_inr),
    }));
    const ts = b.timestamp instanceof Date ? b.timestamp.toISOString() : String(b.timestamp);
    coreBlocks.push({
      blockNo: no,
      prevHash: String(b.prev_hash),
      timestamp: ts,
      txs,
      blockHash: String(b.block_hash),
    });
  }

  const check = verifyBlocks(coreBlocks);
  const head = blocks[blocks.length - 1] ?? null;
  if (!check.ok) {
    return {
      ok: false,
      blocksChecked: check.checked,
      head: head ? rowToSummary(head) : null,
      firstBad: check.firstBad,
    };
  }
  return {
    ok: true,
    blocksChecked: check.checked,
    head: head ? rowToSummary(head) : null,
  };

  const last = blocks[blocks.length - 1] ?? null;
  return {
    ok: true,
    blocksChecked: blocks.length,
    head: last ? rowToSummary(last) : null,
  };
}
