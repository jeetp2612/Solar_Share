import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Handshake,
  Info,
  Loader2,
  Sun,
  Target,
  UserPlus,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatInr, formatInrPerKwh, formatKwh } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import {
  affordableKwh,
  MIN_TRADE_KWH,
  round1,
  routeFill,
  summariseBook,
  type Quote,
} from "@/lib/deal";
import { GRID_FEE_BPS, SOURCE_LABEL } from "@/lib/market-data";
import { useSolarActions, useSolarState, usePeerName } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";
import { SourceIcon } from "./peer";

type Action = "buy" | "sell";
/** Sweep the book at market, rest an order at a limit, or deal with one person. */
type Mode = "market" | "limit" | "direct";

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "market", label: "Market", hint: "Sweep the cheapest lots until you are filled" },
  { key: "limit", label: "Limit", hint: "Set your price — the rest rests on the book" },
  { key: "direct", label: "Direct P2P", hint: "Deal with one neighbour, part of their lot" },
];

/**
 * Trade energy — every member can both buy and sell.
 *
 * Built to be *flexible*: volume comes from a slider, quick chips, a percentage
 * of what you can afford, or a **₹ budget** that converts into kWh at the current
 * book. Price is either the market sweep or a **limit with an explicit margin**
 * versus the live reference price. Before anything is signed, the panel shows the
 * exact route — which neighbour delivers which slice, the average price, the grid
 * fee, slippage and your margin — so the numbers are never a surprise.
 */
export function QuickTrade() {
  const price = useMarket((s) => s.price);
  const orders = useMarket((s) => s.orders);
  const selectedOrderId = useMarket((s) => s.selectedOrderId);
  const selectOrder = useMarket((s) => s.selectOrder);
  const openDeal = useMarket((s) => s.openDeal);
  const wallet = useMarket((s) => s.wallet);
  const pending = useMarket((s) => s.pending);
  const buy = useMarket((s) => s.buy);
  const sell = useMarket((s) => s.sell);
  const { user, profile, goSignIn } = useSolarState();
  const actions = useSolarActions();
  const peerName = usePeerName();

  const selected = orders.find((o) => o.id === selectedOrderId) ?? null;
  const book = useMemo(() => summariseBook(orders), [orders]);

  const [action, setAction] = useState<Action>("buy");
  const [mode, setMode] = useState<Mode>("market");
  const [kwh, setKwh] = useState(5);
  const [limit, setLimit] = useState(8.5);
  const [budgetMode, setBudgetMode] = useState(false);
  const [budget, setBudget] = useState(100);

  // Selecting a book row presets the matching side and follows that lot first.
  useEffect(() => {
    if (!selected) return;
    setAction(selected.side === "ask" ? "buy" : "sell");
    setLimit(Number(selected.price.toFixed(2)));
  }, [selected]);

  // The wallet card's Buy/Sell buttons drive this panel.
  useEffect(() => {
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "buy" || detail === "sell") setAction(detail);
    };
    window.addEventListener("solarshare:trade-action", onAction);
    return () => window.removeEventListener("solarshare:trade-action", onAction);
  }, []);

  const side = action === "buy" ? "ask" : "bid";

  /** How much the book + your wallet actually allow. */
  const maxKwh = useMemo(() => {
    if (action === "sell") {
      return Math.max(MIN_TRADE_KWH, round1(wallet?.surplusKwh ?? 10));
    }
    const depth = book.askDepthKwh;
    if (!wallet) return Math.max(MIN_TRADE_KWH, Math.min(20, depth || 20));
    const byBudget = affordableKwh(orders, wallet.inr).kwh;
    return Math.max(MIN_TRADE_KWH, round1(Math.min(depth || byBudget, byBudget)));
  }, [action, book.askDepthKwh, orders, wallet]);

  useEffect(() => {
    setKwh((v) => Number(Math.min(Math.max(v, MIN_TRADE_KWH), maxKwh).toFixed(1)));
  }, [maxKwh]);

  // Budget mode → energy, at the live book (grid fee included). Only re-runs when
  // the budget changes: reading the book through a ref keeps the slider and the
  // 2.2s market ticks from overwriting what the member typed.
  const bookRef = useRef({ orders, maxKwh, action });
  bookRef.current = { orders, maxKwh, action };
  useEffect(() => {
    if (!budgetMode) return;
    const { orders: live, maxKwh: cap, action: act } = bookRef.current;
    if (act !== "buy") return;
    const { kwh: affordable } = affordableKwh(live, budget);
    if (affordable > 0) setKwh(Number(Math.min(affordable, cap).toFixed(1)));
  }, [budgetMode, budget]);

  const limitBand = useMemo(() => {
    const ref = book.mid || price;
    return {
      min: Number((ref * 0.9).toFixed(2)),
      max: Number((ref * 1.1).toFixed(2)),
      ref,
    };
  }, [book.mid, price]);

  useEffect(() => {
    setLimit((v) => Number(Math.min(Math.max(v, limitBand.min), limitBand.max).toFixed(2)));
  }, [limitBand.min, limitBand.max]);

  /** Live quote: exactly what will happen if you press the button now. */
  const preview = useMemo(() => {
    if (mode === "direct") return null;
    return routeFill(orders, side, kwh, {
      limit: mode === "limit" ? limit : undefined,
      preferOrderId: selectedOrderId ?? undefined,
      referencePrice: book.mid || price,
    });
  }, [orders, side, kwh, mode, limit, selectedOrderId, book.mid, price]);

  const quote: Quote | null = preview?.quote ?? null;
  const filled = quote?.filledKwh ?? 0;
  const unfilled = preview?.remaining ?? 0;
  const netCost = quote?.netInr ?? 0;

  const walletAfter = wallet ? (action === "buy" ? wallet.inr - netCost : wallet.inr + netCost) : 0;
  const surplusAfter = wallet
    ? action === "sell"
      ? wallet.surplusKwh - (quote?.filledKwh ?? 0)
      : wallet.surplusKwh
    : 0;

  const shortFunds = action === "buy" && wallet != null && walletAfter < -1e-9;
  const shortSurplus = action === "sell" && wallet != null && surplusAfter < -1e-9;
  const noLiquidity = quote != null && filled <= 0;

  const margin = (() => {
    if (!quote || filled <= 0) return null;
    const ref = book.mid || price;
    if (ref <= 0) return null;
    const pct = ((quote.avgPrice - ref) / ref) * 100;
    const better = action === "buy" ? pct < 0 : pct > 0;
    return { pct: Math.abs(pct), better };
  })();

  const bestCounterparty = action === "buy" ? book.bestAsk : book.bestBid;

  async function submit() {
    if (!user) {
      toast.info("Create your profile to buy & sell energy");
      goSignIn();
      return;
    }
    const hooks = {
      settle: (legs: Parameters<typeof actions.settle>[0]) => actions.settle(legs, action),
      listRest: (s: "ask" | "bid", k: number, p: number) => actions.listOrder(s, k, p),
      peerName,
      peerArea: profile?.area,
    };
    const options = {
      limit: mode === "limit" ? limit : undefined,
      preferOrderId: selectedOrderId ?? undefined,
    };
    const result = action === "buy" ? await buy(kwh, options, hooks) : await sell(kwh, options, hooks);
    if (result.ok) toast.success(result.message);
    else if (result.reason !== "auth") toast.error(result.message);
  }

  return (
    <Card id="trade-panel" className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Trade energy</CardTitle>
          <CardDescription>
            {selected
              ? `Following ${selected.peer}'s lot first`
              : action === "buy"
                ? "Sweep cheapest local asks, or deal with one neighbour"
                : "Hit bids or rest your surplus on the book"}
          </CardDescription>
        </div>
        <div className="flex rounded-md bg-secondary p-1" role="group" aria-label="Trade action">
          <OptionButton
            active={action === "buy"}
            onClick={() => setAction("buy")}
            icon={Zap}
            label="Buy"
            tone="accent"
          />
          <OptionButton
            active={action === "sell"}
            onClick={() => setAction("sell")}
            icon={Sun}
            label="Sell"
            tone="primary"
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pt-2">
        {/* Mode */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary/60 p-1" role="tablist" aria-label="Order type">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "h-8 rounded-md text-[11px] font-medium transition-colors duration-150",
                mode === m.key
                  ? "bg-background text-foreground shadow-[var(--shadow-card)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="-mt-1 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
          <Info className="mt-px size-3 shrink-0" />
          {MODES.find((m) => m.key === mode)?.hint}
        </p>

        {mode === "direct" ? (
          <DirectPanel
            action={action}
            best={bestCounterparty}
            selected={selected}
            onOpen={(id) => openDeal(id)}
            signedIn={Boolean(user)}
            onSignIn={goSignIn}
          />
        ) : (
          <>
            {/* Volume */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase" htmlFor="trade-volume">
                  Volume
                </label>
                <span className="font-mono text-[10px] text-muted-foreground tabular">
                  max {maxKwh.toFixed(1)} kWh
                  {action === "sell" ? " surplus" : " affordable"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="trade-volume"
                  type="number"
                  min={MIN_TRADE_KWH}
                  max={maxKwh}
                  step={0.1}
                  value={kwh}
                  onChange={(e) => setKwh(Number(e.target.value))}
                  className="h-10 font-mono tabular"
                />
                <span className="shrink-0 text-xs text-muted-foreground">kWh</span>
                {action === "buy" ? (
                  <button
                    type="button"
                    onClick={() => setBudgetMode((v) => !v)}
                    className={cn(
                      "h-10 shrink-0 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                      budgetMode
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    ₹ budget
                  </button>
                ) : null}
              </div>

              {budgetMode && action === "buy" ? (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  Spend
                  <Input
                    type="number"
                    min={10}
                    step={10}
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="h-9 font-mono tabular"
                    aria-label="Rupee budget"
                  />
                  ₹ buys {kwh.toFixed(1)} kWh
                </label>
              ) : (
                <Slider
                  className="mt-1"
                  min={MIN_TRADE_KWH}
                  max={maxKwh}
                  step={0.1}
                  value={[Math.min(Math.max(kwh, MIN_TRADE_KWH), maxKwh)]}
                  onValueChange={(v) => setKwh(v[0] ?? MIN_TRADE_KWH)}
                />
              )}

              <div className="mt-1.5 flex flex-wrap gap-1">
                {[
                  { label: "1", value: 1 },
                  { label: "5", value: 5 },
                  { label: "10", value: 10 },
                  { label: "25%", value: maxKwh * 0.25 },
                  { label: "50%", value: maxKwh * 0.5 },
                  { label: "Max", value: maxKwh },
                ].map((chip) => {
                  const value = Number(Math.min(Math.max(chip.value, MIN_TRADE_KWH), maxKwh).toFixed(1));
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setKwh(value);
                        if (action === "buy" && budgetMode) {
                          setBudgetMode(false);
                          setBudget(Math.round(value * (quote?.avgPrice || price)));
                        }
                      }}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular transition-colors",
                        Math.abs(kwh - value) < 0.05
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price / margin */}
            <div className="rounded-xl bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {mode === "limit" ? "Your limit price" : "Market price"}
                </p>
                <span className="font-mono text-[10px] text-muted-foreground tabular">
                  mid {formatInr(limitBand.ref, 2)} · spread {formatInr(book.spread, 2)}
                </span>
              </div>

              {mode === "limit" ? (
                <>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input
                      type="number"
                      min={limitBand.min}
                      max={limitBand.max}
                      step={0.05}
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="h-9 font-mono tabular"
                      aria-label="Limit price per kWh"
                    />
                    <span className="shrink-0 text-[11px] text-muted-foreground">₹/kWh</span>
                  </div>
                  <Slider
                    className="mt-1"
                    min={limitBand.min}
                    max={limitBand.max}
                    step={0.05}
                    value={[Math.min(Math.max(limit, limitBand.min), limitBand.max)]}
                    onValueChange={(v) => setLimit(v[0] ?? limitBand.ref)}
                  />
                  <MarginLine
                    your={limit}
                    ref_={limitBand.ref}
                    action={action}
                    note="Your limit versus the mid price"
                  />
                </>
              ) : (
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-lg text-foreground tabular">
                    {formatInrPerKwh(quote && filled > 0 ? quote.avgPrice : price)}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular">
                    {filled > 0 && quote
                      ? `avg of ${quote.legs.length} lot${quote.legs.length > 1 ? "s" : ""}`
                      : "reference"}
                  </span>
                </div>
              )}
            </div>

            {/* Route preview */}
            {quote && filled > 0 ? (
              <div className="rounded-xl border border-border/60 bg-background p-3">
                <p className="flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                  <Target className="size-3" />
                  {action === "buy" ? "Where your kWh come from" : "Who takes your kWh"}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {quote.legs.map((leg, i) => (
                    <li key={`${leg.orderId}-${i}`} className="text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[9px] text-muted-foreground tabular">
                          {i + 1}
                        </span>
                        <SourceIcon
                          source={leg.source}
                          className={cn("shrink-0", action === "buy" ? "text-primary" : "text-accent")}
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">{leg.peer}</span>
                        <span className="shrink-0 font-mono text-muted-foreground tabular">
                          {leg.kwh.toFixed(1)} kWh
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono tabular",
                            action === "buy" ? "text-primary" : "text-accent",
                          )}
                        >
                          {formatInr(leg.priceInr, 2)}
                        </span>
                      </div>
                      <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className={cn("h-full", action === "buy" ? "bg-primary/70" : "bg-accent/70")}
                          style={{ width: `${Math.round(leg.share * 100)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 pl-6 text-[9px] text-muted-foreground tabular">
                        {leg.cumulativeKwh.toFixed(1)} kWh cumulative · {SOURCE_LABEL[leg.source]} ·{" "}
                        {leg.area}
                        {leg.lotLeftKwh > 0 ? ` · ${leg.lotLeftKwh.toFixed(1)} kWh stays with them` : ""}
                      </p>
                    </li>
                  ))}
                </ul>

                <dl className="mt-2.5 space-y-1 border-t border-border/60 pt-2 text-[11px]">
                  <Line label="Average price" value={formatInrPerKwh(quote.avgPrice)} />
                  <Line label="Gross" value={formatInr(quote.grossInr, 2)} />
                  <Line
                    label={`Grid fee (${(GRID_FEE_BPS / 100).toFixed(0)}%)`}
                    value={`${action === "buy" ? "+" : "−"}${formatInr(quote.feeInr, 2)}`}
                  />
                  <Line
                    label={action === "buy" ? "You pay" : "You receive"}
                    value={formatInr(quote.netInr, 2)}
                    strong
                  />
                  <Line
                    label="Slippage vs best"
                    value={`${quote.slippagePct > 0 ? "" : ""}${quote.slippagePct.toFixed(2)}%`}
                  />
                  {margin ? (
                    <Line
                      label="Your margin"
                      value={`${margin.pct.toFixed(2)}% ${margin.better ? "better" : "worse"} than mid`}
                      tone={margin.better ? "good" : "warn"}
                    />
                  ) : null}
                  {wallet ? (
                    action === "buy" ? (
                      <Line label="Wallet after" value={formatInr(Math.max(0, walletAfter), 2)} />
                    ) : (
                      <Line label="Surplus after" value={`${Math.max(0, surplusAfter).toFixed(1)} kWh`} />
                    )
                  ) : (
                    <Line label="Wallet" value="Not connected" />
                  )}
                </dl>

                {unfilled > 0.05 ? (
                  <p className="mt-2 rounded-lg bg-secondary/70 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    {mode === "limit"
                      ? `${unfilled.toFixed(1)} kWh cannot fill at ${formatInrPerKwh(limit)} — it rests on the book as your ${action === "buy" ? "bid" : "ask"}.`
                      : `Only ${filled.toFixed(1)} kWh available on the book — ${unfilled.toFixed(1)} kWh left unfilled.`}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Problems, stated plainly */}
            {noLiquidity ? (
              <Warn>
                {mode === "limit"
                  ? `Nothing on the book ${action === "buy" ? "at or below" : "at or above"} ${formatInrPerKwh(limit)}. Widen your limit or switch to Market.`
                  : "No lots on this feeder right now — try again in a few seconds."}
              </Warn>
            ) : null}
            {shortFunds ? (
              <Warn>
                Needs {formatInr(netCost, 2)} but your wallet has {formatInr(wallet?.inr ?? 0, 2)} —
                short by {formatInr(Math.abs(walletAfter), 2)}. Reduce the volume or top up.
              </Warn>
            ) : null}
            {shortSurplus ? (
              <Warn>
                You have {formatKwh(wallet?.surplusKwh ?? 0)} of surplus — reduce the volume to
                deliver.
              </Warn>
            ) : null}

            <Button
              size="lg"
              variant={action === "buy" ? "accent" : "default"}
              disabled={pending || !user || noLiquidity || shortFunds || shortSurplus || filled <= 0}
              onClick={() => void submit()}
              className="mt-auto w-full"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : user ? (
                action === "buy" ? (
                  <ArrowDownRight className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )
              ) : (
                <UserPlus className="size-4" />
              )}
              {pending
                ? "Settling on ledger…"
                : user
                  ? `${action === "buy" ? "Buy" : "Sell"} ${filled.toFixed(1)} kWh · ${formatInr(
                      Math.abs(netCost),
                      0,
                    )}`
                  : "Sign in to trade"}
            </Button>
            {selected ? (
              <button
                type="button"
                onClick={() => selectOrder(null)}
                className="text-[10px] text-muted-foreground underline decoration-dotted hover:text-foreground"
              >
                Stop following {selected.peer}&rsquo;s lot
              </button>
            ) : null}
          </>
        )}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Atomic settlement in Postgres — INR and kWh move together, then the trade is minted as a
          hash-chained block.
        </p>
      </CardContent>
    </Card>
  );
}

function DirectPanel({
  action,
  best,
  selected,
  onOpen,
  signedIn,
  onSignIn,
}: {
  action: Action;
  best: ReturnType<typeof summariseBook>["bestAsk"];
  selected: { id: string; peer: string; kwh: number; price: number } | null;
  onOpen: (id: string) => void;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const target = selected ?? best;
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-xl border border-border/60 bg-background p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <Handshake className="size-3.5" />
        Deal with one person
      </p>
      {target ? (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Open a direct deal with{" "}
            <span className="font-medium text-foreground">{target.peer}</span> — choose any slice of
            their {target.kwh.toFixed(1)} kWh lot at {formatInrPerKwh(target.price)}, negotiate
            inside a tolerance band, and split delivery into instalments if you want.
          </p>
          <Button
            size="lg"
            variant={action === "buy" ? "accent" : "default"}
            className="w-full gap-2"
            onClick={() => (signedIn ? onOpen(target.id) : onSignIn())}
          >
            <Handshake className="size-4" />
            {signedIn
              ? `${action === "buy" ? "Buy from" : "Sell to"} ${target.peer}`
              : "Sign in to deal directly"}
          </Button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Or pick any neighbour in the Marketplace and press their Buy/Sell button — the same deal
            sheet opens with their lot.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          No {action === "buy" ? "asks" : "bids"} on the book right now.
        </p>
      )}
    </div>
  );
}

function MarginLine({
  your,
  ref_,
  action,
  note,
}: {
  your: number;
  ref_: number;
  action: Action;
  note: string;
}) {
  const pct = ref_ > 0 ? ((your - ref_) / ref_) * 100 : 0;
  const better = action === "buy" ? pct < 0 : pct > 0;
  return (
    <p className="mt-1.5 flex items-center justify-between gap-2 text-[10px] tabular">
      <span className="text-muted-foreground">{note}</span>
      <span className={cn("font-mono", better ? "text-primary" : "text-warn")}>
        {pct > 0 ? "+" : ""}
        {pct.toFixed(2)}% · {better ? "in your favour" : "you pay more"}
      </span>
    </p>
  );
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono tabular",
          strong && "text-xs font-medium text-foreground",
          tone === "good" && "text-primary",
          tone === "warn" && "text-warn",
          !strong && !tone && "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive">
      {children}
    </p>
  );
}

function OptionButton({
  active,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  label: string;
  tone: "primary" | "accent";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm text-xs font-medium transition-[background-color,color] duration-150 ease-out",
        active
          ? "bg-background text-foreground shadow-[var(--shadow-card)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active && (tone === "primary" ? "text-primary" : "text-accent"))} />
      {label}
    </button>
  );
}
