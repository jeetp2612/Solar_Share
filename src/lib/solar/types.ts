/**
 * Shared types for the SolarShare settlement layer (used by both the server
 * functions in `api.server.ts` and client components).
 *
 * Money is INR. Energy is kWh. Every user settlement (buy / sell / top-up /
 * withdraw / listing) is recorded in Postgres (migrations/0002_solarshare.sql +
 * migrations/0003_payments.sql) and mints a hash-chained block (see
 * `ledger.server.ts`).
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

export type PaymentMethod = {
  id: string;
  type: "upi";
  label: string;
  upiId: string;
  holderName: string | null;
  isDefault: boolean;
  status: "active" | "disabled";
  lastUsedAt: string | null;
  createdAt: string;
};

export type PaymentRecord = {
  id: string;
  direction: "topup" | "withdraw";
  status: "pending" | "confirmed" | "failed";
  amountInr: number;
  provider: "UPI";
  providerRef: string;
  methodLabel: string | null;
  upiId: string | null;
  upiIntent: string | null;
  blockNo: number | null;
  createdAt: string;
};

export type SavePaymentMethodArgs = {
  upiId: string;
  label?: string;
  holderName?: string;
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
  paymentMethods: PaymentMethod[];
  recentPayments: PaymentRecord[];
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
  payment?: PaymentRecord;
};

export type SettleError = {
  ok: false;
  message: string;
  reason: "funds" | "surplus" | "invalid" | "chain" | "payment";
};

/** Why the public-chain bridge is (or is not) showing a live head. */
export type BridgeReason =
  | "ok"
  | "checking"
  | "no-egress"
  | "timeout"
  | "rate-limited"
  | "http-error"
  | "wrong-network"
  | "rpc-error";

/** The endpoint that produced the current reading (shown instead of a raw URL list). */
export type RpcEndpointInfo = {
  url: string;
  label: string;
  provider: string;
};

/**
 * Live status of the public **Polygon Amoy** testnet (chainId 80002) via a
 * read-only JSON-RPC bridge. When the environment has no internet egress this
 * reports `online: false` with the last known head marked `stale`, plus a
 * classified `reason` and plain-language `headline`/`detail` — never a raw RPC
 * error string. The app keeps running on its embedded ledger either way.
 */
export type TestnetStatus = {
  /** Display name, e.g. "Polygon Amoy". */
  chain: string;
  network: string;
  networkKind: "testnet" | "mainnet";
  /** Verified via `eth_chainId`; null when nothing could be read. */
  chainId: number | null;
  chainIdExpected: number;
  explorerName: string;
  /** A verified live read happened on this call. */
  online: boolean;
  /** Showing the last verified head because the chain is unreachable now. */
  stale: boolean;
  /** Endpoint pinned by the deployer via `SOLARSHARE_RPC_URL`. */
  pinned: boolean;
  blockNumber: number | null;
  latestBlockHash: string | null;
  /** ISO timestamp of the head block (null if the RPC omits it). */
  latestBlockTime: string | null;
  peerCount: number | null;
  syncing: boolean;
  latencyMs: number | null;
  /** The endpoint actually used — stable across refreshes (sticky). */
  endpoint: RpcEndpointInfo | null;
  /** Labels of endpoints tried this round, in order. */
  endpointsTried: string[];
  explorerBlockUrl: string | null;
  explorerHashUrl: string | null;
  reason: BridgeReason;
  /** One-line, human-readable summary for the UI. */
  headline: string;
  /** Longer explanation of what the status means. */
  detail: string | null;
  /** Raw technical error, for the debug line only. */
  error: string | null;
  checkedAt: number;
  /** Age of the displayed reading. */
  ageMs: number;
  /** Hint for the client poller countdown. */
  nextCheckInMs: number;
};
