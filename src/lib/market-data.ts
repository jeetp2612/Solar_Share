/**
 * Seed market data for the SolarShare demo — Mumbai rooftop microgrid.
 *
 * All prices are INR per kWh (retail solar P2P band in India is roughly
 * ₹4–₹12/kWh depending on city & tariff). The live book is simulated client-side;
 * user settlements are written to the SQL ledger (see src/lib/solar/).
 */

export type Congestion = "low" | "medium" | "high";
export type OrderSide = "ask" | "bid";

export type Neighbor = {
  name: string;
  area: string;
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
  /** On-chain block number (user settlements) — undefined = local match. */
  block?: number;
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

/**
 * User wallet — the shape the server returns (authoritative copy lives in
 * SQL, see src/lib/solar/api.ts).
 */
export type Wallet = {
  /** INR cash balance. */
  inr: number;
  /** Energy bought, available to consume. */
  kwhCredits: number;
  /** Solar surplus generated so far, available to sell. */
  surplusKwh: number;
  /** Rooftop array size the profile reports, kWp. */
  panelKwp: number;
  /** Instantaneous generation, kW. */
  generatingKw: number;
  /** Lifetime INR earned from selling. */
  totalEarnedInr: number;
  /** Lifetime INR spent on buying. */
  totalSpentInr: number;
  /** Lifetime kWh sold. */
  totalSoldKwh: number;
  /** Lifetime kWh bought. */
  totalBoughtKwh: number;
};

export const MICROGRID = {
  name: "Mumbai Rooftop Microgrid",
  city: "Mumbai, MH",
  feeder: "BKC–Andheri Feeder 14",
  nodesOnline: 47,
  matcher: "EnergyPool · Mumbai v2",
};

export const WELCOME_INR = 500;

export const GENESIS = Date.UTC(2026, 8, 11, 12, 0, 0);

export const NEIGHBORS: Neighbor[] = [
  { name: "Sharma Rooftop", area: "Andheri", address: "0x3A91bC82e4D14F7A12c8B0E1" },
  { name: "Patel Solar", area: "Powai", address: "0x8B12d90aF33C71e6A4b2D908" },
  { name: "Nair Residence", area: "Bandra", address: "0x1C77A4e90B12D33f88E1a0C4" },
  { name: "Chopra PV", area: "BKC", address: "0x9D04c18B77A2e1F0C3d5A691" },
  { name: "Iyer Co-op", area: "Dadar", address: "0x52E8b01C94a7D3f6B2e0A118" },
  { name: "Verma Household", area: "Thane", address: "0x6F11c0A83D29e4B7a1C5E902" },
  { name: "Kulkarni Array", area: "Powai", address: "0xA03e91C4b8D27F5a6E10B334" },
  { name: "Reddy Solar", area: "Andheri W", address: "0x4B88d12A09c3E7f1B6a0D245" },
  { name: "Gupta Residence", area: "Malad", address: "0xC21a70E8d4B39F6c5A12e087" },
  { name: "Mehta Rooftop", area: "Juhu", address: "0x0E55b19C82a4D7F3c6A1B098" },
];

export const SEED_ORDERS: Order[] = [
  { id: "ord_01", side: "ask", peer: "Sharma Rooftop", address: "0x3A91bC82e4D14F7A12c8B0E1", kwh: 8.4, price: 8.2, distanceKm: 0.4, source: "rooftop-pv" },
  { id: "ord_02", side: "ask", peer: "Iyer Co-op", address: "0x52E8b01C94a7D3f6B2e0A118", kwh: 22.0, price: 8.5, distanceKm: 1.6, source: "community-array" },
  { id: "ord_03", side: "ask", peer: "Patel Solar", address: "0x8B12d90aF33C71e6A4b2D908", kwh: 5.2, price: 8.7, distanceKm: 0.7, source: "rooftop-pv" },
  { id: "ord_04", side: "ask", peer: "Kulkarni Array", address: "0xA03e91C4b8D27F5a6E10B334", kwh: 14.8, price: 8.9, distanceKm: 1.1, source: "community-array" },
  { id: "ord_05", side: "ask", peer: "Reddy Solar", address: "0x4B88d12A09c3E7f1B6a0D245", kwh: 9.6, price: 9.3, distanceKm: 2.4, source: "rooftop-pv" },
  { id: "ord_06", side: "ask", peer: "Mehta Rooftop", address: "0x0E55b19C82a4D7F3c6A1B098", kwh: 3.1, price: 9.8, distanceKm: 0.3, source: "home-battery" },
  { id: "ord_07", side: "bid", peer: "Nair Residence", address: "0x1C77A4e90B12D33f88E1a0C4", kwh: 6.0, price: 7.9, distanceKm: 0.9, source: "home-battery" },
  { id: "ord_08", side: "bid", peer: "Verma Household", address: "0x6F11c0A83D29e4B7a1C5E902", kwh: 4.5, price: 7.6, distanceKm: 1.3, source: "rooftop-pv" },
  { id: "ord_09", side: "bid", peer: "Gupta Residence", address: "0xC21a70E8d4B39F6c5A12e087", kwh: 18.0, price: 7.3, distanceKm: 2.1, source: "community-array" },
  { id: "ord_10", side: "bid", peer: "Chopra PV", address: "0x9D04c18B77A2e1F0C3d5A691", kwh: 11.2, price: 7.1, distanceKm: 3.0, source: "community-array" },
];

export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_15",
    txHash: "0x8f2c1a90b3d47e6c12a0f88b91c3d5e7a4b6c8d0e1f23456789abcde01",
    from: "0x3A91bC82e4D14F7A12c8B0E1",
    fromName: "Sharma Rooftop",
    to: "0x1C77A4e90B12D33f88E1a0C4",
    toName: "Nair Residence",
    kwh: 5.0,
    price: 8.4,
    timestamp: GENESIS + 5.7 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_14",
    txHash: "0xa11c0e83d29f4b7a1c5e9026f11c0a83d29e4b7a1c5e9026f11c0a83d2",
    from: "0x52E8b01C94a7D3f6B2e0A118",
    fromName: "Iyer Co-op",
    to: "0x6F11c0A83D29e4B7a1C5E902",
    toName: "Verma Household",
    kwh: 12.4,
    price: 8.2,
    timestamp: GENESIS + 5.45 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_13",
    txHash: "0xb03e91c4b8d27f5a6e10b334a03e91c4b8d27f5a6e10b334a03e91c4b8",
    from: "0x8B12d90aF33C71e6A4b2D908",
    fromName: "Patel Solar",
    to: "0xC21a70E8d4B39F6c5A12e087",
    toName: "Gupta Residence",
    kwh: 3.8,
    price: 8.7,
    timestamp: GENESIS + 5.2 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_12",
    txHash: "0xc21a70e8d4b39f6c5a12e087c21a70e8d4b39f6c5a12e087c21a70e8d4",
    from: "0xA03e91C4b8D27F5a6E10B334",
    fromName: "Kulkarni Array",
    to: "0x9D04c18B77A2e1F0C3d5A691",
    toName: "Chopra PV",
    kwh: 9.0,
    price: 8.1,
    timestamp: GENESIS + 4.9 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_11",
    txHash: "0xd04c18b77a2e1f0c3d5a6919d04c18b77a2e1f0c3d5a6919d04c18b77a",
    from: "0x4B88d12A09c3E7f1B6a0D245",
    fromName: "Reddy Solar",
    to: "0x0E55b19C82a4D7F3c6A1B098",
    toName: "Mehta Rooftop",
    kwh: 2.6,
    price: 8.9,
    timestamp: GENESIS + 4.55 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_10",
    txHash: "0xe55b19c82a4d7f3c6a1b0980e55b19c82a4d7f3c6a1b0980e55b19c82a",
    from: "0x52E8b01C94a7D3f6B2e0A118",
    fromName: "Iyer Co-op",
    to: "0x1C77A4e90B12D33f88E1a0C4",
    toName: "Nair Residence",
    kwh: 7.5,
    price: 8.5,
    timestamp: GENESIS + 4.2 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_09",
    txHash: "0xf3a91c2e1b4d890ab33c4de7f3a91c2e1b4d890ab33c4de7f3a91c2e1b",
    from: "0x3A91bC82e4D14F7A12c8B0E1",
    fromName: "Sharma Rooftop",
    to: "0x6F11c0A83D29e4B7a1C5E902",
    toName: "Verma Household",
    kwh: 4.2,
    price: 8.6,
    timestamp: GENESIS + 3.85 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_08",
    txHash: "0x012c8b0e13a91bc82e4d14f7a12c8b0e13a91bc82e4d14f7a12c8b0e13",
    from: "0x0E55b19C82a4D7F3c6A1B098",
    fromName: "Mehta Rooftop",
    to: "0xC21a70E8d4B39F6c5A12e087",
    toName: "Gupta Residence",
    kwh: 1.8,
    price: 9.1,
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

/**
 * IST decimal hour (India Standard Time = UTC+5:30), e.g. 13.5 for 13:30 IST.
 */
export function istDecimalHour(ts: number): number {
  const d = new Date(ts);
  const hour = (d.getUTCHours() + 5.5 + 24) % 24;
  return hour + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

/**
 * Clear-sky solar irradiance factor (0..1) for Mumbai latitude (~19°N).
 * Usable from both Node (server) and browser (client).
 */
export function irradianceAt(ts: number, rand: () => number = () => 0.5): number {
  const hour = istDecimalHour(ts);
  if (hour < 6.3 || hour > 19.2) return 0.02 + rand() * 0.015;
  const t = (hour - 6.3) / (19.2 - 6.3);
  return Math.pow(Math.sin(t * Math.PI), 1.12) * (0.92 + rand() * 0.08);
}

export function congestionFrom(supply: number, demand: number): Congestion {
  const load = demand / Math.max(supply, 1);
  if (load > 1.12) return "high";
  if (load > 0.88) return "medium";
  return "low";
}

export const PRICE = {
  /** Reference clearing price, INR/kWh. */
  base: 8.5,
  min: 5.5,
  max: 13.5,
  /** How hard supply/demand imbalance pulls price away from base. */
  swing: 3.2,
};

export function buildPriceHistory(endTs: number, points = 72): PricePoint[] {
  const rand = mulberry32(20260911);
  const step = 5 * 60 * 1000;
  const start = endTs - points * step;
  const out: PricePoint[] = [];
  let price = 8.4;

  for (let i = 0; i <= points; i += 1) {
    const t = start + i * step;
    const irr = irradianceAt(t, rand);
    const supply = 40 + irr * 220 + rand() * 8;
    const hour = istDecimalHour(t);
    const evening = hour > 16 && hour < 21 ? (hour - 16) / 5 : 0;
    const morning = hour > 6 && hour < 9 ? (9 - hour) / 3 : 0;
    const demand = 95 + evening * 90 + morning * 35 + (1 - irr) * 28 + rand() * 10;
    const imbalance = (demand - supply) / Math.max(supply + demand, 1);
    const target = PRICE.base + imbalance * PRICE.swing;
    price = price + (target - price) * 0.22 + (rand() - 0.5) * 0.03;
    price = Math.min(PRICE.max, Math.max(PRICE.min, price));
    out.push({
      t,
      price: Number(price.toFixed(3)),
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
