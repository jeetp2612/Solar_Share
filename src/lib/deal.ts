/**
 * Trading engine — pure functions, no React, no network, no DB.
 *
 * This is the maths behind the three ways to trade on SolarShare:
 *
 *  1. **Sweep the book** (`routeFill`) — walk the cheapest asks (or the highest
 *     bids) until the volume is filled. One order can produce several legs, and
 *     one leg can take *part* of a lot, which is what makes "first some kWh from
 *     this neighbour, then some from the next one" work.
 *  2. **Direct P2P deal** (`directDeal`) — trade with one named neighbour and
 *     choose exactly how much of their lot to take (from their `minSplitKwh` up
 *     to the whole lot), optionally at an offer price inside a tolerance band.
 *  3. **Instalments** (`splitInstalments`) — deliver a deal in N slices; each
 *     slice settles atomically and mints its own ledger block.
 *
 * Everything is quoted *before* it happens: average price, gross, grid fee,
 * total, slippage versus the best price and margin versus the reference price,
 * so the member can see the deal they are about to sign.
 */
import { GRID_FEE_BPS, type EnergySource, type Order, type OrderSide } from "./market-data.ts";

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lots smaller than this are considered fully consumed. */
export const DUST_KWH = 0.05;
/** Smallest tradeable slice anywhere on the feeder. */
export const MIN_TRADE_KWH = 0.1;

export type BookSummary = {
  bestAsk: Order | null;
  bestBid: Order | null;
  mid: number;
  spread: number;
  /** Total kWh offered / wanted on the book. */
  askDepthKwh: number;
  bidDepthKwh: number;
  askDepthInr: number;
  bidDepthInr: number;
};

export function summariseBook(orders: Order[]): BookSummary {
  const asks = orders.filter((o) => o.side === "ask" && o.kwh > DUST_KWH).sort((a, b) => a.price - b.price);
  const bids = orders.filter((o) => o.side === "bid" && o.kwh > DUST_KWH).sort((a, b) => b.price - a.price);
  const bestAsk = asks[0] ?? null;
  const bestBid = bids[0] ?? null;
  const sum = (list: Order[]) => list.reduce((s, o) => s + o.kwh, 0);
  const notional = (list: Order[]) => list.reduce((s, o) => s + o.kwh * o.price, 0);
  return {
    bestAsk,
    bestBid,
    mid: round2(
      bestAsk && bestBid ? (bestAsk.price + bestBid.price) / 2 : (bestAsk?.price ?? bestBid?.price ?? 0),
    ),
    spread: round2(bestAsk && bestBid ? Math.max(0, bestAsk.price - bestBid.price) : 0),
    askDepthKwh: round1(sum(asks)),
    bidDepthKwh: round1(sum(bids)),
    askDepthInr: round2(notional(asks)),
    bidDepthInr: round2(notional(bids)),
  };
}

/** One filled slice of one neighbour's lot. */
export type RouteLeg = {
  orderId: string;
  peer: string;
  peerAddress: string;
  area: string;
  source: EnergySource;
  distanceKm: number;
  kwh: number;
  priceInr: number;
  /** Running total after this leg — makes the "first some, then some" order visible. */
  cumulativeKwh: number;
  /** Share of the requested volume, 0..1. */
  share: number;
  /** How much of this neighbour's lot is left after the leg. */
  lotLeftKwh: number;
};

export type Quote = {
  legs: RouteLeg[];
  filledKwh: number;
  unfilledKwh: number;
  avgPrice: number;
  bestPrice: number;
  grossInr: number;
  feeInr: number;
  /** What actually hits the wallet: gross + fee when buying, gross − fee when selling. */
  netInr: number;
  /** Slippage vs the best price on that side, in % (0 = you got the top of book). */
  slippagePct: number;
  /** Margin vs the reference price, in % — negative is *better* than reference when buying. */
  marginPct: number;
  feeBps: number;
};

export type RouteOptions = {
  /** Limit price: skip asks above it / bids below it. */
  limit?: number;
  /** Fill this order first (direct-deal priority), then sweep the rest. */
  preferOrderId?: string;
  /** Reference price for the margin line — defaults to the mid. */
  referencePrice?: number;
  feeBps?: number;
};

/**
 * Walk the book on `side` until `kwh` is filled.
 *
 * `side` is the side of the book being consumed: buying consumes "ask" lots,
 * selling consumes "bid" lots. Returns the legs, whatever is left unfilled, and
 * the book with the consumed lots reduced (or removed when emptied).
 */
export function routeFill(
  orders: Order[],
  side: OrderSide,
  kwh: number,
  options: RouteOptions = {},
): { quote: Quote; remaining: number; nextOrders: Order[] } {
  const feeBps = options.feeBps ?? GRID_FEE_BPS;
  const book = summariseBook(orders);
  const reference = options.referencePrice ?? book.mid;
  const preferred = options.preferOrderId
    ? orders.find((o) => o.id === options.preferOrderId && o.side === side)
    : undefined;

  const sorted = orders
    .filter((o) => o.side === side && o.kwh > DUST_KWH)
    .filter((o) => o.id !== preferred?.id)
    .sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price));
  const walk = preferred ? [preferred, ...sorted] : sorted;

  const legs: RouteLeg[] = [];
  const consumed = new Map<string, number>();
  let remaining = Math.max(0, kwh);
  let cumulative = 0;

  for (const order of walk) {
    if (remaining <= 0.001) break;
    if (options.limit != null) {
      if (side === "ask" && order.price > options.limit + 1e-9) continue;
      if (side === "bid" && order.price < options.limit - 1e-9) continue;
    }
    const take = round2(Math.min(order.kwh, remaining));
    if (take <= 0) continue;
    cumulative = round2(cumulative + take);
    consumed.set(order.id, round2((consumed.get(order.id) ?? 0) + take));
    legs.push({
      orderId: order.id,
      peer: order.peer,
      peerAddress: order.address,
      area: order.area,
      source: order.source,
      distanceKm: order.distanceKm,
      kwh: take,
      priceInr: round2(order.price),
      cumulativeKwh: cumulative,
      share: kwh > 0 ? take / kwh : 0,
      lotLeftKwh: Math.max(0, round1(order.kwh - take)),
    });
    remaining = round2(remaining - take);
  }

  const nextOrders = orders
    .map((o) => {
      const take = consumed.get(o.id);
      if (!take) return o;
      const left = round2(o.kwh - take);
      if (left <= DUST_KWH) return null;
      return { ...o, kwh: left };
    })
    .filter((o): o is Order => o != null);

  return {
    quote: buildQuote(
      legs,
      side,
      kwh,
      reference,
      feeBps,
      side === "ask" ? book.bestAsk?.price : book.bestBid?.price,
    ),
    remaining,
    nextOrders,
  };
}

function buildQuote(
  legs: RouteLeg[],
  side: OrderSide,
  requested: number,
  reference: number,
  feeBps: number,
  bestPrice?: number,
): Quote {
  const filledKwh = round2(legs.reduce((s, l) => s + l.kwh, 0));
  const grossInr = round2(legs.reduce((s, l) => s + l.kwh * l.priceInr, 0));
  const feeInr = round2((grossInr * feeBps) / 10_000);
  const avgPrice = filledKwh > 0 ? round2(grossInr / filledKwh) : 0;
  const best = bestPrice ?? avgPrice;
  return {
    legs,
    filledKwh,
    unfilledKwh: round2(Math.max(0, requested - filledKwh)),
    avgPrice,
    bestPrice: round2(best),
    grossInr,
    feeInr,
    netInr: round2(side === "ask" ? grossInr + feeInr : grossInr - feeInr),
    slippagePct: best > 0 ? round2(((avgPrice - best) / best) * 100 * (side === "ask" ? 1 : -1)) : 0,
    marginPct: reference > 0 ? round2(((avgPrice - reference) / reference) * 100) : 0,
    feeBps,
  };
}

/**
 * How much energy a ₹ budget buys, walking the asks (fee included).
 * Returns the kWh and the quote for exactly that volume.
 */
export function affordableKwh(
  orders: Order[],
  budgetInr: number,
  options: RouteOptions = {},
): { kwh: number; quote: Quote } {
  const feeBps = options.feeBps ?? GRID_FEE_BPS;
  const asks = orders
    .filter((o) => o.side === "ask" && o.kwh > DUST_KWH)
    .filter((o) => options.limit == null || o.price <= options.limit + 1e-9)
    .sort((a, b) => a.price - b.price);

  let spend = 0;
  let kwh = 0;
  for (const o of asks) {
    const unit = o.price * (1 + feeBps / 10_000);
    const room = (budgetInr - spend) / unit;
    if (room <= 0) break;
    const take = Math.min(o.kwh, room);
    kwh = round2(kwh + take);
    spend = round2(spend + take * unit);
    if (take < o.kwh - 1e-9) break;
  }
  const capped = Math.max(0, round1(kwh));
  const { quote } = routeFill(orders, "ask", capped, options);
  return { kwh: capped, quote };
}

export type DirectDealInput = {
  order: Order;
  /** How much of this neighbour's lot to take. */
  kwh: number;
  /** Your offer, INR/kWh. Omitted = accept their price. */
  offerPrice?: number;
  side: OrderSide;
  referencePrice: number;
  feeBps?: number;
  /** How far from their price an offer can be and still auto-accept, in %. */
  tolerancePct?: number;
};

export type DirectDeal =
  | { ok: true; quote: Quote; order: Order; accepted: boolean; counterPrice: number | null }
  | { ok: false; message: string; reason: "volume" | "lot" | "price" | "unsupported" };

/** Smallest partial slice this lot accepts. */
export function minDealKwh(order: Order): number {
  return Math.max(MIN_TRADE_KWH, order.minSplitKwh ?? MIN_TRADE_KWH);
}

/**
 * A direct deal with ONE named neighbour for PART of their lot.
 *
 * - volume must be between their minimum slice and what is left of the lot;
 * - an offer inside the tolerance band auto-accepts at your price;
 * - an offer outside the band is reported as a counter at their price, so the UI
 *   can show "they countered at ₹8.20" instead of silently failing.
 */
export function directDeal(input: DirectDealInput): DirectDeal {
  const { order, side, referencePrice } = input;
  const feeBps = input.feeBps ?? GRID_FEE_BPS;
  const tolerance = input.tolerancePct ?? 2.5;
  const min = minDealKwh(order);
  const kwh = round1(input.kwh);

  if (!Number.isFinite(kwh) || kwh < MIN_TRADE_KWH) {
    return { ok: false, message: "Enter a volume of at least 0.1 kWh.", reason: "volume" };
  }
  if (kwh < min - 1e-9) {
    return {
      ok: false,
      message: `${order.peer} accepts partial lots from ${min.toFixed(1)} kWh.`,
      reason: "volume",
    };
  }
  if (kwh > order.kwh + 1e-9) {
    return {
      ok: false,
      message: `Only ${order.kwh.toFixed(1)} kWh left in this lot.`,
      reason: "lot",
    };
  }

  const offer = input.offerPrice != null ? round2(input.offerPrice) : null;
  let price = round2(order.price);
  let accepted = true;
  let counterPrice: number | null = null;

  if (offer != null && Math.abs(offer - order.price) > 1e-9) {
    const deviatePct = ((offer - order.price) / order.price) * 100;
    // An offer that is already better than the listed price for the counterparty
    // fills at the *listed* price — you never overpay an ask (or undersell a bid).
    const favourable = side === "ask" ? deviatePct >= 0 : deviatePct <= 0;
    if (favourable) {
      price = round2(order.price);
    } else if (Math.abs(deviatePct) <= tolerance) {
      // Inside the auto-accept band: the neighbour takes your price.
      price = offer;
    } else {
      accepted = false;
      counterPrice = round2(order.price);
      price = round2(order.price);
    }
  }

  const leg: RouteLeg = {
    orderId: order.id,
    peer: order.peer,
    peerAddress: order.address,
    area: order.area,
    source: order.source,
    distanceKm: order.distanceKm,
    kwh,
    priceInr: price,
    cumulativeKwh: kwh,
    share: 1,
    lotLeftKwh: Math.max(0, round1(order.kwh - kwh)),
  };

  return {
    ok: true,
    order,
    accepted,
    counterPrice,
    quote: buildQuote([leg], side, kwh, referencePrice, feeBps, order.price),
  };
}

/** Apply a settled direct deal to the book (reduce or retire the lot). */
export function applyDealToBook(orders: Order[], orderId: string, kwh: number): Order[] {
  return orders
    .map((o) => {
      if (o.id !== orderId) return o;
      const left = round2(o.kwh - kwh);
      if (left <= DUST_KWH) return null;
      return { ...o, kwh: left };
    })
    .filter((o): o is Order => o != null);
}

/**
 * Split a volume into N instalments ("first some kWh, then the next some").
 * Each slice is ≥ `minKwh` and rounded to 0.1 kWh; the last slice absorbs the
 * rounding remainder so the instalments always sum to the requested volume.
 * N is reduced automatically when the volume cannot be split that finely.
 */
export function splitInstalments(totalKwh: number, count: number, minKwh = MIN_TRADE_KWH): number[] {
  const total = round1(Math.max(0, totalKwh));
  if (total <= 0) return [];
  const floor = Math.max(1, Math.floor(round2(total / Math.max(minKwh, MIN_TRADE_KWH))));
  const n = Math.max(1, Math.min(Math.floor(count), floor, 12));
  if (n === 1) return [total];

  const base = Math.floor((total / n) * 10) / 10;
  const parts = new Array(n).fill(base) as number[];
  const remainder = round1(total - base * n);
  parts[parts.length - 1] = round1(base + remainder);
  return parts.filter((p) => p > 0);
}

/** Delivery schedule labels for an instalment plan (demo cadence: 90s apart). */
export const INSTALMENT_GAP_MS = 90_000;

export function instalmentEta(index: number, fromTs = Date.now()): number {
  return fromTs + index * INSTALMENT_GAP_MS;
}
