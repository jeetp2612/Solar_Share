/**
 * Seed market data for the SolarShare demo.
 *
 * HOOK: replace this module with REST reads against the indexer
 *   GET /api/market/snapshot
 *   GET /api/market/orderbook
 *   GET /api/market/trades
 * and on-chain subscriptions (EnergyPool.sol OrderPosted / TradeSettled).
 */

export type Mode = "prosumer" | "consumer";
export type Congestion = "low" | "medium" | "high";
export type OrderSide = "ask" | "bid";
export type WalletProvider = "injected" | "walletconnect" | "coinbase";

export type Neighbor = {
  name: string;
  address: string;
};

export type Order = {
  id: string;
  side: OrderSide;
  peer: string;
  address: string;
  kwh: number;
  price: number;
  distanceKm: number;
  source: "rooftop-pv" | "community-array" | "home-battery";
  fresh?: boolean;
};

export type Transaction = {
  id: string;
  txHash: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  kwh: number;
  price: number;
  block: number;
  timestamp: number;
  status: "confirmed" | "pending";
  fresh?: boolean;
};

export type PricePoint = {
  t: number;
  price: number;
  supply: number;
  demand: number;
  irradiance: number;
};

export type Wallet = {
  provider: WalletProvider;
  address: string;
  usd: number;
  kwhCredits: number;
  surplusKwh: number;
};

export const MICROGRID = {
  name: "Eastside Microgrid",
  city: "Austin, TX",
  node: 14,
  nodesOnline: 47,
  contract: "0xE41c8A90B2d7C6f13A44E8b9C0D1F2a3B4c5D6e7",
};

export const USER_ADDRESS = "0x7F3a91C2E1b4d890Ab33C4De";
export const USER_NAME = "You";

export const GENESIS = Date.UTC(2026, 8, 11, 12, 0, 0);
export const SEED_BLOCK = 19_204_331;

export const NEIGHBORS: Neighbor[] = [
  { name: "Chen Rooftop", address: "0x3A91bC82e4D14F7A12c8B0E1" },
  { name: "Rivera Solar", address: "0x8B12d90aF33C71e6A4b2D908" },
  { name: "Oak Street Co-op", address: "0x1C77A4e90B12D33f88E1a0C4" },
  { name: "Patel Residence", address: "0x9D04c18B77A2e1F0C3d5A691" },
  { name: "Lakeside Array", address: "0x52E8b01C94a7D3f6B2e0A118" },
  { name: "Nguyen Household", address: "0x6F11c0A83D29e4B7a1C5E902" },
  { name: "Westside Commons", address: "0xA03e91C4b8D27F5a6E10B334" },
  { name: "Garcia Barn", address: "0x4B88d12A09c3E7f1B6a0D245" },
  { name: "Harbor Microgrid", address: "0xC21a70E8d4B39F6c5A12e087" },
  { name: "Kim Family", address: "0x0E55b19C82a4D7F3c6A1B098" },
];

export const SEED_ORDERS: Order[] = [
  {
    id: "ord_01",
    side: "ask",
    peer: "Chen Rooftop",
    address: "0x3A91bC82e4D14F7A12c8B0E1",
    kwh: 8.4,
    price: 0.108,
    distanceKm: 0.4,
    source: "rooftop-pv",
  },
  {
    id: "ord_02",
    side: "ask",
    peer: "Lakeside Array",
    address: "0x52E8b01C94a7D3f6B2e0A118",
    kwh: 22.0,
    price: 0.111,
    distanceKm: 1.6,
    source: "community-array",
  },
  {
    id: "ord_03",
    side: "ask",
    peer: "Rivera Solar",
    address: "0x8B12d90aF33C71e6A4b2D908",
    kwh: 5.2,
    price: 0.114,
    distanceKm: 0.7,
    source: "rooftop-pv",
  },
  {
    id: "ord_04",
    side: "ask",
    peer: "Oak Street Co-op",
    address: "0x1C77A4e90B12D33f88E1a0C4",
    kwh: 14.8,
    price: 0.117,
    distanceKm: 1.1,
    source: "community-array",
  },
  {
    id: "ord_05",
    side: "ask",
    peer: "Garcia Barn",
    address: "0x4B88d12A09c3E7f1B6a0D245",
    kwh: 9.6,
    price: 0.121,
    distanceKm: 2.4,
    source: "rooftop-pv",
  },
  {
    id: "ord_06",
    side: "ask",
    peer: "Kim Family",
    address: "0x0E55b19C82a4D7F3c6A1B098",
    kwh: 3.1,
    price: 0.126,
    distanceKm: 0.3,
    source: "home-battery",
  },
  {
    id: "ord_07",
    side: "bid",
    peer: "Patel Residence",
    address: "0x9D04c18B77A2e1F0C3d5A691",
    kwh: 6.0,
    price: 0.104,
    distanceKm: 0.9,
    source: "home-battery",
  },
  {
    id: "ord_08",
    side: "bid",
    peer: "Nguyen Household",
    address: "0x6F11c0A83D29e4B7a1C5E902",
    kwh: 4.5,
    price: 0.101,
    distanceKm: 1.3,
    source: "rooftop-pv",
  },
  {
    id: "ord_09",
    side: "bid",
    peer: "Westside Commons",
    address: "0xA03e91C4b8D27F5a6E10B334",
    kwh: 18.0,
    price: 0.097,
    distanceKm: 2.1,
    source: "community-array",
  },
  {
    id: "ord_10",
    side: "bid",
    peer: "Harbor Microgrid",
    address: "0xC21a70E8d4B39F6c5A12e087",
    kwh: 11.2,
    price: 0.094,
    distanceKm: 3.0,
    source: "community-array",
  },
];

export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_15",
    txHash: "0x8f2c1a90b3d47e6c12a0f88b91c3d5e7a4b6c8d0e1f23456789abcde01",
    from: "0x3A91bC82e4D14F7A12c8B0E1",
    fromName: "Chen Rooftop",
    to: "0x9D04c18B77A2e1F0C3d5A691",
    toName: "Patel Residence",
    kwh: 5.0,
    price: 0.112,
    block: 19_204_328,
    timestamp: GENESIS + 5.7 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_14",
    txHash: "0xa11c0e83d29f4b7a1c5e9026f11c0a83d29e4b7a1c5e9026f11c0a83d2",
    from: "0x52E8b01C94a7D3f6B2e0A118",
    fromName: "Lakeside Array",
    to: "0x6F11c0A83D29e4B7a1C5E902",
    toName: "Nguyen Household",
    kwh: 12.4,
    price: 0.109,
    block: 19_204_322,
    timestamp: GENESIS + 5.45 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_13",
    txHash: "0xb03e91c4b8d27f5a6e10b334a03e91c4b8d27f5a6e10b334a03e91c4b8",
    from: "0x8B12d90aF33C71e6A4b2D908",
    fromName: "Rivera Solar",
    to: "0xA03e91C4b8D27F5a6E10B334",
    toName: "Westside Commons",
    kwh: 3.8,
    price: 0.115,
    block: 19_204_315,
    timestamp: GENESIS + 5.2 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_12",
    txHash: "0xc21a70e8d4b39f6c5a12e087c21a70e8d4b39f6c5a12e087c21a70e8d4",
    from: "0x1C77A4e90B12D33f88E1a0C4",
    fromName: "Oak Street Co-op",
    to: "0xC21a70E8d4B39F6c5A12e087",
    toName: "Harbor Microgrid",
    kwh: 9.0,
    price: 0.107,
    block: 19_204_301,
    timestamp: GENESIS + 4.9 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_11",
    txHash: "0xd04c18b77a2e1f0c3d5a6919d04c18b77a2e1f0c3d5a6919d04c18b77a",
    from: "0x4B88d12A09c3E7f1B6a0D245",
    fromName: "Garcia Barn",
    to: "0x0E55b19C82a4D7F3c6A1B098",
    toName: "Kim Family",
    kwh: 2.6,
    price: 0.119,
    block: 19_204_288,
    timestamp: GENESIS + 4.55 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_10",
    txHash: "0xe55b19c82a4d7f3c6a1b0980e55b19c82a4d7f3c6a1b0980e55b19c82a",
    from: "0x52E8b01C94a7D3f6B2e0A118",
    fromName: "Lakeside Array",
    to: "0x9D04c18B77A2e1F0C3d5A691",
    toName: "Patel Residence",
    kwh: 7.5,
    price: 0.11,
    block: 19_204_274,
    timestamp: GENESIS + 4.2 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_09",
    txHash: "0xf3a91c2e1b4d890ab33c4de7f3a91c2e1b4d890ab33c4de7f3a91c2e1b",
    from: "0x3A91bC82e4D14F7A12c8B0E1",
    fromName: "Chen Rooftop",
    to: "0x6F11c0A83D29e4B7a1C5E902",
    toName: "Nguyen Household",
    kwh: 4.2,
    price: 0.113,
    block: 19_204_261,
    timestamp: GENESIS + 3.85 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_08",
    txHash: "0x012c8b0e13a91bc82e4d14f7a12c8b0e13a91bc82e4d14f7a12c8b0e13",
    from: "0x0E55b19C82a4D7F3c6A1B098",
    fromName: "Kim Family",
    to: "0xA03e91C4b8D27F5a6E10B334",
    toName: "Westside Commons",
    kwh: 1.8,
    price: 0.122,
    block: 19_204_249,
    timestamp: GENESIS + 3.5 * 3_600_000,
    status: "confirmed",
  },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Austin CDT = UTC-5. */
export function austinDecimalHour(ts: number): number {
  const d = new Date(ts);
  const hour = (d.getUTCHours() - 5 + 24) % 24;
  return hour + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

export function irradianceAt(ts: number, rand = () => 0.5): number {
  const hour = austinDecimalHour(ts);
  if (hour < 6.2 || hour > 19.4) return 0.02 + rand() * 0.015;
  const t = (hour - 6.2) / (19.4 - 6.2);
  return Math.pow(Math.sin(t * Math.PI), 1.12) * (0.92 + rand() * 0.08);
}

export function congestionFrom(supply: number, demand: number): Congestion {
  const load = demand / Math.max(supply, 1);
  if (load > 1.12) return "high";
  if (load > 0.88) return "medium";
  return "low";
}

export function buildPriceHistory(endTs: number, points = 72): PricePoint[] {
  const rand = mulberry32(20260911);
  const step = 5 * 60 * 1000;
  const start = endTs - points * step;
  const out: PricePoint[] = [];
  let price = 0.142;

  for (let i = 0; i <= points; i += 1) {
    const t = start + i * step;
    const irr = irradianceAt(t, rand);
    const supply = 40 + irr * 220 + rand() * 8;
    const hour = austinDecimalHour(t);
    const evening = hour > 16 && hour < 21 ? (hour - 16) / 5 : 0;
    const morning = hour > 6 && hour < 9 ? (9 - hour) / 3 : 0;
    const demand = 95 + evening * 90 + morning * 35 + (1 - irr) * 28 + rand() * 10;
    const imbalance = (demand - supply) / Math.max(supply + demand, 1);
    const target = 0.118 + imbalance * 0.09;
    price = price + (target - price) * 0.22 + (rand() - 0.5) * 0.003;
    price = Math.min(0.22, Math.max(0.072, price));
    out.push({
      t,
      price: Number(price.toFixed(4)),
      supply: Number(supply.toFixed(1)),
      demand: Number(demand.toFixed(1)),
      irradiance: Number(irr.toFixed(3)),
    });
  }
  return out;
}

export function snapshotFromHistory(history: PricePoint[]) {
  const last = history[history.length - 1];
  const prev = history[history.length - 2] ?? last;
  return {
    price: last.price,
    priceDelta: last.price - prev.price,
    supplyKwh: last.supply,
    demandKwh: last.demand,
    irradiance: last.irradiance,
    congestion: congestionFrom(last.supply, last.demand),
  };
}

export const SEED_HISTORY = buildPriceHistory(GENESIS + 6 * 3_600_000);
export const SEED_SNAPSHOT = snapshotFromHistory(SEED_HISTORY);
export const SEED_TRADED = SEED_TRANSACTIONS.reduce((sum, tx) => sum + tx.kwh, 0) + 184.6;
