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
  type EnergySource,
  type FeedKind,
  type Order,
  type PricePoint,
  type Transaction,
  type Wallet,
} from "./market-data.ts";
import { mockOrderId, mockTxHash } from "./format.ts";
import type { FillLeg, SettleError, SettleResult } from "./solar/types.ts";
import {
  applyDealToBook,
  directDeal,
  DUST_KWH,
  minDealKwh,
  routeFill,
  round1,
  round2,
  splitInstalments,
  summariseBook,
} from "./deal.ts";

type SettleFn = (legs: FillLeg[]) => Promise<SettleResult | SettleError | null>;
type ListRestFn = (side: "ask" | "bid", kwh: number, price: number) => Promise<boolean>;

/** Everything the store needs to settle on the server ledger. */
export type TradeHooks = {
  settle: SettleFn;
  listRest: ListRestFn;
  peerName: string;
  peerArea?: string;
};

export type TradeOptions = {
  /** Limit price; legs outside it are skipped and the rest rests on the book. */
  limit?: number;
  /** Fill this lot first (a row picked in the marketplace), then sweep. */
  preferOrderId?: string;
};

export type TradeFailReason =
  | "auth"
  | "wallet"
  | "funds"
  | "liquidity"
  | "surplus"
  | "pending"
  | "chain";

export type TradeResult =
  | { ok: true; message: string; kwh: number; amountInr: number; block: number }
  | { ok: false; message: string; reason: TradeFailReason };

export type DealFailReason =
  | "auth"
  | "volume"
  | "lot"
  | "price"
  | "funds"
  | "surplus"
  | "pending"
  | "chain";

export type DealResult =
  | {
      ok: true;
      message: string;
      kwh: number;
      amountInr: number;
      blocks: number[];
      instalments: number;
      accepted: boolean;
      counterPrice: number | null;
      partial: boolean;
    }
  | { ok: false; message: string; reason: DealFailReason };

/** Live progress of a multi-instalment direct deal (drives the deal sheet). */
export type DealProgress = {
  running: boolean;
  orderId: string | null;
  peer: string;
  done: number;
  total: number;
  kwhDone: number;
  inrDone: number;
  blocks: number[];
  note: string;
};

export type FeedFilter = "all" | "mine" | "trades" | "deals" | "money";

const idleProgress: DealProgress = {
  running: false,
  orderId: null,
  peer: "",
  done: 0,
  total: 0,
  kwhDone: 0,
  inrDone: 0,
  blocks: [],
  note: "",
};

type MarketState = {
  live: boolean;
  /** Signed-in user's wallet (authoritative copy from SQL). Only replaced when a number moved. */
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
  /** Lot the direct-deal sheet is open on. */
  dealOrderId: string | null;
  dealProgress: DealProgress;
  feedFilter: FeedFilter;
  feedPaused: boolean;
  ledgerOpen: boolean;
  startLive: () => void;
  tick: () => void;
  setWallet: (w: Wallet | null) => void;
  setBlock: (b: number | null) => void;
  setLedgerOpen: (open: boolean) => void;
  selectOrder: (id: string | null) => void;
  openDeal: (id: string | null) => void;
  setFeedFilter: (f: FeedFilter) => void;
  setFeedPaused: (paused: boolean) => void;
  /** Sweep the book (optionally starting from one lot), then settle on-chain. */
  buy: (kwh: number, options: TradeOptions, hooks: TradeHooks) => Promise<TradeResult>;
  sell: (kwh: number, options: TradeOptions, hooks: TradeHooks) => Promise<TradeResult>;
  /**
   * Direct P2P deal with ONE neighbour for PART of their lot, optionally
   * delivered in instalments (each instalment mints its own block).
   */
  deal: (
    args: { orderId: string; side: "ask" | "bid"; kwh: number; offerPrice?: number; instalments: number },
    hooks: TradeHooks,
  ) => Promise<DealResult>;
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

function pick<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const AMBIENT_NOTES: Record<FeedKind, string[]> = {
  trade: ["Matched on the feeder book", "Cleared by EnergyPool Mumbai v2"],
  deal: ["Direct P2P deal · partial lot", "Direct P2P deal · agreed price"],
  listing: ["New lot listed on the book", "Surplus re-listed after the peak"],
  topup: ["Wallet top-up via UPI"],
  withdraw: ["Withdrawal to UPI"],
  grid: [
    "Feeder congestion eased — local solar covering more load",
    "Peak solar window open — nodes exporting",
    "Evening ramp: batteries discharging into the feeder",
    "Cloud cover over Andheri — export dipped briefly",
  ],
};

/** Transaction row from an on-chain leg (member settlement). */
function txFromLeg(
  leg: { peer: string; peerAddress: string; kwh: number; priceInr: number; area?: string; source?: EnergySource; distanceKm?: number },
  action: "buy" | "sell",
  block: number,
  peerName: string,
  kind: FeedKind = "trade",
  extra: Partial<Transaction> = {},
): Transaction {
  const buying = action === "buy";
  const kwh = round2(leg.kwh);
  const price = round2(leg.priceInr);
  return {
    id: `tx_user_${mockOrderId()}`,
    txHash: mockTxHash(),
    kind,
    from: buying ? leg.peerAddress : "you",
    fromName: buying ? leg.peer : peerName,
    to: buying ? "you" : leg.peerAddress,
    toName: buying ? peerName : leg.peer,
    kwh,
    price,
    totalInr: round2(kwh * price),
    area: leg.area,
    source: leg.source,
    distanceKm: leg.distanceKm,
    block,
    timestamp: Date.now(),
    status: "confirmed",
    mine: true,
    fresh: true,
    ...extra,
  };
}

/** Map a server settlement failure onto the UI's failure vocabulary. */
function settleFailReason(r: SettleError | null, fallback: TradeFailReason): TradeFailReason {
  switch (r?.reason) {
    case "chain":
      return "chain";
    case "surplus":
      return "surplus";
    case "funds":
    case "payment":
      return "funds";
    case "invalid":
      return "liquidity";
    default:
      return fallback;
  }
}

const toLeg = (l: { peer: string; peerAddress: string; kwh: number; priceInr: number }): FillLeg => ({
  peer: l.peer,
  peerAddress: l.peerAddress,
  kwh: l.kwh,
  priceInr: l.priceInr,
});

/** A member's own resting order on the book. */
function myOrder(side: "ask" | "bid", kwh: number, price: number, peerName: string, area?: string): Order {
  return {
    id: `ord_you_${mockOrderId()}`,
    side,
    peer: peerName,
    address: "you",
    kwh: round1(kwh),
    lotKwh: round1(kwh),
    price: round2(price),
    distanceKm: 0,
    area: area ?? "Your rooftop",
    source: side === "ask" ? "rooftop-pv" : "home-battery",
    reliability: 5,
    settled: 0,
    minSplitKwh: 0.5,
    allowsInstalments: true,
    fresh: true,
  };
}

/**
 * `wallet` is an object, so writing a structurally identical copy every poll
 * would re-render every card that reads it. Compare the fields instead and let
 * the store keep its existing reference when nothing actually moved.
 */
function sameWallet(a: Wallet | null, b: Wallet | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.inr === b.inr &&
    a.kwhCredits === b.kwhCredits &&
    a.surplusKwh === b.surplusKwh &&
    a.panelKwp === b.panelKwp &&
    a.generatingKw === b.generatingKw &&
    a.totalEarnedInr === b.totalEarnedInr &&
    a.totalSpentInr === b.totalSpentInr &&
    a.totalSoldKwh === b.totalSoldKwh &&
    a.totalBoughtKwh === b.totalBoughtKwh
  );
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
  dealOrderId: null,
  dealProgress: idleProgress,
  feedFilter: "all",
  feedPaused: false,
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
        price: round2(Math.max(PRICE.min, o.price + delta)),
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
    const demand = Math.max(40, last.demand + (Math.random() - 0.48) * 5 + evening * 0.4 - irr * 0.8);
    const imbalance = (demand - supply) / Math.max(supply + demand, 1);
    const target = PRICE.base + imbalance * PRICE.swing;
    const price = Number(
      Math.min(
        PRICE.max,
        Math.max(PRICE.min, last.price + (target - last.price) * 0.18 + (Math.random() - 0.5) * 0.03),
      ).toFixed(3),
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

    // Pausing the feed stops *new rows* landing (prices and lots keep moving) so
    // a row you are reading does not scroll away.
    const addTx = (tx: Transaction) => {
      if (state.feedPaused) return;
      txs = [tx, ...txs].slice(0, 40);
    };

    // Ambient neighbour lots appear on the book (varied sizes, sources, areas).
    if (Math.random() > 0.55 || orders.length < 10) {
      const side: Order["side"] = Math.random() > 0.48 ? "ask" : "bid";
      const peer = nextNeighbor();
      const kwh = round1(1.5 + Math.random() * 12);
      const listed: Order = {
        id: mockOrderId(),
        side,
        peer: peer.name,
        address: peer.address,
        kwh,
        lotKwh: kwh,
        price: round2(price + (side === "ask" ? 0.05 : -0.08) + (Math.random() - 0.5) * 0.2),
        distanceKm: Number((0.2 + Math.random() * 3.2).toFixed(1)),
        area: peer.area,
        source: peer.source,
        reliability: peer.reliability,
        settled: peer.settled,
        minSplitKwh: pick([0.2, 0.5, 0.5, 1]) ?? 0.5,
        allowsInstalments: Math.random() > 0.25,
        fresh: true,
      };
      orders = [listed, ...orders].slice(0, 18);

      if (Math.random() > 0.72) {
        addTx({
          id: `tx_${mockOrderId()}`,
          txHash: mockTxHash(),
          kind: "listing",
          from: listed.address,
          fromName: listed.peer,
          to: "marketplace",
          toName: "Marketplace",
          kwh: listed.kwh,
          price: listed.price,
          totalInr: round2(listed.kwh * listed.price),
          area: listed.area,
          source: listed.source,
          distanceKm: listed.distanceKm,
          timestamp: now,
          status: "confirmed",
          note: pick(AMBIENT_NOTES.listing),
          fresh: true,
        });
      }
    }

    // Ambient matches — including partial lots and instalment deliveries, so the
    // feed shows a genuine mix rather than one repeated sentence.
    if (Math.random() > 0.55 && orders.length > 4) {
      const roll = Math.random();
      if (roll > 0.88) {
        // Grid event (no energy, no money — feeder signal).
        addTx({
          id: `tx_${mockOrderId()}`,
          txHash: mockTxHash(),
          kind: "grid",
          from: "msedcl",
          fromName: `MSEDCL ${MICROGRID.feeder}`,
          to: "microgrid",
          toName: "Microgrid",
          kwh: 0,
          price: 0,
          totalInr: 0,
          area: pick([...new Set(orders.map((o) => o.area))]),
          timestamp: now,
          status: "confirmed",
          note: pick(AMBIENT_NOTES.grid),
          fresh: true,
        });
      } else {
        const lot = pick(orders.filter((o) => o.kwh > 1));
        if (lot) {
          const seller = lot.side === "ask" ? lot : null;
          const counter = pick(NEIGHBORS.filter((n) => n.address !== lot.address));
          const maxSlice = Math.min(lot.kwh * 0.6, 8);
          const kwh = round1(Math.max(0.5, 1.2 + Math.random() * maxSlice));
          const tradePrice = round2(lot.price + (Math.random() - 0.5) * 0.12);
          const isDeal = roll > 0.62;
          const of = isDeal && lot.allowsInstalments ? pick([2, 3, 3, 4]) ?? 1 : 1;
          const index = isDeal && of > 1 ? Math.min(of, 1 + Math.floor(Math.random() * of)) : 1;
          totalTradedKwh = round1(totalTradedKwh + kwh);

          // The lot visibly shrinks when an ambient member takes part of it.
          const left = round2(lot.kwh - kwh);
          orders =
            left <= DUST_KWH
              ? orders.filter((o) => o.id !== lot.id)
              : orders.map((o) => (o.id === lot.id ? { ...o, kwh: left } : o));

          addTx({
            id: `tx_${mockOrderId()}`,
            txHash: mockTxHash(),
            kind: isDeal ? "deal" : "trade",
            from: seller ? seller.address : lot.address,
            fromName: seller ? seller.peer : lot.peer,
            to: seller ? (counter?.address ?? "you") : lot.address,
            toName: seller ? (counter?.name ?? "Neighbour") : lot.peer,
            kwh,
            price: tradePrice,
            totalInr: round2(kwh * tradePrice),
            area: lot.area,
            source: lot.source,
            distanceKm: lot.distanceKm,
            timestamp: now,
            status: Math.random() > 0.9 ? "pending" : "confirmed",
            instalment: isDeal && of > 1 ? { index, of } : undefined,
            note: isDeal
              ? of > 1
                ? `Direct P2P deal · instalment ${index} of ${of}`
                : `Direct P2P deal · partial lot (${kwh.toFixed(1)} of ${lot.lotKwh.toFixed(1)} kWh)`
              : pick(AMBIENT_NOTES.trade),
            fresh: true,
          });
        }
      }
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

  setWallet: (w) =>
    // Skip the write when the numbers are unchanged — no re-render, no flash.
    set((s) => (sameWallet(s.wallet, w) ? s : { wallet: w })),
  setBlock: (b) => set((s) => (s.block === b ? s : { block: b })),
  setLedgerOpen: (open) => set({ ledgerOpen: open }),
  selectOrder: (id) => set({ selectedOrderId: id }),
  openDeal: (id) => set({ dealOrderId: id, dealProgress: idleProgress }),
  setFeedFilter: (f) => set({ feedFilter: f }),
  setFeedPaused: (paused) => set({ feedPaused: paused }),

  buy: async (kwh, options, hooks) => {
    const state = get();
    if (state.pending) return { ok: false, message: "A settlement is already in flight.", reason: "pending" };
    if (!state.wallet) return { ok: false, message: "Sign in to buy energy.", reason: "auth" };
    if (kwh <= 0) return { ok: false, message: "Enter a volume greater than zero.", reason: "liquidity" };

    const { quote, remaining, nextOrders } = routeFill(state.orders, "ask", kwh, {
      limit: options.limit,
      preferOrderId: options.preferOrderId ?? state.selectedOrderId ?? undefined,
      referencePrice: state.price,
    });
    if (quote.legs.length === 0) {
      return {
        ok: false,
        message:
          options.limit != null
            ? `No asks at or below ${options.limit.toFixed(2)}/kWh right now.`
            : "No asks available on this feeder right now.",
        reason: "liquidity",
      };
    }
    const cost = quote.netInr;
    if (cost > state.wallet.inr + 1e-9) {
      return {
        ok: false,
        message: `Needs ${cost.toFixed(2)} but your wallet has ${state.wallet.inr.toFixed(2)}. Top up or reduce the volume.`,
        reason: "funds",
      };
    }

    set({ pending: true });
    // Small UX delay so "awaiting settlement" reads like a chain confirmation.
    await sleep(420);
    const result = await hooks.settle(quote.legs.map(toLeg));
    if (!result || !result.ok) {
      set({ pending: false });
      const r = result as SettleError | null;
      return {
        ok: false,
        message: r?.message ?? "Sign in to trade.",
        reason: settleFailReason(r, "funds"),
      };
    }

    const filledKwh = result.kwh;
    let orders = nextOrders;
    if (remaining > DUST_KWH && options.limit != null) {
      const listed = await hooks.listRest("bid", remaining, options.limit);
      if (listed) {
        orders = [myOrder("bid", remaining, options.limit, hooks.peerName, hooks.peerArea), ...orders];
      }
    }

    const newTxs = quote.legs.map((leg, i) =>
      txFromLeg(leg, "buy", result.block.blockNo, hooks.peerName, "trade", {
        note:
          quote.legs.length > 1
            ? `Leg ${i + 1} of ${quote.legs.length} · ${leg.kwh.toFixed(1)} kWh from ${leg.peer}`
            : undefined,
      }),
    );

    set({
      pending: false,
      wallet: result.wallet ? { ...result.wallet } : state.wallet,
      orders,
      txs: [...newTxs, ...state.txs].slice(0, 40),
      totalTradedKwh: round1(state.totalTradedKwh + filledKwh),
      block: result.block.blockNo,
      selectedOrderId: null,
    });

    const leftover = remaining > DUST_KWH ? ` Resting bid for ${remaining.toFixed(1)} kWh.` : "";
    return {
      ok: true,
      message: `Bought ${filledKwh.toFixed(1)} kWh for ₹${result.amountInr.toFixed(2)} · block ${result.block.blockNo}.${leftover}`,
      kwh: filledKwh,
      amountInr: result.amountInr,
      block: result.block.blockNo,
    };
  },

  sell: async (kwh, options, hooks) => {
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

    const { quote, remaining, nextOrders } = routeFill(state.orders, "bid", kwh, {
      limit: options.limit,
      preferOrderId: options.preferOrderId ?? state.selectedOrderId ?? undefined,
      referencePrice: state.price,
    });

    set({ pending: true });
    await sleep(420);
    const result = await hooks.settle(quote.legs.map(toLeg));
    if (!result || !result.ok) {
      set({ pending: false });
      const r = result as SettleError | null;
      return {
        ok: false,
        message: r?.message ?? "Sign in to trade.",
        reason: settleFailReason(r, "surplus"),
      };
    }

    let orders = nextOrders;
    if (remaining > DUST_KWH) {
      const askPrice = options.limit ?? round2(state.price + 0.08);
      const listed = await hooks.listRest("ask", remaining, askPrice);
      if (listed) {
        orders = [myOrder("ask", remaining, askPrice, hooks.peerName, hooks.peerArea), ...orders];
      }
    }

    const newTxs = quote.legs.map((leg, i) =>
      txFromLeg(leg, "sell", result.block.blockNo, hooks.peerName, "trade", {
        note:
          quote.legs.length > 1
            ? `Leg ${i + 1} of ${quote.legs.length} · ${leg.kwh.toFixed(1)} kWh to ${leg.peer}`
            : undefined,
      }),
    );

    set({
      pending: false,
      wallet: result.wallet ? { ...result.wallet } : state.wallet,
      orders,
      txs: [...newTxs, ...state.txs].slice(0, 40),
      totalTradedKwh: round1(state.totalTradedKwh + result.kwh),
      block: result.block.blockNo,
      selectedOrderId: null,
    });

    if (result.kwh < DUST_KWH) {
      return {
        ok: true,
        message: `Listed ${kwh.toFixed(1)} kWh on the local book · block ${result.block.blockNo}.`,
        kwh: 0,
        amountInr: 0,
        block: result.block.blockNo,
      };
    }
    const leftover = remaining > DUST_KWH ? ` Listed remaining ${remaining.toFixed(1)} kWh.` : "";
    return {
      ok: true,
      message: `Sold ${result.kwh.toFixed(1)} kWh for ₹${result.amountInr.toFixed(2)} · block ${result.block.blockNo}.${leftover}`,
      kwh: result.kwh,
      amountInr: result.amountInr,
      block: result.block.blockNo,
    };
  },

  deal: async (args, hooks) => {
    const state = get();
    if (state.pending || state.dealProgress.running) {
      return { ok: false, message: "A settlement is already in flight.", reason: "pending" };
    }
    if (!state.wallet) return { ok: false, message: "Sign in to trade with a neighbour.", reason: "auth" };

    const order = state.orders.find((o) => o.id === args.orderId);
    if (!order || order.side !== args.side) {
      return { ok: false, message: "That lot is no longer on the book.", reason: "lot" };
    }

    const book = summariseBook(state.orders);
    const evaluated = directDeal({
      order,
      kwh: args.kwh,
      offerPrice: args.offerPrice,
      side: args.side,
      referencePrice: book.mid || state.price,
    });
    if (!evaluated.ok) {
      return {
        ok: false,
        message: evaluated.message,
        reason: evaluated.reason === "unsupported" ? "volume" : evaluated.reason,
      };
    }

    const action: "buy" | "sell" = args.side === "ask" ? "buy" : "sell";
    const price = evaluated.quote.avgPrice;
    const parts = splitInstalments(args.kwh, args.instalments, minDealKwh(order));
    const totalKwh = round1(parts.reduce((s, p) => s + p, 0));

    if (action === "sell" && totalKwh > state.wallet.surplusKwh + 1e-9) {
      return {
        ok: false,
        message: `You only have ${state.wallet.surplusKwh.toFixed(1)} kWh of surplus to deliver.`,
        reason: "surplus",
      };
    }
    const totalCost = round2(totalKwh * price * (1 + evaluated.quote.feeBps / 10_000));
    if (action === "buy" && totalCost > state.wallet.inr + 1e-9) {
      return {
        ok: false,
        message: `This deal needs ${totalCost.toFixed(2)} (incl. grid fee) but your wallet has ${state.wallet.inr.toFixed(2)}.`,
        reason: "funds",
      };
    }

    set({
      pending: true,
      dealProgress: {
        running: true,
        orderId: order.id,
        peer: order.peer,
        done: 0,
        total: parts.length,
        kwhDone: 0,
        inrDone: 0,
        blocks: [],
        note: parts.length > 1 ? `Delivering ${parts.length} instalments…` : "Settling…",
      },
    });

    const blocks: number[] = [];
    let wallet = state.wallet;
    let kwhDone = 0;
    let inrDone = 0;
    let stopReason: { message: string; reason: DealFailReason } | null = null;

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      await sleep(i === 0 ? 380 : 320);
      const result = await hooks.settle([
        { peer: order.peer, peerAddress: order.address, kwh: part, priceInr: price },
      ]);
      if (!result || !result.ok) {
        const r = result as SettleError | null;
        stopReason = {
          message: r?.message ?? "Settlement failed.",
          reason: r?.reason === "funds" ? "funds" : r?.reason === "surplus" ? "surplus" : r?.reason === "chain" ? "chain" : "lot",
        };
        break;
      }

      kwhDone = round1(kwhDone + result.kwh);
      inrDone = round2(inrDone + result.amountInr);
      blocks.push(result.block.blockNo);
      wallet = result.wallet ? { ...result.wallet } : wallet;

      const tx = txFromLeg(
        {
          peer: order.peer,
          peerAddress: order.address,
          kwh: part,
          priceInr: price,
          area: order.area,
          source: order.source,
          distanceKm: order.distanceKm,
        },
        action,
        result.block.blockNo,
        hooks.peerName,
        "deal",
        {
          instalment: parts.length > 1 ? { index: i + 1, of: parts.length } : undefined,
          note:
            parts.length > 1
              ? `Direct P2P deal with ${order.peer} · instalment ${i + 1} of ${parts.length}`
              : `Direct P2P deal with ${order.peer} · ${part.toFixed(1)} of ${order.lotKwh.toFixed(1)} kWh lot`,
        },
      );

      // Merge into the *current* state each time so ambient book/feed activity
      // that landed mid-deal is not clobbered by an earlier snapshot.
      const cur = get();
      set({
        wallet,
        orders: applyDealToBook(cur.orders, order.id, part),
        txs: [tx, ...cur.txs].slice(0, 40),
        block: result.block.blockNo,
        totalTradedKwh: round1(cur.totalTradedKwh + result.kwh),
        dealProgress: {
          running: i < parts.length - 1,
          orderId: order.id,
          peer: order.peer,
          done: i + 1,
          total: parts.length,
          kwhDone,
          inrDone,
          blocks,
          note:
            i < parts.length - 1
              ? `Instalment ${i + 1} of ${parts.length} settled · block ${result.block.blockNo}`
              : `Deal complete · ${parts.length} block${parts.length > 1 ? "s" : ""} minted`,
        },
      });
    }

    set({
      pending: false,
      dealProgress: { ...get().dealProgress, running: false },
      selectedOrderId: null,
    });

    if (kwhDone <= 0) {
      return {
        ok: false,
        message: stopReason?.message ?? "The deal could not be settled.",
        reason: stopReason?.reason ?? "chain",
      };
    }

    const partial = stopReason != null || kwhDone < totalKwh - 1e-9;
    const suffix = partial
      ? ` Stopped early: ${stopReason?.message ?? "not enough volume left."}`
      : "";
    return {
      ok: true,
      message: `${action === "buy" ? "Bought" : "Sold"} ${kwhDone.toFixed(1)} kWh ${action === "buy" ? "from" : "to"} ${order.peer} for ₹${inrDone.toFixed(2)} · block${blocks.length > 1 ? "s" : ""} ${blocks.join(", ")}.${suffix}`,
      kwh: kwhDone,
      amountInr: inrDone,
      blocks,
      instalments: parts.length,
      accepted: evaluated.accepted,
      counterPrice: evaluated.counterPrice,
      partial,
    };
  },
}));

export { MICROGRID, summariseBook };
export type { Order, Transaction };
