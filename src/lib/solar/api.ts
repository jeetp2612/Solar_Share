import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../auth/middleware";
import { getSql } from "../db";
import { WELCOME_INR, irradianceAt, type Wallet } from "../market-data";
import type {
  BlockDetail,
  ChainVerification,
  LedgerTx,
  PaymentMethod,
  PaymentRecord,
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

type PaymentMethodDbRow = {
  id: string;
  type: string;
  label: string;
  upi_id: string;
  holder_name: string | null;
  is_default: boolean;
  status: string;
  last_used_at: Date | string | null;
  created_at: Date | string;
};

type PaymentRecordDbRow = {
  id: string;
  direction: string;
  status: string;
  amount_inr: number | string;
  provider: string;
  provider_ref: string;
  method_label: string | null;
  upi_id: string | null;
  upi_intent: string | null;
  block_no: number | string | null;
  created_at: Date | string;
};

type PaymentInstrument = {
  id: string | null;
  label: string;
  upiId: string;
  holderName: string | null;
};

/** Credit solar generation since the last read (server is authoritative). */
async function creditGeneration(w: WalletDbRow, panelKwp: number): Promise<WalletDbRow> {
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

async function loadWallet(userId: string): Promise<{
  profile: { fullName: string; area: string; panelKwp: number; joinedAt: string };
  wallet: WalletDbRow;
} | null> {
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
  const authRows = await sql.query<{ name: string }>(`select "name" from "user" where "id" = $1`, [
    userId,
  ]);
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

const paymentId = (prefix: string, userId: string) =>
  `${prefix}_${userId.slice(0, 8)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeUpiId = (upiId: string) => upiId.trim().toLowerCase();
const UPI_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z0-9][a-z0-9.-]{1,63}$/i;

const fallbackPaymentMethod = (profileName: string): PaymentInstrument => ({
  id: null,
  label: "Demo UPI rail",
  upiId: "solarshare@upi",
  holderName: profileName,
});

function paymentMethodToRow(row: PaymentMethodDbRow): PaymentMethod {
  return {
    id: String(row.id),
    type: "upi",
    label: String(row.label),
    upiId: String(row.upi_id),
    holderName: row.holder_name ? String(row.holder_name) : null,
    isDefault: Boolean(row.is_default),
    status: row.status === "disabled" ? "disabled" : "active",
    lastUsedAt: row.last_used_at ? iso(row.last_used_at) : null,
    createdAt: iso(row.created_at),
  };
}

function paymentRecordToRow(row: PaymentRecordDbRow): PaymentRecord {
  return {
    id: String(row.id),
    direction: row.direction === "withdraw" ? "withdraw" : "topup",
    status: row.status === "pending" || row.status === "failed" ? row.status : "confirmed",
    amountInr: round2(num(row.amount_inr)),
    provider: "UPI",
    providerRef: String(row.provider_ref),
    methodLabel: row.method_label ? String(row.method_label) : null,
    upiId: row.upi_id ? String(row.upi_id) : null,
    upiIntent: row.upi_intent ? String(row.upi_intent) : null,
    blockNo: row.block_no == null ? null : Number(row.block_no),
    createdAt: iso(row.created_at),
  };
}

async function loadPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const sql = await getSql();
  const rows = await sql.query<PaymentMethodDbRow>(
    `select id, type, label, upi_id, holder_name, is_default, status, last_used_at, created_at
       from payment_methods
      where user_id = $1 and status = 'active'
      order by is_default desc, created_at desc`,
    [userId],
  );
  return rows.map(paymentMethodToRow);
}

async function loadRecentPayments(userId: string): Promise<PaymentRecord[]> {
  const sql = await getSql();
  const rows = await sql.query<PaymentRecordDbRow>(
    `select p.id, p.direction, p.status, p.amount_inr, p.provider, p.provider_ref,
            coalesce(pm.label, case when p.method_id is null then 'Demo UPI rail' else null end) as method_label,
            p.upi_id, p.upi_intent, p.block_no, p.created_at
       from payments p
       left join payment_methods pm on pm.id = p.method_id
      where p.user_id = $1
      order by p.created_at desc
      limit 8`,
    [userId],
  );
  return rows.map(paymentRecordToRow);
}

async function resolvePaymentMethod(
  userId: string,
  methodId?: string,
): Promise<PaymentInstrument | null> {
  const sql = await getSql();
  const rows = await sql.query<PaymentMethodDbRow>(
    methodId
      ? `select id, type, label, upi_id, holder_name, is_default, status, last_used_at, created_at
           from payment_methods where user_id = $1 and id = $2 and status = 'active' limit 1`
      : `select id, type, label, upi_id, holder_name, is_default, status, last_used_at, created_at
           from payment_methods where user_id = $1 and status = 'active'
           order by is_default desc, created_at desc limit 1`,
    methodId ? [userId, methodId] : [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    label: String(row.label),
    upiId: String(row.upi_id),
    holderName: row.holder_name ? String(row.holder_name) : null,
  };
}

function providerRef(direction: "topup" | "withdraw"): string {
  const prefix = direction === "topup" ? "UPI-IN" : "UPI-OUT";
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function buildUpiIntent(
  direction: "topup" | "withdraw",
  amount: number,
  ref: string,
  method: PaymentInstrument,
): string {
  const payee = direction === "topup" ? "solarshare@upi" : method.upiId;
  const payeeName = direction === "topup" ? "SolarShare Wallet" : method.holderName || method.label;
  const note = direction === "topup" ? "SolarShare wallet top-up" : "SolarShare wallet withdrawal";
  const params = new URLSearchParams({
    pa: payee,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
    tr: ref,
  });
  return `upi://pay?${params.toString()}`;
}

async function recordPayment(args: {
  userId: string;
  direction: "topup" | "withdraw";
  amount: number;
  blockNo: number;
  method: PaymentInstrument;
}): Promise<PaymentRecord> {
  const sql = await getSql();
  const ref = providerRef(args.direction);
  const intent = buildUpiIntent(args.direction, args.amount, ref, args.method);
  const id = paymentId("pay", args.userId);
  const rows = await sql.query<Omit<PaymentRecordDbRow, "method_label">>(
    `insert into payments (id, user_id, method_id, direction, status, amount_inr, provider, provider_ref, upi_id, upi_intent, block_no, created_at)
       values ($1, $2, $3, $4, 'confirmed', $5, 'UPI', $6, $7, $8, $9, now())
       returning id, direction, status, amount_inr, provider, provider_ref,
                 upi_id, upi_intent, block_no, created_at`,
    [
      id,
      args.userId,
      args.method.id,
      args.direction,
      args.amount,
      ref,
      args.method.upiId,
      intent,
      args.blockNo,
    ],
  );
  if (args.method.id) {
    await sql.query(
      `update payment_methods set last_used_at = now(), updated_at = now() where id = $1`,
      [args.method.id],
    );
  }
  return paymentRecordToRow({ ...rows[0], method_label: args.method.label });
}

const amountSchema = z.object({
  amount: z.number().int().min(1).max(100000),
  methodId: z.string().optional(),
});
const paymentMethodSchema = z.object({
  upiId: z.string().min(5).max(128),
  label: z.string().max(48).optional(),
  holderName: z.string().max(80).optional(),
});
const setDefaultPaymentMethodSchema = z.object({ methodId: z.string().min(1) });
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
/** `force` bypasses the bridge's short server-side cache (manual "Refresh now"). */
const testnetQuerySchema = z.object({ force: z.boolean().optional() }).optional();

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
    const [paymentMethods, recentPayments, head] = await Promise.all([
      loadPaymentMethods(userId),
      loadRecentPayments(userId),
      ledger.getChainHead(),
    ]);
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
      paymentMethods,
      recentPayments,
      chainHead: head,
    };
  });

export const solarAddPaymentMethod = createServerFn({ method: "POST" })
  .validator(paymentMethodSchema)
  .middleware([authMiddleware])
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: true; method: PaymentMethod } | { ok: false; message: string }> => {
      const { userId } = context as { userId: string };
      await ensureProfileAndWallet(userId);

      const upiId = normalizeUpiId(data.upiId);
      if (!UPI_ID_RE.test(upiId)) {
        return { ok: false, message: "Enter a valid UPI ID, for example name@bank." };
      }

      const label = (data.label ?? "My UPI").trim() || "My UPI";
      const holderName = (data.holderName ?? "").trim() || null;
      const id = paymentId("upi", userId);
      const sql = await getSql();

      // The most recently saved UPI method becomes the default funding rail.
      await sql.query(
        `update payment_methods
          set is_default = false, updated_at = now()
        where user_id = $1 and status = 'active'`,
        [userId],
      );
      const rows = await sql.query<PaymentMethodDbRow>(
        `insert into payment_methods (id, user_id, type, label, upi_id, holder_name, is_default, status, created_at, updated_at)
         values ($1, $2, 'upi', $3, $4, $5, true, 'active', now(), now())
         on conflict (user_id, upi_id) do update
           set label = excluded.label,
               holder_name = excluded.holder_name,
               is_default = true,
               status = 'active',
               updated_at = now()
         returning id, type, label, upi_id, holder_name, is_default, status, last_used_at, created_at`,
        [id, userId, label, upiId, holderName],
      );
      return { ok: true, method: paymentMethodToRow(rows[0]) };
    },
  );

export const solarSetDefaultPaymentMethod = createServerFn({ method: "POST" })
  .validator(setDefaultPaymentMethodSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { userId } = context as { userId: string };
    const sql = await getSql();
    const exists = await sql.query<{ id: string }>(
      `select id from payment_methods where user_id = $1 and id = $2 and status = 'active' limit 1`,
      [userId, data.methodId],
    );
    if (!exists[0]) return { ok: false, message: "Payment method not found." };
    await sql.query(
      `update payment_methods set is_default = false, updated_at = now() where user_id = $1 and status = 'active'`,
      [userId],
    );
    await sql.query(
      `update payment_methods set is_default = true, updated_at = now() where user_id = $1 and id = $2`,
      [userId, data.methodId],
    );
    return { ok: true };
  });

export const solarTopUp = createServerFn({ method: "POST" })
  .validator(amountSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SettleResult | SettleError> => {
    const { userId } = context as { userId: string };
    const ledger = await import("./ledger.server");
    const amount = round2(data.amount);
    const { profile, wallet } = await ensureProfileAndWallet(userId);
    const savedMethod = await resolvePaymentMethod(userId, data.methodId);
    if (data.methodId && !savedMethod) {
      return {
        ok: false,
        message: "Select a saved UPI method before topping up.",
        reason: "payment",
      };
    }
    const method = savedMethod ?? fallbackPaymentMethod(profile.fullName);

    const sql = await getSql();
    await sql.query(`update wallets set inr_balance = $1 where user_id = $2`, [
      round2(num(wallet.inr_balance) + amount),
      userId,
    ]);

    const block = await ledger.mintBlock([
      {
        txHash: ledger.newTxHash(),
        kind: "topup",
        fromName: `${method.label} (UPI)`,
        toName: profile.fullName,
        kwh: 0,
        priceInr: 0,
        amountInr: amount,
      },
    ]);
    const payment = await recordPayment({
      userId,
      direction: "topup",
      amount,
      blockNo: block.blockNo,
      method,
    });
    const w = await loadWallet(userId);
    if (!w) return { ok: false, message: "Wallet not found.", reason: "invalid" };
    return {
      ok: true,
      wallet: walletToRow(w.wallet, w.profile.panelKwp),
      block,
      amountInr: amount,
      kwh: 0,
      payment,
    };
  });

export const solarWithdraw = createServerFn({ method: "POST" })
  .validator(amountSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SettleResult | SettleError> => {
    const { userId } = context as { userId: string };
    const ledger = await import("./ledger.server");
    const amount = round2(clamp(data.amount, 1, 100000));
    const { profile, wallet } = await ensureProfileAndWallet(userId);
    if (amount > num(wallet.inr_balance) + 1e-9) {
      return {
        ok: false,
        message: "Insufficient INR balance for this withdrawal.",
        reason: "funds",
      };
    }
    const savedMethod = await resolvePaymentMethod(userId, data.methodId);
    if (data.methodId && !savedMethod) {
      return {
        ok: false,
        message: "Select a saved UPI method before withdrawing.",
        reason: "payment",
      };
    }
    const method = savedMethod ?? fallbackPaymentMethod(profile.fullName);

    const sql = await getSql();
    await sql.query(`update wallets set inr_balance = $1 where user_id = $2`, [
      round2(num(wallet.inr_balance) - amount),
      userId,
    ]);
    const block = await ledger.mintBlock([
      {
        txHash: ledger.newTxHash(),
        kind: "withdraw",
        fromName: profile.fullName,
        toName: `${method.label} (UPI)`,
        kwh: 0,
        priceInr: 0,
        amountInr: amount,
      },
    ]);
    const payment = await recordPayment({
      userId,
      direction: "withdraw",
      amount,
      blockNo: block.blockNo,
      method,
    });
    const w = await loadWallet(userId);
    if (!w) return { ok: false, message: "Wallet not found.", reason: "invalid" };
    return {
      ok: true,
      wallet: walletToRow(w.wallet, w.profile.panelKwp),
      block,
      amountInr: amount,
      kwh: 0,
      payment,
    };
  });

export const solarSettleTrade = createServerFn({ method: "POST" })
  .validator(settleSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SettleResult | SettleError> => {
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
      return {
        ok: false,
        message: "Insufficient INR balance for this fill. Top up your wallet.",
        reason: "funds",
      };
    }
    if (args.action === "sell" && kwh > num(wallet.surplus_kwh) + 1e-9) {
      return {
        ok: false,
        message: "Not enough solar surplus to sell this volume.",
        reason: "surplus",
      };
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
      return {
        ok: false,
        message: "Ledger could not record this settlement. Try again.",
        reason: "chain",
      };
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
  });

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
  .validator(testnetQuerySchema)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<TestnetStatus> => {
    const { getTestnetStatus } = await import("./testnet.server");
    return getTestnetStatus(Boolean(data?.force));
  });
