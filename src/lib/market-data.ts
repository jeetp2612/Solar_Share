/**
 * Seed market data for the SolarShare demo — Mumbai rooftop microgrid.
 *
 * All prices are INR per kWh (retail solar P2P band in India is roughly
 * ₹4–₹12/kWh depending on city & tariff). The live book is simulated client-side;
 * user settlements are written to the SQL ledger (see src/lib/solar/).
 *
 * Every lot carries the fields the marketplace needs to trade *directly* with a
 * named neighbour: area, distance, source, reliability, how much of the lot is
 * left, the smallest partial slice the seller accepts (`minSplitKwh`) and
 * whether they accept delivery in instalments.
 */

export type Congestion = "low" | "medium" | "high";
export type OrderSide = "ask" | "bid";
export type EnergySource = "rooftop-pv" | "community-array" | "home-battery";

/** What a row in the trade feed represents. */
export type FeedKind = "trade" | "deal" | "listing" | "topup" | "withdraw" | "grid";

export type Neighbor = {
  name: string;
  area: string;
  address: string;
  /** 0..5 — how reliably their settlements have confirmed. */
  reliability: number;
  /** Lifetime settled trades on this feeder. */
  settled: number;
  source: EnergySource;
};

export type Order = {
  id: string;
  side: OrderSide;
  peer: string;
  address: string;
  /** kWh still available in this lot. */
  kwh: number;
  /** Original lot size — used for the "partially filled" bar. */
  lotKwh: number;
  price: number;
  distanceKm: number;
  area: string;
  source: EnergySource;
  /** 0..5 peer reliability. */
  reliability: number;
  /** Lifetime settled trades for this peer. */
  settled: number;
  /** Smallest partial slice this seller accepts (direct P2P deals). */
  minSplitKwh: number;
  /** Whether delivery can be split into instalments. */
  allowsInstalments: boolean;
  fresh?: boolean;
};

export type Transaction = {
  id: string;
  txHash: string;
  kind: FeedKind;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  kwh: number;
  price: number;
  /** Total INR moved (kWh × price for trades, flat for money events). */
  totalInr: number;
  area?: string;
  source?: EnergySource;
  distanceKm?: number;
  /** On-chain block number (member settlements) — undefined = local match. */
  block?: number;
  timestamp: number;
  status: "confirmed" | "pending";
  /** Involves the signed-in member. */
  mine?: boolean;
  /** Delivery instalment marker, e.g. 2 of 4. */
  instalment?: { index: number; of: number };
  note?: string;
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

/** Grid fee taken on member settlements — 1% of notional, shown everywhere. */
export const GRID_FEE_BPS = 100;

/** Areas on this feeder, used for filters + ambient events. */
export const AREAS = [
  "Andheri",
  "Andheri W",
  "Powai",
  "Bandra",
  "BKC",
  "Dadar",
  "Thane",
  "Malad",
  "Juhu",
] as const;

/** Human label per energy source (marketplace + feed). */
export const SOURCE_LABEL: Record<EnergySource, string> = {
  "rooftop-pv": "Rooftop PV",
  "community-array": "Community array",
  "home-battery": "Home battery",
};

export const NEIGHBORS: Neighbor[] = [
  { name: "Sharma Rooftop", area: "Andheri", address: "0x3A91bC82e4D14F7A12c8B0E1", reliability: 4.9, settled: 212, source: "rooftop-pv" },
  { name: "Patel Solar", area: "Powai", address: "0x8B12d90aF33C71e6A4b2D908", reliability: 4.7, settled: 168, source: "rooftop-pv" },
  { name: "Nair Residence", area: "Bandra", address: "0x1C77A4e90B12D33f88E1a0C4", reliability: 4.8, settled: 94, source: "home-battery" },
  { name: "Chopra PV", area: "BKC", address: "0x9D04c18B77A2e1F0C3d5A691", reliability: 4.4, settled: 331, source: "community-array" },
  { name: "Iyer Co-op", area: "Dadar", address: "0x52E8b01C94a7D3f6B2e0A118", reliability: 5.0, settled: 540, source: "community-array" },
  { name: "Verma Household", area: "Thane", address: "0x6F11c0A83D29e4B7a1C5E902", reliability: 4.2, settled: 57, source: "rooftop-pv" },
  { name: "Kulkarni Array", area: "Powai", address: "0xA03e91C4b8D27F5a6E10B334", reliability: 4.6, settled: 289, source: "community-array" },
  { name: "Reddy Solar", area: "Andheri W", address: "0x4B88d12A09c3E7f1B6a0D245", reliability: 4.5, settled: 143, source: "rooftop-pv" },
  { name: "Gupta Residence", area: "Malad", address: "0xC21a70E8d4B39F6c5A12e087", reliability: 4.1, settled: 38, source: "home-battery" },
  { name: "Mehta Rooftop", area: "Juhu", address: "0x0E55b19C82a4D7F3c6A1B098", reliability: 4.8, settled: 121, source: "home-battery" },
];

const byName = (name: string): Neighbor => NEIGHBORS.find((n) => n.name === name) ?? NEIGHBORS[0];

/** Build a lot, filling area/reliability/source from the neighbour registry. */
function lot(
  id: string,
  side: OrderSide,
  peerName: string,
  kwh: number,
  price: number,
  distanceKm: number,
  minSplitKwh = 0.5,
  allowsInstalments = true,
): Order {
  const n = byName(peerName);
  return {
    id,
    side,
    peer: n.name,
    address: n.address,
    kwh,
    lotKwh: kwh,
    price,
    distanceKm,
    area: n.area,
    source: n.source,
    reliability: n.reliability,
    settled: n.settled,
    minSplitKwh,
    allowsInstalments,
  };
}

export const SEED_ORDERS: Order[] = [
  lot("ord_01", "ask", "Sharma Rooftop", 8.4, 8.2, 0.4, 0.5),
  lot("ord_02", "ask", "Iyer Co-op", 22.0, 8.5, 1.6, 1.0),
  lot("ord_03", "ask", "Patel Solar", 5.2, 8.7, 0.7, 0.5),
  lot("ord_04", "ask", "Kulkarni Array", 14.8, 8.9, 1.1, 1.0),
  lot("ord_05", "ask", "Reddy Solar", 9.6, 9.3, 2.4, 0.5, false),
  lot("ord_06", "ask", "Mehta Rooftop", 3.1, 9.8, 0.3, 0.2),
  lot("ord_07", "bid", "Nair Residence", 6.0, 7.9, 0.9, 0.5),
  lot("ord_08", "bid", "Verma Household", 4.5, 7.6, 1.3, 0.5, false),
  lot("ord_09", "bid", "Gupta Residence", 18.0, 7.3, 2.1, 1.0),
  lot("ord_10", "bid", "Chopra PV", 11.2, 7.1, 3.0, 1.0),
];

/**
 * Seed feed — deliberately *mixed*: member trades, direct P2P deals (including a
 * 3-part instalment delivery), new listings, a UPI top-up and two grid events.
 * That variety is what makes the feed read like a live feeder instead of one
 * repeated sentence.
 */
export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_18",
    txHash: "0x7d41c0a9b8e23f6d15c0a88b91c3d5e7a4b6c8d0e1f23456789abcde91",
    kind: "deal",
    from: "0x52E8b01C94a7D3f6B2e0A118",
    fromName: "Iyer Co-op",
    to: "0x6F11c0A83D29e4B7a1C5E902",
    toName: "Verma Household",
    kwh: 4.0,
    price: 8.4,
    totalInr: 33.6,
    area: "Dadar",
    source: "community-array",
    distanceKm: 1.6,
    timestamp: GENESIS + 5.95 * 3_600_000,
    status: "confirmed",
    instalment: { index: 2, of: 3 },
    note: "Direct P2P deal · instalment 2 of 3",
  },
  {
    id: "tx_17",
    txHash: "0x2b81e4c07a93d5f1b6e20c88b91c3d5e7a4b6c8d0e1f23456789abcd77",
    kind: "listing",
    from: "0x4B88d12A09c3E7f1B6a0D245",
    fromName: "Reddy Solar",
    to: "Marketplace",
    toName: "Marketplace",
    kwh: 9.6,
    price: 9.3,
    totalInr: 89.28,
    area: "Andheri W",
    source: "rooftop-pv",
    distanceKm: 2.4,
    timestamp: GENESIS + 5.88 * 3_600_000,
    status: "confirmed",
    note: "New ask listed on the feeder book",
  },
  {
    id: "tx_16",
    txHash: "0x91af03d7c2b48e6a15f0c88b91c3d5e7a4b6c8d0e1f23456789abcde55",
    kind: "grid",
    from: "MSEDCL",
    fromName: "MSEDCL Feeder 14",
    to: "Microgrid",
    toName: "Microgrid",
    kwh: 0,
    price: 0,
    totalInr: 0,
    area: "BKC",
    timestamp: GENESIS + 5.82 * 3_600_000,
    status: "confirmed",
    note: "Feeder congestion eased — local solar covering 78% of load",
  },
  {
    id: "tx_15",
    txHash: "0x8f2c1a90b3d47e6c12a0f88b91c3d5e7a4b6c8d0e1f23456789abcde01",
    kind: "trade",
    from: "0x3A91bC82e4D14F7A12c8B0E1",
    fromName: "Sharma Rooftop",
    to: "0x1C77A4e90B12D33f88E1a0C4",
    toName: "Nair Residence",
    kwh: 5.0,
    price: 8.4,
    totalInr: 42.0,
    area: "Andheri",
    source: "rooftop-pv",
    distanceKm: 0.4,
    timestamp: GENESIS + 5.7 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_14b",
    txHash: "0x5c02ab917d3e48f0c6b1a908f1c2b3d4e5f60718293a4b5c6d7e8f90a1b2c3",
    kind: "topup",
    from: "UPI",
    fromName: "UPI · primary",
    to: "0x0E55b19C82a4D7F3c6A1B098",
    toName: "Mehta Rooftop",
    kwh: 0,
    price: 0,
    totalInr: 500,
    area: "Juhu",
    timestamp: GENESIS + 5.6 * 3_600_000,
    status: "confirmed",
    note: "Wallet top-up via UPI",
  },
  {
    id: "tx_14",
    txHash: "0xa11c0e83d29f4b7a1c5e9026f11c0a83d29e4b7a1c5e9026f11c0a83d2",
    kind: "trade",
    from: "0x52E8b01C94a7D3f6B2e0A118",
    fromName: "Iyer Co-op",
    to: "0x6F11c0A83D29e4B7a1C5E902",
    toName: "Verma Household",
    kwh: 12.4,
    price: 8.2,
    totalInr: 101.68,
    area: "Dadar",
    source: "community-array",
    distanceKm: 1.6,
    timestamp: GENESIS + 5.45 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_13",
    txHash: "0xb03e91c4b8d27f5a6e10b334a03e91c4b8d27f5a6e10b334a03e91c4b8",
    kind: "deal",
    from: "0x8B12d90aF33C71e6A4b2D908",
    fromName: "Patel Solar",
    to: "0xC21a70E8d4B39F6c5A12e087",
    toName: "Gupta Residence",
    kwh: 3.8,
    price: 8.7,
    totalInr: 33.06,
    area: "Powai",
    source: "rooftop-pv",
    distanceKm: 0.7,
    timestamp: GENESIS + 5.2 * 3_600_000,
    status: "confirmed",
    note: "Direct P2P deal · partial lot (3.8 of 5.2 kWh)",
  },
  {
    id: "tx_12",
    txHash: "0xc21a70e8d4b39f6c5a12e087c21a70e8d4b39f6c5a12e087c21a70e8d4",
    kind: "trade",
    from: "0xA03e91C4b8D27F5a6E10B334",
    fromName: "Kulkarni Array",
    to: "0x9D04c18B77A2e1F0C3d5A691",
    toName: "Chopra PV",
    kwh: 9.0,
    price: 8.1,
    totalInr: 72.9,
    area: "Powai",
    source: "community-array",
    distanceKm: 1.1,
    timestamp: GENESIS + 4.9 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_11b",
    txHash: "0x0f31bc827e4a95d06f1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60",
    kind: "grid",
    from: "MSEDCL",
    fromName: "MSEDCL Feeder 14",
    to: "Microgrid",
    toName: "Microgrid",
    kwh: 0,
    price: 0,
    totalInr: 0,
    area: "Andheri",
    timestamp: GENESIS + 4.72 * 3_600_000,
    status: "confirmed",
    note: "Peak solar window open — 47 nodes exporting",
  },
  {
    id: "tx_11",
    txHash: "0xd04c18b77a2e1f0c3d5a6919d04c18b77a2e1f0c3d5a6919d04c18b77a",
    kind: "trade",
    from: "0x4B88d12A09c3E7f1B6a0D245",
    fromName: "Reddy Solar",
    to: "0x0E55b19C82a4D7F3c6A1B098",
    toName: "Mehta Rooftop",
    kwh: 2.6,
    price: 8.9,
    totalInr: 23.14,
    area: "Andheri W",
    source: "rooftop-pv",
    distanceKm: 2.4,
    timestamp: GENESIS + 4.55 * 3_600_000,
    status: "pending",
  },
  {
    id: "tx_10",
    txHash: "0xe55b19c82a4d7f3c6a1b0980e55b19c82a4d7f3c6a1b0980e55b19c82a",
    kind: "deal",
    from: "0x52E8b01C94a7D3f6B2e0A118",
    fromName: "Iyer Co-op",
    to: "0x1C77A4e90B12D33f88E1a0C4",
    toName: "Nair Residence",
    kwh: 7.5,
    price: 8.5,
    totalInr: 63.75,
    area: "Dadar",
    source: "community-array",
    distanceKm: 1.6,
    timestamp: GENESIS + 4.2 * 3_600_000,
    status: "confirmed",
    instalment: { index: 3, of: 3 },
    note: "Direct P2P deal · instalment 3 of 3 (complete)",
  },
  {
    id: "tx_09",
    txHash: "0xf3a91c2e1b4d890ab33c4de7f3a91c2e1b4d890ab33c4de7f3a91c2e1b",
    kind: "trade",
    from: "0x3A91bC82e4D14F7A12c8B0E1",
    fromName: "Sharma Rooftop",
    to: "0x6F11c0A83D29e4B7a1C5E902",
    toName: "Verma Household",
    kwh: 4.2,
    price: 8.6,
    totalInr: 36.12,
    area: "Andheri",
    source: "rooftop-pv",
    distanceKm: 0.4,
    timestamp: GENESIS + 3.85 * 3_600_000,
    status: "confirmed",
  },
  {
    id: "tx_08",
    txHash: "0x012c8b0e13a91bc82e4d14f7a12c8b0e13a91bc82e4d14f7a12c8b0e13",
    kind: "listing",
    from: "0x0E55b19C82a4D7F3c6A1B098",
    fromName: "Mehta Rooftop",
    to: "Marketplace",
    toName: "Marketplace",
    kwh: 3.1,
    price: 9.8,
    totalInr: 30.38,
    area: "Juhu",
    source: "home-battery",
    distanceKm: 0.3,
    timestamp: GENESIS + 3.5 * 3_600_000,
    status: "confirmed",
    note: "Battery surplus listed for the evening peak",
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
