import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../auth/middleware";
import { getSql } from "../db";
import { WELCOME_INR, irradianceAt, type Wallet } from "../market-data";
import type {
  BlockDetail,
  ChainVerification,
  FillLeg,
  LedgerTx,
  SettleArgs,
  SettleError,
  SettleResult,
  SolarState,
  TestnetStatus,
  UserOrderRow,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: number | string | null | undefined): number => Number(v);
const iso = (v: Date | string): string => (v instanceof Date ? v.toISOString() : String(v));

type WalletDbRow = {
  user_id: string;
  inr_balance: number | string;
  kwh_credits: number | string;
  surplus_kwh: number | string;
  generated_since: Date | string;
  total_earned_inr: number | string;
  total_spent_inr: number | string;
  total_sold_kwh: number | string;
  total_bought_kwh: number | string;
};

type ProfileDbRow = {
  full_name: string;
  area: string;
  panel_kwp: number | string;
  joined_at: Date | string;
};

/** Credit solar generation since the last read (server is authoritative). */
async function creditGeneration(
  w: WalletDbRow,
  panelKwp: number,
): Promise<WalletDbRow> {
  const since =
    w.generated_since instanceof Date
      ? w.generated_since.getTime()
      : Date.parse(String(w.generated_since));
  const now = Date.now();
  const dtH = (now - since) / 3_600_000;
  if (dtH < 1 / 3600) return w;
  const irr = irradianceAt(now);
  const generated = clamp(panelKwp * irr * dtH * 0.78, 0, 60 - num(w.surplus_kwh));
  if (generated <= 0) return w;
  const sql = await getSql();
  await sql.query(
    `update wallets
        set surplus_kwh = $1, generated_since = now()
      where user_id = $2`,
    [round2(num(w.surplus_kwh) + generated), w.user_id],
  );
  return { ...w, surplus_kwh: round2(num(w.surplus_kwh) + generated), generated_since: new Date() };
}

async function loadWallet(
  userId: string,
): Promise<{ profile: { fullName: string; area: string; panelKwp: number; joinedAt: string }; wallet: WalletDbRow } | null> {
  const sql = await getSql();
  const profileRows = await sql.query<ProfileDbRow>(
    `select full_name, area, panel_kwp, joined_at from profiles where user_id = $1`,
    [userId],
  );
  if (!profileRows[0]) return null;
  const walletRows = await sql.query<WalletDbRow>(
    `select user_id, inr_balance, kwh_credits, surplus_kwh, generated_since,
            total_earned_inr, total_spent_inr, total_sold_kwh, total_bought_kwh
       from wallets where user_id = $1`,
    [userId],
  );
  if (!walletRows[0]) return null;
  const wallet = await creditGeneration(walletRows[0], num(profileRows[0].panel_kwp));
  return {
    profile: {
      fullName: String(profileRows[0].full_name),
      area: String(profileRows[0].area),
      panelKwp: num(profileRows[0].panel_kwp),
      joinedAt: iso(profileRows[0].joined_at),
    },
    wallet,
  };
}

async function ensureProfileAndWallet(userId: string) {
  const existing = await loadWallet(userId);
  if (existing) return existing;

  const sql = await getSql();
  const authRows = await sql.query<{ name: string }>(
    `select "name" from "user" where "id" = $1`,
    [userId],
  );
  const name = (authRows[0]?.name ?? "").trim() || "Solar Member";
  const now = new Date();

  await sql.query(
    `insert into profiles (user_id, full_name, area, panel_kwp, joined_at)
       values ($1, $2, 'Mumbai', 3.0, $3)
       on conflict (user_id) do nothing`,
    [userId, name, now],
  );
  await sql.query(
    `insert into wallets (user_id, inr_balance, kwh_credits, surplus_kwh, generated_since)
       values ($1, $2, 0, 0, $3)
       on conflict (user_id) do nothing`,
    [userId, WELCOME_INR, now],
  );

  const again = await loadWallet(userId);
  if (!again) throw new Error("wallet: failed to initialise profile + wallet");
  return again;
}

function walletToRow(w: WalletDbRow, panelKwp: number): Wallet {
  const irr = irradianceAt(Date.now());
  return {
    inr: round2(num(w.inr_balance)),
    kwhCredits: round2(num(w.kwh_credits)),
    surplusKwh: round2(num(w.surplus_kwh)),
    panelKwp,
    generatingKw: round2(panelKwp * irr * 0.78),
    totalEarnedInr: round2(num(w.total_earned_inr)),
    totalSpentInr: round2(num(w.total_spent_inr)),
    totalSoldKwh: round2(num(w.total_sold_kwh)),
    totalBoughtKwh: round2(num(w.total_bought_kwh)),
  };
}

const amountSchema = z.object({ amount: z.number().int().min(1).max(100000) });
const legSchema = z.object({
  peer: z.string().min(1),
  peerAddress: z.string(),
  kwh: z.number().positive().max(500),
  priceInr: z.number().positive().max(500),
});
const settleSchema = z.object({
  action: z.enum(["buy", "sell"]),
  legs: z.array(legSchema).min(1),
});
const listOrderSchema = z.object({
  side: z.enum(["ask", "bid"]),
  kwh: z.number().min(0.1).max(500),
  priceInr: z.number().min(1).max(500),
});


export const solarGetState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SolarState> => {
  const { userId } = context as { userId: string };
  const ledger = await import("./ledger.server");
  await ledger.ensureGenesis();
  const { profile, wallet } = await ensureProfileAndWallet(userId);
  const sql = await getSql();
  const orderRows = await sql.query<{
    id: string;
    side: string;
    kwh: number | string;
    price_inr: number | string;
    created_at: Date | string;
  }>(
    `select id, side, kwh, price_inr, created_at from orders
      where user_id = $1 and status = 'open' order by created_at desc limit 20`,
    [userId],
  );
  const head = await ledger.getChainHead();
  return {
    profile,
    wallet: walletToRow(wallet, profile.panelKwp),
    myOrders: orderRows.map<UserOrderRow>((o) => ({
      id: String(o.id),
      side: o.side === "bid" ? "bid" : "ask",
      kwh: num(o.kwh),
      priceInr: num(o.price_inr),
      createdAt: iso(o.created_at),
    })),
    chainHead: head,
  };
});

export const solarTopUp = createServerFn({ method: "POST" })
  .validator(amountSchema)
  .middleware([authMiddleware])
  .handler(
  async ({ context, data }): Promise<SettleResult | SettleError> => {
    const { userId } = context as { userId: string };
    const ledger = await import("./ledger.server");
    const amount = round2(data.amount);
    const { profile, wallet } = await ensureProfileAndWallet(userId);
    const sql = await getSql();
    await sql.query(
      `update wallets set inr_balance = $1 where user_id = $2`,
      [round2(num(wallet.inr_balance) + amount), userId],
    );

    const block = await ledger.mintBlock([
      {
        txHash: ledger.newTxHash(),
        kind: "topup",
        fromName: "SolarShare Bank (UPI)",
        toName: profile.fullName,
        kwh: 0,
        priceInr: 0,
        amountInr: amount,
      },
    ]);
    const w = await loadWallet(userId);
    if (!w) return { ok: false, message: "Wallet not found.", reason: "invalid" };
    return {
      ok: true,
      wallet: walletToRow(w.wallet, w.profile.panelKwp),
      block,
      amountInr: amount,
      kwh: 0,
    };
  },
);

export const solarWithdraw = createServerFn({ method: "POST" })
  .validator(amountSchema)
  .middleware([authMiddleware])
  .handler(
  async ({ context, data }): Promise<SettleResult | SettleError> => {
    const { userId } = context as { userId: string };
    const ledger = await import("./ledger.server");
    const amount = round2(clamp(data.amount, 1, 100000));
    const { profile, wallet } = await ensureProfileAndWallet(userId);
    if (amount > num(wallet.inr_balance) + 1e-9) {
      return { ok: false, message: "Insufficient INR balance for this withdrawal.", reason: "funds" };
    }
    const sql = await getSql();
    await sql.query(
      `update wallets set inr_balance = $1 where user_id = $2`,
      [round2(num(wallet.inr_balance) - amount), userId],
    );
    const block = await ledger.mintBlock([
      {
        txHash: ledger.newTxHash(),
        kind: "withdraw",
        fromName: profile.fullName,
        toName: "SolarShare Bank (UPI)",
        kwh: 0,
        priceInr: 0,
        amountInr: amount,
      },
    ]);
    const w = await loadWallet(userId);
    if (!w) return { ok: false, message: "Wallet not found.", reason: "invalid" };
    return {
      ok: true,
      wallet: walletToRow(w.wallet, w.profile.panelKwp),
      block,
      amountInr: amount,
      kwh: 0,
    };
  },
);

export const solarSettleTrade = createServerFn({ method: "POST" })
  .validator(settleSchema)
  .middleware([authMiddleware])
  .handler(
  async ({ context, data }): Promise<SettleResult | SettleError> => {
    const { userId } = context as { userId: string };
    const ledger = await import("./ledger.server");
    const args = data;
    const legs = args.legs.filter(
      (l) =>
        l &&
        typeof l.peer === "string" &&
        Number.isFinite(l.kwh) &&
        Number.isFinite(l.priceInr) &&
        l.kwh > 0 &&
        l.priceInr > 0,
    );
    if (legs.length === 0) return { ok: false, message: "Nothing to settle.", reason: "invalid" };

    const { profile, wallet } = await ensureProfileAndWallet(userId);
    const kwh = round2(legs.reduce((s, l) => s + l.kwh, 0));
    const amount = round2(legs.reduce((s, l) => s + l.kwh * l.priceInr, 0));
    const myName = profile.fullName;

    if (args.action === "buy" && amount > num(wallet.inr_balance) + 1e-9) {
      return { ok: false, message: "Insufficient INR balance for this fill. Top up your wallet.", reason: "funds" };
    }
    if (args.action === "sell" && kwh > num(wallet.surplus_kwh) + 1e-9) {
      return { ok: false, message: "Not enough solar surplus to sell this volume.", reason: "surplus" };
    }

    const sql = await getSql();
    if (args.action === "buy") {
      await sql.query(
        `update wallets
           set inr_balance = $1, kwh_credits = $2,
               total_spent_inr = $3, total_bought_kwh = $4
         where user_id = $5`,
        [
          round2(num(wallet.inr_balance) - amount),
          round2(num(wallet.kwh_credits) + kwh),
          round2(num(wallet.total_spent_inr) + amount),
          round2(num(wallet.total_bought_kwh) + kwh),
          userId,
        ],
      );
    } else {
      await sql.query(
        `update wallets
           set inr_balance = $1, surplus_kwh = $2,
               total_earned_inr = $3, total_sold_kwh = $4
         where user_id = $5`,
        [
          round2(num(wallet.inr_balance) + amount),
          round2(num(wallet.surplus_kwh) - kwh),
          round2(num(wallet.total_earned_inr) + amount),
          round2(num(wallet.total_sold_kwh) + kwh),
          userId,
        ],
      );
    }

    const txs: LedgerTx[] = legs.map((l) => ({
      txHash: ledger.newTxHash(),
      kind: "trade",
      fromName: args.action === "buy" ? l.peer : myName,
      toName: args.action === "buy" ? myName : l.peer,
      kwh: round2(l.kwh),
      priceInr: round2(l.priceInr),
      amountInr: round2(l.kwh * l.priceInr),
    }));

    let block;
    try {
      block = await ledger.mintBlock(txs);
    } catch (err) {
      console.error("[solar] mint failed", err);
      return { ok: false, message: "Ledger could not record this settlement. Try again.", reason: "chain" };
    }

    const w = await loadWallet(userId);
    if (!w) return { ok: false, message: "Wallet not found.", reason: "invalid" };
    return {
      ok: true,
      wallet: walletToRow(w.wallet, w.profile.panelKwp),
      block,
      amountInr: amount,
      kwh,
    };
  },
);

export const solarListOrder = createServerFn({ method: "POST" })
  .validator(listOrderSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
  const { userId } = context as { userId: string };
  const ledger = await import("./ledger.server");
  const side = data.side;
  const kwh = round2(clamp(data.kwh, 0.1, 500));
  const priceInr = round2(clamp(data.priceInr, 1, 500));
  const { profile } = await ensureProfileAndWallet(userId);
  const id = `ord_${userId.slice(0, 8)}_${Date.now().toString(36)}`;
  const sql = await getSql();
  await sql.query(
    `insert into orders (id, user_id, peer_name, side, kwh, price_inr, source, status, created_at)
       values ($1, $2, $3, $4, $5, $6, 'user-profile', 'open', now())`,
    [id, userId, profile.fullName, side, kwh, priceInr],
  );
  const block = await ledger.mintBlock([
    {
      txHash: ledger.newTxHash(),
      kind: "listing",
      fromName: profile.fullName,
      toName: "Marketplace",
      kwh,
      priceInr,
      amountInr: round2(kwh * priceInr),
    },
  ]);
  return {
    ok: true as const,
    order: { id, side, kwh, priceInr, createdAt: new Date().toISOString() },
    block,
  };
});

export const solarVerifyChain = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<ChainVerification> => {
  const { verifyChain } = await import("./ledger.server");
  return verifyChain();
});

export const solarRecentBlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<BlockDetail[]> => {
  const { getRecentBlocks } = await import("./ledger.server");
  return getRecentBlocks(10);
});

export const solarTestnet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<TestnetStatus> => {
  const { getTestnetStatus } = await import("./testnet.server");
  return getTestnetStatus();
});
