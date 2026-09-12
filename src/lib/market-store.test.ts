/**
 * Headless simulation of the trading store — the exact code path the dashboard
 * buttons use (market sweep, direct P2P deal, instalments, pausing the feed),
 * with a fake settle function that behaves like `solarSettleTrade`: it moves the
 * wallet, refuses short funds/surplus, and mints an incrementing block.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { useMarket } from "./market-store.ts";
import type { FillLeg, SettleError, SettleResult } from "./solar/types.ts";
import { WELCOME_INR, type Wallet } from "./market-data.ts";

let blockNo = 0;

function fakeWallet(over: Partial<Wallet> = {}): Wallet {
  return {
    inr: WELCOME_INR,
    kwhCredits: 0,
    surplusKwh: 0,
    panelKwp: 3,
    generatingKw: 0,
    totalEarnedInr: 0,
    totalSpentInr: 0,
    totalSoldKwh: 0,
    totalBoughtKwh: 0,
    ...over,
  };
}

/** Mirrors the server: atomic INR + kWh movement, one block per settlement. */
function makeSettle() {
  const calls: { action: "buy" | "sell"; legs: FillLeg[] }[] = [];
  let action: "buy" | "sell" = "buy";
  const settle = async (legs: FillLeg[]): Promise<SettleResult | SettleError> => {
    calls.push({ action, legs });
    const w = useMarket.getState().wallet;
    if (!w) return { ok: false, message: "no wallet", reason: "invalid" };
    const kwh = Math.round(legs.reduce((s, l) => s + l.kwh, 0) * 100) / 100;
    const amount = Math.round(legs.reduce((s, l) => s + l.kwh * l.priceInr, 0) * 100) / 100;
    if (action === "buy" && amount > w.inr + 1e-9) {
      return { ok: false, message: "Insufficient INR balance for this fill.", reason: "funds" };
    }
    if (action === "sell" && kwh > w.surplusKwh + 1e-9) {
      return { ok: false, message: "Not enough solar surplus to sell this volume.", reason: "surplus" };
    }
    blockNo += 1;
    const next: Wallet =
      action === "buy"
        ? {
            ...w,
            inr: Math.round((w.inr - amount) * 100) / 100,
            kwhCredits: Math.round((w.kwhCredits + kwh) * 100) / 100,
            totalSpentInr: Math.round((w.totalSpentInr + amount) * 100) / 100,
            totalBoughtKwh: Math.round((w.totalBoughtKwh + kwh) * 100) / 100,
          }
        : {
            ...w,
            inr: Math.round((w.inr + amount) * 100) / 100,
            surplusKwh: Math.round((w.surplusKwh - kwh) * 100) / 100,
            totalEarnedInr: Math.round((w.totalEarnedInr + amount) * 100) / 100,
            totalSoldKwh: Math.round((w.totalSoldKwh + kwh) * 100) / 100,
          };
    useMarket.setState({ wallet: next });
    return {
      ok: true,
      wallet: next,
      block: {
        blockNo,
        prevHash: "0x" + "0".repeat(64),
        blockHash: "0x" + "a".repeat(64),
        txCount: legs.length,
        totalKwh: kwh,
        totalInr: amount,
        timestamp: new Date().toISOString(),
      },
      amountInr: amount,
      kwh,
    };
  };
  return {
    settle,
    calls,
    setAction: (a: "buy" | "sell") => {
      action = a;
    },
    hooks: (peerName = "Aarav Mehta") => ({
      settle: (legs: FillLeg[]) => settle(legs),
      listRest: async () => true,
      peerName,
      peerArea: "Mumbai",
    }),
  };
}

function reset() {
  blockNo = 0;
  useMarket.setState({
    live: false,
    wallet: null,
    orders: [],
    txs: [],
    pending: false,
    selectedOrderId: null,
    dealOrderId: null,
    feedPaused: false,
    dealProgress: {
      running: false,
      orderId: null,
      peer: "",
      done: 0,
      total: 0,
      kwhDone: 0,
      inrDone: 0,
      blocks: [],
      note: "",
    },
  });
  // Fresh seed book + a wallet, like a signed-in member landing on the dashboard.
  useMarket.getState().startLive();
  useMarket.setState({ wallet: fakeWallet(), txs: [] });
}

test("market buy sweeps several neighbours and settles one block", async () => {
  reset();
  const { hooks, calls, setAction } = makeSettle();
  setAction("buy");
  const before = useMarket.getState().wallet!;
  const book = useMarket.getState().orders;
  const ask = book.filter((o) => o.side === "ask").sort((a, b) => a.price - b.price)[0];

  const result = await useMarket.getState().buy(8, {}, hooks());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(calls.length, 1, "one settlement call for the whole sweep");
  assert.ok(calls[0].legs.length >= 1);
  assert.equal(calls[0].legs[0].peer, ask.peer, "cheapest ask is taken first");
  assert.equal(result.kwh, 8);
  assert.ok(result.amountInr > 0);
  assert.equal(result.block, 1);

  const after = useMarket.getState();
  assert.equal(after.wallet!.inr, Math.round((before.inr - result.amountInr) * 100) / 100);
  assert.equal(after.wallet!.kwhCredits, 8);
  assert.equal(after.block, 1);
  // The feed shows one row per leg, marked as the member's own.
  assert.equal(after.txs.filter((t) => t.mine).length, calls[0].legs.length);
  assert.ok(after.txs.every((t) => t.kind === "trade"));
  // The consumed lot shrank (or was retired) on the book.
  const sameLot = after.orders.find((o) => o.id === ask.id);
  if (sameLot) assert.ok(sameLot.kwh < ask.kwh);
});

test("a limit buy that cannot fill rests the remainder on the book", async () => {
  reset();
  const { hooks, setAction } = makeSettle();
  setAction("buy");

  // Below every ask → nothing fills.
  const nothing = await useMarket.getState().buy(5, { limit: 1 }, hooks());
  assert.equal(nothing.ok, false);
  if (!nothing.ok) assert.equal(nothing.reason, "liquidity");

  // A limit that only covers the cheapest lot fills part and rests the rest.
  const book = useMarket.getState().orders;
  const cheapest = book.filter((o) => o.side === "ask").sort((a, b) => a.price - b.price)[0];
  const result = await useMarket
    .getState()
    .buy(cheapest.kwh + 4, { limit: cheapest.price }, hooks());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const mine = useMarket.getState().orders.filter((o) => o.address === "you");
  assert.equal(mine.length, 1, "the unfilled remainder is listed as your bid");
  assert.equal(mine[0].side, "bid");
  assert.equal(mine[0].price, cheapest.price);
});

test("direct P2P deal takes PART of one named neighbour's lot", async () => {
  reset();
  const { hooks, calls, setAction } = makeSettle();
  setAction("buy");
  const lot = useMarket.getState().orders.filter((o) => o.side === "ask").sort((a, b) => b.kwh - a.kwh)[0];
  const slice = 2.5;

  const result = await useMarket
    .getState()
    .deal({ orderId: lot.id, side: "ask", kwh: slice, instalments: 1 }, hooks());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.kwh, slice);
  assert.equal(result.instalments, 1);
  assert.deepEqual(result.blocks, [1]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].legs.length, 1, "exactly one counterparty");
  assert.equal(calls[0].legs[0].peer, lot.peer);

  const after = useMarket.getState();
  const remaining = after.orders.find((o) => o.id === lot.id);
  assert.ok(remaining, "their lot stays on the book");
  assert.equal(remaining!.kwh, Math.round((lot.kwh - slice) * 100) / 100, "only the slice was taken");
  const dealRows = after.txs.filter((t) => t.kind === "deal" && t.mine);
  assert.equal(dealRows.length, 1);
  assert.match(dealRows[0].note ?? "", /Direct P2P deal/);
});

test("instalments settle one block each, in order, and report progress", async () => {
  reset();
  const { hooks, calls, setAction } = makeSettle();
  setAction("buy");
  const lot = useMarket.getState().orders.filter((o) => o.side === "ask").sort((a, b) => b.kwh - a.kwh)[0];

  const result = await useMarket
    .getState()
    .deal({ orderId: lot.id, side: "ask", kwh: 6, instalments: 3 }, hooks());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.instalments, 3);
  assert.equal(result.kwh, 6);
  assert.equal(calls.length, 3, "one settlement per instalment");
  assert.deepEqual(result.blocks, [1, 2, 3], "each instalment minted its own block");
  // The slices add back up to the requested volume.
  const sum = calls.reduce((s, c) => s + c.legs[0].kwh, 0);
  assert.equal(Math.round(sum * 10) / 10, 6);
  // Every instalment went to the SAME neighbour at the SAME price.
  assert.equal(new Set(calls.map((c) => c.legs[0].peer)).size, 1);
  assert.equal(new Set(calls.map((c) => c.legs[0].priceInr)).size, 1);

  const after = useMarket.getState();
  const progress = after.dealProgress;
  assert.equal(progress.running, false);
  assert.equal(progress.done, 3);
  assert.equal(progress.total, 3);
  assert.deepEqual(progress.blocks, [1, 2, 3]);
  const instalmentRows = after.txs.filter((t) => t.instalment);
  assert.equal(instalmentRows.length, 3);
  assert.deepEqual(
    instalmentRows.map((t) => t.instalment?.of),
    [3, 3, 3],
  );
  // The lot lost exactly 6 kWh across the three deliveries.
  const left = after.orders.find((o) => o.id === lot.id);
  assert.ok(!left || Math.abs(left.kwh - (lot.kwh - 6)) < 0.011);
});

test("a deal respects the seller's minimum slice and lot size", async () => {
  reset();
  const { hooks, setAction } = makeSettle();
  setAction("buy");
  const lot = useMarket.getState().orders.filter((o) => o.side === "ask" && o.minSplitKwh >= 1)[0];
  assert.ok(lot, "seed book has at least one lot with a 1 kWh minimum");

  const tooSmall = await useMarket
    .getState()
    .deal({ orderId: lot.id, side: "ask", kwh: 0.2, instalments: 1 }, hooks());
  assert.equal(tooSmall.ok, false);
  if (!tooSmall.ok) {
    assert.equal(tooSmall.reason, "volume");
    assert.match(tooSmall.message, /partial lots from/);
  }

  const tooBig = await useMarket
    .getState()
    .deal({ orderId: lot.id, side: "ask", kwh: lot.kwh + 20, instalments: 1 }, hooks());
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.equal(tooBig.reason, "lot");
});

test("a deal stops cleanly when the wallet runs out mid-way", async () => {
  reset();
  useMarket.setState({ wallet: fakeWallet({ inr: 60 }) });
  const { hooks, calls, setAction } = makeSettle();
  setAction("buy");
  const lot = useMarket.getState().orders.filter((o) => o.side === "ask").sort((a, b) => b.kwh - a.kwh)[0];

  const result = await useMarket
    .getState()
    .deal({ orderId: lot.id, side: "ask", kwh: Math.min(lot.kwh, 30), instalments: 4 }, hooks());

  // Either it was refused up front (short by the total) or it settled what it
  // could and reported the stop — never a silent overdraw.
  const w = useMarket.getState().wallet!;
  assert.ok(w.inr >= -0.001, "wallet never goes negative");
  if (result.ok) {
    assert.ok(calls.length <= 4);
    assert.ok(result.kwh > 0);
  } else {
    assert.ok(["funds", "surplus", "chain"].includes(result.reason));
  }
});

test("selling requires surplus, and a direct sell pays it out", async () => {
  reset();
  const { hooks, calls, setAction } = makeSettle();
  setAction("sell");
  const bid = useMarket.getState().orders.filter((o) => o.side === "bid").sort((a, b) => b.price - a.price)[0];

  const refused = await useMarket.getState().sell(4, {}, hooks());
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.reason, "surplus");

  useMarket.setState({ wallet: fakeWallet({ surplusKwh: 10 }) });
  const result = await useMarket
    .getState()
    .deal({ orderId: bid.id, side: "bid", kwh: 3, instalments: 1 }, hooks());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.kwh, 3);
  assert.equal(calls.length, 1);
  const w = useMarket.getState().wallet!;
  assert.equal(w.surplusKwh, 7);
  assert.ok(w.inr > WELCOME_INR, "selling credits INR");
});

test("signed-out visitors are told to sign in instead of failing silently", async () => {
  reset();
  useMarket.setState({ wallet: null });
  const { hooks } = makeSettle();
  const buy = await useMarket.getState().buy(5, {}, hooks());
  assert.equal(buy.ok, false);
  if (!buy.ok) assert.equal(buy.reason, "auth");
  const deal = await useMarket
    .getState()
    .deal({ orderId: useMarket.getState().orders[0].id, side: "ask", kwh: 1, instalments: 1 }, hooks());
  assert.equal(deal.ok, false);
  if (!deal.ok) assert.equal(deal.reason, "auth");
});

test("pausing the feed stops new rows while the market keeps moving", async () => {
  reset();
  const store = useMarket.getState();
  store.startLive();
  useMarket.setState({ feedPaused: true, txs: [] });
  for (let i = 0; i < 40; i += 1) useMarket.getState().tick();
  assert.equal(useMarket.getState().txs.length, 0, "no new rows while paused");
  assert.ok(useMarket.getState().history.length > 1, "prices still move");

  useMarket.setState({ feedPaused: false, txs: [] });
  for (let i = 0; i < 60; i += 1) useMarket.getState().tick();
  assert.ok(useMarket.getState().txs.length > 0, "rows resume when unpaused");
  // The refreshed feed is a mix, not one repeated shape.
  const kinds = new Set(useMarket.getState().txs.map((t) => t.kind));
  assert.ok(kinds.size >= 2, `expected a mixed feed, got ${[...kinds].join(",")}`);
});
