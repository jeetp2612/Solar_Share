import test from "node:test";
import assert from "node:assert/strict";
import {
  affordableKwh,
  applyDealToBook,
  directDeal,
  DUST_KWH,
  minDealKwh,
  routeFill,
  splitInstalments,
  summariseBook,
} from "./deal.ts";
import { GRID_FEE_BPS, SEED_ORDERS, type Order } from "./market-data.ts";

const ask = (id: string, peer: string, kwh: number, price: number, extra: Partial<Order> = {}): Order => ({
  id,
  side: "ask",
  peer,
  address: `0x${id}`,
  kwh,
  lotKwh: kwh,
  price,
  distanceKm: 1,
  area: "Andheri",
  source: "rooftop-pv",
  reliability: 4.8,
  settled: 100,
  minSplitKwh: 0.5,
  allowsInstalments: true,
  ...extra,
});

const bid = (id: string, peer: string, kwh: number, price: number, extra: Partial<Order> = {}): Order =>
  ask(id, peer, kwh, price, { ...extra, side: "bid" });

const BOOK: Order[] = [
  ask("a1", "Cheap", 5, 8.0),
  ask("a2", "Mid", 5, 8.5),
  ask("a3", "Dear", 5, 9.5),
  bid("b1", "Bidder", 6, 7.8),
  bid("b2", "Lowball", 6, 7.0),
];

test("summariseBook reports best prices, spread, mid and depth", () => {
  const s = summariseBook(BOOK);
  assert.equal(s.bestAsk?.id, "a1");
  assert.equal(s.bestBid?.id, "b1");
  assert.equal(s.spread, 0.2);
  assert.ok(Math.abs(s.mid - 7.9) < 1e-9);
  assert.equal(s.askDepthKwh, 15);
  assert.equal(s.bidDepthKwh, 12);
  assert.ok(s.askDepthInr > 0);
});

test("routeFill sweeps cheapest asks first and splits across neighbours", () => {
  const { quote, remaining, nextOrders } = routeFill(BOOK, "ask", 8);
  assert.equal(remaining, 0);
  assert.equal(quote.legs.length, 2, "should take 5 from Cheap then 3 from Mid");
  assert.deepEqual(
    quote.legs.map((l) => [l.peer, l.kwh, l.priceInr]),
    [
      ["Cheap", 5, 8.0],
      ["Mid", 3, 8.5],
    ],
  );
  assert.equal(quote.filledKwh, 8);
  // Running total makes the "first some, then some" order explicit.
  assert.deepEqual(
    quote.legs.map((l) => l.cumulativeKwh),
    [5, 8],
  );
  assert.equal(quote.avgPrice, 8.19);
  assert.equal(quote.grossInr, 65.5);
  assert.equal(quote.feeInr, 0.66);
  assert.equal(quote.netInr, 66.16);
  // Slippage is measured against the top of book.
  assert.ok(quote.slippagePct > 0);
  // The partially consumed lot stays on the book with what is left.
  const mid = nextOrders.find((o) => o.id === "a2");
  assert.equal(mid?.kwh, 2);
  assert.equal(mid?.lotKwh, 5);
  assert.equal(nextOrders.find((o) => o.id === "a1"), undefined, "emptied lot is retired");
});

test("routeFill honours a limit price and reports the unfilled remainder", () => {
  const { quote, remaining } = routeFill(BOOK, "ask", 12, { limit: 8.5 });
  assert.equal(quote.filledKwh, 10);
  assert.equal(remaining, 2);
  assert.ok(quote.legs.every((l) => l.priceInr <= 8.5));
});

test("routeFill fills a preferred lot first (direct pick) then sweeps", () => {
  const { quote } = routeFill(BOOK, "ask", 7, { preferOrderId: "a3" });
  assert.equal(quote.legs[0].peer, "Dear");
  assert.equal(quote.legs[0].kwh, 5);
  assert.equal(quote.legs[1].peer, "Cheap");
  assert.equal(quote.filledKwh, 7);
});

test("routeFill sells into the highest bids first", () => {
  const { quote } = routeFill(BOOK, "bid", 9);
  assert.deepEqual(
    quote.legs.map((l) => [l.peer, l.kwh]),
    [
      ["Bidder", 6],
      ["Lowball", 3],
    ],
  );
  // Selling: net is gross minus the grid fee.
  assert.ok(quote.netInr < quote.grossInr);
  assert.equal(quote.feeInr, Math.round(quote.grossInr * GRID_FEE_BPS / 10_000 * 100) / 100);
});

test("fee maths matches the published grid fee", () => {
  const { quote } = routeFill(BOOK, "ask", 5);
  assert.equal(quote.feeBps, GRID_FEE_BPS);
  assert.equal(quote.feeInr, 0.4);
  assert.equal(quote.netInr, 40.4);
});

test("directDeal takes a partial slice of one named neighbour's lot", () => {
  const order = BOOK[0];
  const deal = directDeal({ order, kwh: 2.5, side: "ask", referencePrice: 8.5 });
  assert.equal(deal.ok, true);
  if (!deal.ok) return;
  assert.equal(deal.quote.legs.length, 1);
  assert.equal(deal.quote.legs[0].peer, "Cheap");
  assert.equal(deal.quote.filledKwh, 2.5);
  assert.equal(deal.quote.avgPrice, 8.0);
  assert.equal(deal.accepted, true);
  assert.equal(deal.counterPrice, null);
  assert.equal(deal.quote.legs[0].lotLeftKwh, 2.5);
  // Buying at their ask is better than the reference → negative margin.
  assert.ok(deal.quote.marginPct < 0);
});

test("directDeal enforces the seller's minimum slice and lot size", () => {
  const order = ask("x", "Strict", 4, 9, { minSplitKwh: 1 });
  assert.equal(minDealKwh(order), 1);
  const tooSmall = directDeal({ order, kwh: 0.4, side: "ask", referencePrice: 9 });
  assert.equal(tooSmall.ok, false);
  if (!tooSmall.ok) {
    assert.equal(tooSmall.reason, "volume");
    assert.match(tooSmall.message, /1\.0 kWh/);
  }
  const tooBig = directDeal({ order, kwh: 9, side: "ask", referencePrice: 9 });
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.equal(tooBig.reason, "lot");
});

test("directDeal never overpays and counters offers outside the band", () => {
  const order = ask("y", "Negotiable", 6, 10, {});
  // Offering above the ask fills at the ask (price improvement).
  const generous = directDeal({ order, kwh: 2, offerPrice: 11, side: "ask", referencePrice: 10 });
  assert.equal(generous.ok && generous.quote.avgPrice, 10);

  // A small discount inside the tolerance auto-accepts at your price.
  const near = directDeal({ order, kwh: 2, offerPrice: 9.9, side: "ask", referencePrice: 10 });
  assert.equal(near.ok && near.accepted, true);
  assert.equal(near.ok && near.quote.avgPrice, 9.9);

  // A lowball is countered at their price instead of silently failing.
  const lowball = directDeal({ order, kwh: 2, offerPrice: 8, side: "ask", referencePrice: 10 });
  assert.equal(lowball.ok, true);
  if (lowball.ok) {
    assert.equal(lowball.accepted, false);
    assert.equal(lowball.counterPrice, 10);
    assert.equal(lowball.quote.avgPrice, 10);
  }
});

test("applyDealToBook reduces the lot and retires it at dust", () => {
  const after = applyDealToBook(BOOK, "a1", 2);
  assert.equal(after.find((o) => o.id === "a1")?.kwh, 3);
  const emptied = applyDealToBook(BOOK, "a1", 5);
  assert.equal(emptied.find((o) => o.id === "a1"), undefined);
  const dust = applyDealToBook(BOOK, "a1", 5 - DUST_KWH / 2);
  assert.equal(dust.find((o) => o.id === "a1"), undefined);
  // Untouched lots keep their identity.
  assert.equal(after.find((o) => o.id === "a2")?.kwh, 5);
});

test("splitInstalments always sums to the requested volume", () => {
  for (const [total, count] of [
    [12, 3],
    [10, 4],
    [5, 2],
    [1.5, 3],
    [8.4, 5],
    [0.4, 4],
  ] as const) {
    const parts = splitInstalments(total, count);
    const sum = Math.round(parts.reduce((s, p) => s + p, 0) * 10) / 10;
    assert.equal(sum, Math.round(total * 10) / 10, `${total} kWh in ${count} parts`);
    assert.ok(parts.every((p) => p > 0), "no zero-sized instalments");
    assert.ok(parts.length <= count);
  }
  // Cannot split below the minimum slice → fewer instalments.
  assert.deepEqual(splitInstalments(0.4, 4), [0.1, 0.1, 0.1, 0.1]);
  assert.deepEqual(splitInstalments(0.4, 4, 0.5), [0.4]);
  assert.deepEqual(splitInstalments(1.0, 5, 0.5), [0.5, 0.5]);
  assert.deepEqual(splitInstalments(0, 3), []);
  assert.deepEqual(splitInstalments(6, 1), [6]);
});

test("affordableKwh turns a rupee budget into energy, fee included", () => {
  const { kwh, quote } = affordableKwh(BOOK, 40.4);
  assert.equal(kwh, 5);
  assert.equal(quote.filledKwh, 5);
  assert.ok(quote.netInr <= 40.41);

  const tiny = affordableKwh(BOOK, 1);
  assert.ok(tiny.kwh < 0.2);

  const huge = affordableKwh(BOOK, 10_000);
  assert.equal(huge.kwh, 15, "capped by the depth of the book");
});

test("the seed book is directly tradeable (regression guard)", () => {
  const s = summariseBook(SEED_ORDERS);
  assert.ok(s.bestAsk && s.bestBid);
  assert.ok(s.askDepthKwh > 20);
  for (const o of SEED_ORDERS) {
    assert.ok(o.lotKwh >= o.kwh);
    assert.ok(o.area.length > 0);
    assert.ok(o.minSplitKwh > 0);
    assert.ok(o.reliability >= 0 && o.reliability <= 5);
  }
});
