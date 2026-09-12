/**
 * Shared types for the SolarShare settlement layer (used by both the server
 * functions in `api.server.ts` and client components).
 *
 * Money is INR. Energy is kWh. Every user settlement (buy / sell / top-up /
 * withdraw / listing) is recorded in Postgres (migrations/0002_solarshare.sql)
 * and mints a hash-chained block (see `ledger.server.ts`).
 */

/** Kinds of settlement that become on-chain blocks. */
export type LedgerTxKind = "trade" | "topup" | "withdraw" | "listing";

/** One settlement inside a block. `peer`/`counterparty` are display names. */
export type LedgerTx = {
  txHash: string;
  kind: LedgerTxKind;
  /** Who sent energy/money out (display name). */
  fromName: string;
  /** Who received it (display name). */
  toName: string;
  kwh: number;
  /** INR per kWh (trades/listings only). */
  priceInr: number;
  /** Total INR moved. */
  amountInr: number;
};

export type BlockSummary = {
  blockNo: number;
  prevHash: string;
  blockHash: string;
  txCount: number;
  totalKwh: number;
  totalInr: number;
  timestamp: string;
};

export type BlockDetail = BlockSummary & { txs: LedgerTx[] };

export type ChainHead = {
  blockNo: number;
  blockHash: string;
  /** Null = not verified yet this session. */
  verified: boolean | null;
};

export type ChainVerification = {
  ok: boolean;
  blocksChecked: number;
  head: BlockSummary | null;
  /** First corrupted link, when verification fails. */
  firstBad?: {
    blockNo: number;
    reason: "hash-mismatch" | "broken-link";
    expected: string;
    actual: string;
  };
};

export type UserOrderRow = {
  id: string;
  side: "ask" | "bid";
  kwh: number;
  priceInr: number;
  createdAt: string;
};

import type { Wallet } from "../market-data";

export type ProfileRow = {
  fullName: string;
  area: string;
  panelKwp: number;
  joinedAt: string;
};

export type SolarState = {
  profile: ProfileRow;
  wallet: Wallet;
  myOrders: UserOrderRow[];
  chainHead: ChainHead;
};

/** One fill leg computed by the client matcher, settled server-side. */
export type FillLeg = {
  /** Peer display name (ambient neighbour). */
  peer: string;
  peerAddress: string;
  kwh: number;
  priceInr: number;
};

export type SettleArgs = {
  action: "buy" | "sell";
  legs: FillLeg[];
};

export type SettleResult = {
  ok: true;
  wallet: Wallet;
  block: BlockSummary;
  /** INR actually moved. */
  amountInr: number;
  kwh: number;
};

export type SettleError = {
  ok: false;
  message: string;
  reason: "funds" | "surplus" | "invalid" | "chain";
};

/**
 * Live status of the public Polygon Sepolia testnet (read-only bridge).
 * When the sandbox/deploy has no internet egress this reports `online: false`
 * and the app keeps running on its embedded ledger.
 */
export type TestnetStatus = {
  chain: "Polygon Sepolia";
  online: boolean;
  blockNumber: number | null;
  latestBlockHash: string | null;
  peerCount: number | null;
  error: string | null;
  checkedAt: number;
};
