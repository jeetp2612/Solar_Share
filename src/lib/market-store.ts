import { create } from "zustand";
import {
  congestionFrom,
  irradianceAt,
  MICROGRID,
  NEIGHBORS,
  SEED_BLOCK,
  SEED_HISTORY,
  SEED_ORDERS,
  SEED_SNAPSHOT,
  SEED_TRADED,
  SEED_TRANSACTIONS,
  snapshotFromHistory,
  USER_ADDRESS,
  USER_NAME,
  buildPriceHistory,
  type Congestion,
  type Mode,
  type Order,
  type PricePoint,
  type Transaction,
  type Wallet,
  type WalletProvider,
} from "./market-data";
import { mockOrderId, mockTxHash } from "./format";

export type TradeResult =
  | { ok: true; message: string }
  | { ok: false; message: string; reason: "wallet" | "funds" | "liquidity" | "surplus" | "pending" };

type MarketState = {
  live: boolean;
  mode: Mode;
  wallet: Wallet | null;
  connectOpen: boolean;
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
  block: number;
  pending: boolean;
  selectedOrderId: string | null;
  startLive: () => void;
  tick: () => void;
  setMode: (mode: Mode) => void;
  openConnect: (open: boolean) => void;
  connectWallet: (provider: WalletProvider) => Promise<void>;
  disconnectWallet: () => void;
  selectOrder: (id: string | null) => void;
  buy: (kwh: number, limitPrice?: number) => Promise<TradeResult>;
  sell: (kwh: number, limitPrice?: number) => Promise<TradeResult>;
};

const MODE_KEY = "solarshare-mode";
const WALLET_KEY = "solarshare-wallet";

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

function fillAgainst(
  book: Order[],
  side: "ask" | "bid",
  kwh: number,
  limit?: number,
): { fills: { order: Order; kwh: number; price: number }[]; remaining: number; next: Order[] } {
  const sorted = book
    .filter((o) => o.side === side)
    .sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price));
  const fills: { order: Order; kwh: number; price: number }[] = [];
  let remaining = kwh;
  const consumed = new Map<string, number>();

  for (const order of sorted) {
    if (remaining <= 0.001) break;
    if (limit != null) {
      if (side === "ask" && order.price > limit + 1e-9) continue;
      if (side === "bid" && order.price < limit - 1e-9) continue;
    }
    const take = Math.min(order.kwh, remaining);
    fills.push({ order, kwh: take, price: order.price });
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

export const useMarket = create<MarketState>((set, get) => ({
  live: false,
  mode: "consumer",
  wallet: null,
  connectOpen: false,
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
  block: SEED_BLOCK,
  pending: false,
  selectedOrderId: null,

  startLive: () => {
    if (get().live) return;
    const now = Date.now();
    const history = buildPriceHistory(now);
    const snap = snapshotFromHistory(history);
    let mode: Mode = "consumer";
    let wallet: Wallet | null = null;
    try {
      const savedMode = localStorage.getItem(MODE_KEY);
      if (savedMode === "prosumer" || savedMode === "consumer") mode = savedMode;
      const savedWallet = localStorage.getItem(WALLET_KEY);
      if (savedWallet) wallet = JSON.parse(savedWallet) as Wallet;
    } catch {
      /* ignore quota / parse */
    }
    const delta = snap.price - SEED_SNAPSHOT.price;
    set({
      live: true,
      history,
      ...snap,
      mode,
      wallet,
      orders: cloneOrders(SEED_ORDERS).map((o) => ({
        ...o,
        price: Number(Math.max(0.05, o.price + delta).toFixed(3)),
      })),
      txs: cloneTxs(SEED_TRANSACTIONS).map((tx, i) => ({
        ...tx,
        timestamp: now - (i + 1) * 95_000,
        price: Number(Math.max(0.05, tx.price + delta).toFixed(3)),
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
    const hour = new Date(now).getUTCHours() - 5;
    const evening = hour >= 16 && hour <= 21 ? 1 : 0;
    const demand = Math.max(
      40,
      last.demand + (Math.random() - 0.48) * 5 + evening * 0.4 - irr * 0.8,
    );
    const imbalance = (demand - supply) / Math.max(supply + demand, 1);
    const target = 0.118 + imbalance * 0.09;
    const price = Number(
      Math.min(0.22, Math.max(0.072, last.price + (target - last.price) * 0.18 + (Math.random() - 0.5) * 0.0024)).toFixed(4),
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
    let txs: Transaction[] = state.txs.map((t) => ({
      ...t,
      fresh: false,
      status: "confirmed",
    }));
    let totalTradedKwh = state.totalTradedKwh;
    let block = state.block + (Math.random() > 0.45 ? 1 : 0);

    // HOOK: swap this block for websocket / contract event listeners.
    if (Math.random() > 0.55) {
      const side: Order["side"] = Math.random() > 0.48 ? "ask" : "bid";
      const peer = nextNeighbor();
      const mid = price;
      const listed: Order = {
        id: mockOrderId(),
        side,
        peer: peer.name,
        address: peer.address,
        kwh: Number((1.5 + Math.random() * 12).toFixed(1)),
        price: Number((mid + (side === "ask" ? 0.002 : -0.004) + (Math.random() - 0.5) * 0.01).toFixed(3)),
        distanceKm: Number((0.2 + Math.random() * 3.2).toFixed(1)),
        source: Math.random() > 0.7 ? "community-array" : "rooftop-pv",
        fresh: true,
      };
      orders = [listed, ...orders].slice(0, 14);
    }

    if (Math.random() > 0.62 && orders.length > 4) {
      const seller = nextNeighbor();
      const buyer = nextNeighbor(seller.address);
      const kwh = Number((1.2 + Math.random() * 6).toFixed(1));
      const tradePrice = Number((price + (Math.random() - 0.5) * 0.008).toFixed(3));
      totalTradedKwh = Number((totalTradedKwh + kwh).toFixed(1));
      block += 1;
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
          block,
          timestamp: now,
          status: "pending" as const,
          fresh: true,
        },
        ...txs,
      ].slice(0, 24);
    }

    const wallet = state.wallet
      ? {
          ...state.wallet,
          surplusKwh:
            state.mode === "prosumer"
              ? Number(Math.min(48, state.wallet.surplusKwh + irr * 0.08).toFixed(2))
              : state.wallet.surplusKwh,
        }
      : null;

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
      block,
      wallet,
    });
  },

  setMode: (mode) => {
    set({ mode, selectedOrderId: null });
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  },

  openConnect: (open) => set({ connectOpen: open }),

  connectWallet: async (provider) => {
    // HOOK: window.ethereum.request({ method: "eth_requestAccounts" })
    // then new BrowserProvider(window.ethereum).getSigner()
    await sleep(640);
    const wallet: Wallet = {
      provider,
      address: USER_ADDRESS,
      usd: 52.4,
      kwhCredits: 2.6,
      surplusKwh: 14.8,
    };
    set({ wallet, connectOpen: false });
    try {
      localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    } catch {
      /* ignore */
    }
  },

  disconnectWallet: () => {
    set({ wallet: null, selectedOrderId: null });
    try {
      localStorage.removeItem(WALLET_KEY);
    } catch {
      /* ignore */
    }
  },

  selectOrder: (id) => set({ selectedOrderId: id }),

  buy: async (kwh, limitPrice) => {
    const state = get();
    if (state.pending) return { ok: false, message: "A settlement is already in flight.", reason: "pending" };
    if (!state.wallet) {
      set({ connectOpen: true });
      return { ok: false, message: "Connect a wallet to buy energy.", reason: "wallet" };
    }
    if (kwh <= 0) return { ok: false, message: "Enter a volume greater than zero.", reason: "liquidity" };

    const selected = state.orders.find((o) => o.id === state.selectedOrderId && o.side === "ask");
    const book = selected ? [selected, ...state.orders.filter((o) => o.id !== selected.id)] : state.orders;
    const { fills, remaining, next } = fillAgainst(book, "ask", kwh, limitPrice);
    if (fills.length === 0) {
      return { ok: false, message: "No asks available at that price.", reason: "liquidity" };
    }

    const cost = fills.reduce((sum, f) => sum + f.kwh * f.price, 0);
    if (cost > state.wallet.usd + 1e-9) {
      return { ok: false, message: "Insufficient USD balance for this fill.", reason: "funds" };
    }

    set({ pending: true });
    // HOOK: EnergyPool.buy(orderId, kwhWei) → wait for tx receipt
    await sleep(780);

    const now = Date.now();
    const filledKwh = Number((kwh - remaining).toFixed(2));
    const avg = cost / filledKwh;
    const block = state.block + 1;
    const newTxs: Transaction[] = fills.map((f, i) => ({
      id: `tx_user_${mockOrderId()}`,
      txHash: mockTxHash(),
      from: f.order.address,
      fromName: f.order.peer,
      to: USER_ADDRESS,
      toName: USER_NAME,
      kwh: f.kwh,
      price: f.price,
      block: block + i,
      timestamp: now,
      status: "pending" as const,
      fresh: true,
    }));

    let orders = next;
    if (remaining > 0.05 && limitPrice != null) {
      orders = [
        {
          id: mockOrderId(),
          side: "bid",
          peer: USER_NAME,
          address: USER_ADDRESS,
          kwh: remaining,
          price: limitPrice,
          distanceKm: 0,
          source: "home-battery",
          fresh: true,
        },
        ...orders,
      ];
    }

    const wallet: Wallet = {
      ...state.wallet,
      usd: Number((state.wallet.usd - cost).toFixed(2)),
      kwhCredits: Number((state.wallet.kwhCredits + filledKwh).toFixed(2)),
    };

    set({
      pending: false,
      wallet,
      orders,
      txs: [...newTxs, ...state.txs].slice(0, 24),
      totalTradedKwh: Number((state.totalTradedKwh + filledKwh).toFixed(1)),
      block: block + fills.length - 1,
      selectedOrderId: null,
    });
    try {
      localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    } catch {
      /* ignore */
    }

    const leftover = remaining > 0.05 ? ` Resting bid for ${remaining.toFixed(1)} kWh.` : "";
    return {
      ok: true,
      message: `Bought ${filledKwh.toFixed(1)} kWh at ${avg.toFixed(3)} USD/kWh.${leftover}`,
    };
  },

  sell: async (kwh, limitPrice) => {
    const state = get();
    if (state.pending) return { ok: false, message: "A settlement is already in flight.", reason: "pending" };
    if (!state.wallet) {
      set({ connectOpen: true });
      return { ok: false, message: "Connect a wallet to sell surplus.", reason: "wallet" };
    }
    if (kwh <= 0) return { ok: false, message: "Enter a volume greater than zero.", reason: "liquidity" };
    if (kwh > state.wallet.surplusKwh + 1e-9) {
      return { ok: false, message: "Not enough surplus solar to list or sell.", reason: "surplus" };
    }

    const selected = state.orders.find((o) => o.id === state.selectedOrderId && o.side === "bid");
    const book = selected ? [selected, ...state.orders.filter((o) => o.id !== selected.id)] : state.orders;
    const { fills, remaining, next } = fillAgainst(book, "bid", kwh, limitPrice);

    set({ pending: true });
    // HOOK: EnergyPool.sell(kwhWei, minPrice) or createAsk(price, kwh)
    await sleep(780);

    const now = Date.now();
    const filledKwh = Number((kwh - remaining).toFixed(2));
    const proceeds = fills.reduce((sum, f) => sum + f.kwh * f.price, 0);
    const block = state.block + 1;
    const newTxs: Transaction[] = fills.map((f, i) => ({
      id: `tx_user_${mockOrderId()}`,
      txHash: mockTxHash(),
      from: USER_ADDRESS,
      fromName: USER_NAME,
      to: f.order.address,
      toName: f.order.peer,
      kwh: f.kwh,
      price: f.price,
      block: block + i,
      timestamp: now,
      status: "pending" as const,
      fresh: true,
    }));

    let orders = next;
    if (remaining > 0.05) {
      const askPrice = limitPrice ?? Number((state.price + 0.004).toFixed(3));
      orders = [
        {
          id: mockOrderId(),
          side: "ask",
          peer: USER_NAME,
          address: USER_ADDRESS,
          kwh: remaining,
          price: askPrice,
          distanceKm: 0,
          source: "rooftop-pv",
          fresh: true,
        },
        ...orders,
      ];
    }

    const wallet: Wallet = {
      ...state.wallet,
      usd: Number((state.wallet.usd + proceeds).toFixed(2)),
      surplusKwh: Number((state.wallet.surplusKwh - kwh).toFixed(2)),
    };

    set({
      pending: false,
      wallet,
      orders,
      txs: [...newTxs, ...state.txs].slice(0, 24),
      totalTradedKwh: Number((state.totalTradedKwh + filledKwh).toFixed(1)),
      block: block + Math.max(fills.length, 1) - 1,
      selectedOrderId: null,
    });
    try {
      localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    } catch {
      /* ignore */
    }

    if (filledKwh < 0.05) {
      return { ok: true, message: `Listed ${kwh.toFixed(1)} kWh on the local book.` };
    }
    const leftover = remaining > 0.05 ? ` Listed remaining ${remaining.toFixed(1)} kWh.` : "";
    return {
      ok: true,
      message: `Sold ${filledKwh.toFixed(1)} kWh for $${proceeds.toFixed(2)}.${leftover}`,
    };
  },
}));

export { MICROGRID };
