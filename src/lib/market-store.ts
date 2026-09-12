import { create } from "zustand";
import {
  buildPriceHistory,
  congestionFrom,
  irradianceAt,
  istDecimalHour,
  MICROGRID,
  NEIGHBORS,
  PRICE,
  SEED_HISTORY,
  SEED_ORDERS,
  SEED_SNAPSHOT,
  SEED_TRADED,
  SEED_TRANSACTIONS,
  snapshotFromHistory,
  type Congestion,
  type Order,
  type PricePoint,
  type Transaction,
  type Wallet,
} from "./market-data";
import { mockOrderId, mockTxHash } from "./format";
import type { FillLeg, LedgerTx, SettleError, SettleResult } from "./solar/types";

type SettleFn = (legs: FillLeg[]) => Promise<SettleResult | SettleError | null>;
type ListRestFn = (side: "ask" | "bid", kwh: number, price: number) => Promise<boolean>;

export type TradeResult =
  | { ok: true; message: string }
  | { ok: false; message: string; reason: "auth" | "wallet" | "funds" | "liquidity" | "surplus" | "pending" | "chain" };

type MarketState = {
  live: boolean;
  /** Signed-in user's wallet (authoritative copy from SQL). */
  wallet: Wallet | null;
  price: number;
  priceDelta: number;
  congestion: Congestion;
  totalTradedKwh: number;
  irradiance: number;
  supplyKwh: number;
  demandKwh: number;
  orders: Order[];
  txs: Transaction[];
  history: PricePoint[];
  /** Embedded-ledger head (real, from SQL). Null = not loaded. */
  block: number | null;
  pending: boolean;
  selectedOrderId: string | null;
  ledgerOpen: boolean;
  startLive: () => void;
  tick: () => void;
  setWallet: (w: Wallet | null) => void;
  setBlock: (b: number | null) => void;
  setLedgerOpen: (open: boolean) => void;
  selectOrder: (id: string | null) => void;
  /** Fill the book locally, then persist + mint via `settle` (server). */
  buy: (kwh: number, limitPrice: number | undefined, settle: SettleFn, listRest: ListRestFn, peerName: string) => Promise<TradeResult>;
  sell: (kwh: number, limitPrice: number | undefined, settle: SettleFn, listRest: ListRestFn, peerName: string) => Promise<TradeResult>;
};

function cloneOrders(source: Order[]): Order[] {
  return source.map((o) => ({ ...o }));
}

function cloneTxs(source: Transaction[]): Transaction[] {
  return source.map((t) => ({ ...t }));
}

function nextNeighbor(exclude?: string): (typeof NEIGHBORS)[number] {
  const pool = NEIGHBORS.filter((n) => n.address !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? NEIGHBORS[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fill `kwh` against the book on one side, honouring an optional limit price.
 * Returns the filled legs (for on-chain settlement) and the updated book.
 */
function fillAgainst(
  book: Order[],
  side: "ask" | "bid",
  kwh: number,
  limit?: number,
): { fills: FillLeg[]; remaining: number; next: Order[] } {
  const sorted = book
    .filter((o) => o.side === side)
    .sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price));
  const fills: FillLeg[] = [];
  let remaining = kwh;
  const consumed = new Map<string, number>();

  for (const order of sorted) {
    if (remaining <= 0.001) break;
    if (limit != null) {
      if (side === "ask" && order.price > limit + 1e-9) continue;
      if (side === "bid" && order.price < limit - 1e-9) continue;
    }
    const take = Math.min(order.kwh, remaining);
    fills.push({
      peer: order.peer,
      peerAddress: order.address,
      kwh: Number(take.toFixed(2)),
      priceInr: Number(order.price.toFixed(2)),
    });
    consumed.set(order.id, take);
    remaining -= take;
  }

  const next = book
    .map((o) => {
      const take = consumed.get(o.id);
      if (!take) return o;
      const left = Number((o.kwh - take).toFixed(2));
      if (left <= 0.05) return null;
      return { ...o, kwh: left };
    })
    .filter((o): o is Order => o != null);

  return { fills, remaining: Number(remaining.toFixed(2)), next };
}

/** Transaction row from an on-chain block leg (user settlement). */
function txFromLeg(
  leg: FillLeg,
  action: "buy" | "sell",
  block: number,
  peerName: string,
  txHash?: string,
): Transaction {
  const buying = action === "buy";
  return {
    id: `tx_user_${mockOrderId()}`,
    txHash: txHash ?? mockTxHash(),
    from: buying ? leg.peerAddress : "user",
    fromName: buying ? leg.peer : peerName,
    to: buying ? "user" : leg.peerAddress,
    toName: buying ? peerName : leg.peer,
    kwh: leg.kwh,
    price: leg.priceInr,
    block,
    timestamp: Date.now(),
    status: "confirmed",
    fresh: true,
  };
}

export const useMarket = create<MarketState>((set, get) => ({
  live: false,
  wallet: null,
  price: SEED_SNAPSHOT.price,
  priceDelta: SEED_SNAPSHOT.priceDelta,
  congestion: SEED_SNAPSHOT.congestion,
  totalTradedKwh: SEED_TRADED,
  irradiance: SEED_SNAPSHOT.irradiance,
  supplyKwh: SEED_SNAPSHOT.supplyKwh,
  demandKwh: SEED_SNAPSHOT.demandKwh,
  orders: cloneOrders(SEED_ORDERS),
  txs: cloneTxs(SEED_TRANSACTIONS),
  history: SEED_HISTORY,
  block: null,
  pending: false,
  selectedOrderId: null,
  ledgerOpen: false,

  startLive: () => {
    if (get().live) return;
    const now = Date.now();
    const history = buildPriceHistory(now);
    const snap = snapshotFromHistory(history);
    const delta = snap.price - SEED_SNAPSHOT.price;
    set({
      live: true,
      history,
      ...snap,
      orders: cloneOrders(SEED_ORDERS).map((o) => ({
        ...o,
        price: Number(Math.max(PRICE.min, o.price + delta).toFixed(2)),
      })),
      txs: cloneTxs(SEED_TRANSACTIONS).map((tx, i) => ({
        ...tx,
        timestamp: now - (i + 1) * 95_000,
      })),
    });
  },

  tick: () => {
    const state = get();
    if (!state.live) return;
    const now = Date.now();
    const last = state.history[state.history.length - 1] ?? {
      t: now,
      price: state.price,
      supply: state.supplyKwh,
      demand: state.demandKwh,
      irradiance: state.irradiance,
    };
    const irr = irradianceAt(now, Math.random);
    const supply = Math.max(18, last.supply + (irr - last.irradiance) * 80 + (Math.random() - 0.5) * 6);
    const hour = istDecimalHour(now);
    const evening = hour >= 16 && hour <= 21 ? 1 : 0;
    const demand = Math.max(
      40,
      last.demand + (Math.random() - 0.48) * 5 + evening * 0.4 - irr * 0.8,
    );
    const imbalance = (demand - supply) / Math.max(supply + demand, 1);
    const target = PRICE.base + imbalance * PRICE.swing;
    const price = Number(
      Math.min(PRICE.max, Math.max(PRICE.min, last.price + (target - last.price) * 0.18 + (Math.random() - 0.5) * 0.03)).toFixed(3),
    );
    const point: PricePoint = {
      t: now,
      price,
      supply: Number(supply.toFixed(1)),
      demand: Number(demand.toFixed(1)),
      irradiance: Number(irr.toFixed(3)),
    };
    const history = [...state.history.slice(-71), point];

    let orders: Order[] = state.orders.map((o) => ({ ...o, fresh: false }));
    let txs: Transaction[] = state.txs.map((t) => ({ ...t, fresh: false }));
    let totalTradedKwh = state.totalTradedKwh;

    // Ambient neighbour orders appear on the book.
    if (Math.random() > 0.55) {
      const side: Order["side"] = Math.random() > 0.48 ? "ask" : "bid";
      const peer = nextNeighbor();
      const listed: Order = {
        id: mockOrderId(),
        side,
        peer: peer.name,
        address: peer.address,
        kwh: Number((1.5 + Math.random() * 12).toFixed(1)),
        price: Number((price + (side === "ask" ? 0.05 : -0.08) + (Math.random() - 0.5) * 0.2).toFixed(2)),
        distanceKm: Number((0.2 + Math.random() * 3.2).toFixed(1)),
        source: Math.random() > 0.7 ? "community-array" : "rooftop-pv",
        fresh: true,
      };
      orders = [listed, ...orders].slice(0, 16);
    }

    // Ambient neighbour trades (matched locally — user settlements go on-chain).
    if (Math.random() > 0.62 && orders.length > 4) {
      const seller = nextNeighbor();
      const buyer = nextNeighbor(seller.address);
      const kwh = Number((1.2 + Math.random() * 6).toFixed(1));
      const tradePrice = Number((price + (Math.random() - 0.5) * 0.15).toFixed(2));
      totalTradedKwh = Number((totalTradedKwh + kwh).toFixed(1));
      txs = [
        {
          id: `tx_${mockOrderId()}`,
          txHash: mockTxHash(),
          from: seller.address,
          fromName: seller.name,
          to: buyer.address,
          toName: buyer.name,
          kwh,
          price: tradePrice,
          timestamp: now,
          status: "confirmed" as const,
          fresh: true,
        },
        ...txs,
      ].slice(0, 24);
    }

    set({
      price,
      priceDelta: price - last.price,
      congestion: congestionFrom(supply, demand),
      irradiance: point.irradiance,
      supplyKwh: point.supply,
      demandKwh: point.demand,
      history,
      orders,
      txs,
      totalTradedKwh,
    });
  },

  setWallet: (w) => set({ wallet: w }),
  setBlock: (b) => set({ block: b }),
  setLedgerOpen: (open) => set({ ledgerOpen: open }),
  selectOrder: (id) => set({ selectedOrderId: id }),

  buy: async (kwh, limitPrice, settle, listRest, peerName) => {
    const state = get();
    if (state.pending) return { ok: false, message: "A settlement is already in flight.", reason: "pending" };
    if (!state.wallet) return { ok: false, message: "Sign in to buy energy.", reason: "auth" };
    if (kwh <= 0) return { ok: false, message: "Enter a volume greater than zero.", reason: "liquidity" };

    const selected = state.orders.find((o) => o.id === state.selectedOrderId && o.side === "ask");
    const book = selected ? [selected, ...state.orders.filter((o) => o.id !== selected.id)] : state.orders;
    const { fills, remaining, next } = fillAgainst(book, "ask", kwh, limitPrice);
    if (fills.length === 0) {
      return { ok: false, message: "No asks available at that price.", reason: "liquidity" };
    }

    set({ pending: true });
    // Settlement is server-side: SQL balance check + block mint (with a small
    // UX delay so the "awaiting settlement" state reads like a chain confirm).
    await sleep(420);
    const result = await settle(fills);
    if (!result || !result.ok) {
      set({ pending: false });
      const r = result as SettleError | null;
      return {
        ok: false,
        message: r?.message ?? "Sign in to trade.",
        reason: r?.reason === "chain" ? "chain" : "funds",
      };
    }

    const filledKwh = result.kwh;
    let orders = next;
    if (remaining > 0.05 && limitPrice != null) {
      const listed = await listRest("bid", remaining, limitPrice);
      if (listed) {
        orders = [
          {
            id: `ord_user_${mockOrderId()}`,
            side: "bid" as const,
            peer: peerName,
            address: "you",
            kwh: remaining,
            price: limitPrice,
            distanceKm: 0,
            source: "home-battery" as const,
            fresh: true,
          },
          ...orders,
        ];
      }
    }

    const newTxs: Transaction[] = fills.map((leg) =>
      txFromLeg(leg, "buy", result.block.blockNo, peerName),
    );

    set({
      pending: false,
      wallet: result.wallet ? { ...result.wallet } : state.wallet,
      orders,
      txs: [...newTxs, ...state.txs].slice(0, 24),
      totalTradedKwh: Number((state.totalTradedKwh + filledKwh).toFixed(1)),
      block: result.block.blockNo,
      selectedOrderId: null,
    });
    void sleep(620);

    const leftover = remaining > 0.05 ? ` Resting bid for ${remaining.toFixed(1)} kWh.` : "";
    return {
      ok: true,
      message: `Bought ${filledKwh.toFixed(1)} kWh for ₹${result.amountInr.toFixed(2)} · block ${result.block.blockNo}.${leftover}`,
    };
  },

  sell: async (kwh, limitPrice, settle, listRest, peerName) => {
    const state = get();
    if (state.pending) return { ok: false, message: "A settlement is already in flight.", reason: "pending" };
    if (!state.wallet) return { ok: false, message: "Sign in to sell surplus.", reason: "auth" };
    if (kwh <= 0) return { ok: false, message: "Enter a volume greater than zero.", reason: "liquidity" };
    if (kwh > state.wallet.surplusKwh + 1e-9) {
      return {
        ok: false,
        message: `Not enough solar surplus (you have ${state.wallet.surplusKwh.toFixed(1)} kWh).`,
        reason: "surplus",
      };
    }

    const selected = state.orders.find((o) => o.id === state.selectedOrderId && o.side === "bid");
    const book = selected ? [selected, ...state.orders.filter((o) => o.id !== selected.id)] : state.orders;
    const { fills, remaining, next } = fillAgainst(book, "bid", kwh, limitPrice);

    set({ pending: true });
    await sleep(420);
    const result = await settle(fills);
    if (!result || !result.ok) {
      set({ pending: false });
      const r = result as SettleError | null;
      return {
        ok: false,
        message: r?.message ?? "Sign in to trade.",
        reason: r?.reason === "chain" ? "chain" : "surplus",
      };
    }

    let orders = next;
    if (remaining > 0.05) {
      const askPrice = limitPrice ?? Number((state.price + 0.08).toFixed(2));
      const listed = await listRest("ask", remaining, askPrice);
      if (listed) {
        orders = [
          {
            id: `ord_user_${mockOrderId()}`,
            side: "ask" as const,
            peer: peerName,
            address: "you",
            kwh: remaining,
            price: askPrice,
            distanceKm: 0,
            source: "rooftop-pv" as const,
            fresh: true,
          },
          ...orders,
        ];
      }
    }

    const newTxs: Transaction[] = fills.map((leg) =>
      txFromLeg(leg, "sell", result.block.blockNo, peerName),
    );

    set({
      pending: false,
      wallet: result.wallet ? { ...result.wallet } : state.wallet,
      orders,
      txs: [...newTxs, ...state.txs].slice(0, 24),
      totalTradedKwh: Number((state.totalTradedKwh + result.kwh).toFixed(1)),
      block: result.block.blockNo,
      selectedOrderId: null,
    });
    void sleep(620);

    if (result.kwh < 0.05) {
      return { ok: true, message: `Listed ${kwh.toFixed(1)} kWh on the local book · block ${result.block.blockNo}.` };
    }
    const leftover = remaining > 0.05 ? ` Listed remaining ${remaining.toFixed(1)} kWh.` : "";
    return {
      ok: true,
      message: `Sold ${result.kwh.toFixed(1)} kWh for ₹${result.amountInr.toFixed(2)} · block ${result.block.blockNo}.${leftover}`,
    };
  },
}));

export { MICROGRID };
export type { LedgerTx };
