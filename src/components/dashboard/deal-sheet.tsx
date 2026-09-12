import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  HandCoins,
  Info,
  Loader2,
  MapPin,
  Repeat,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatInr, formatInrPerKwh, formatKwh } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import {
  affordableKwh,
  directDeal,
  instalmentEta,
  minDealKwh,
  splitInstalments,
  summariseBook,
} from "@/lib/deal";
import { GRID_FEE_BPS, SOURCE_LABEL } from "@/lib/market-data";
import { useSolarActions, useSolarState, usePeerName } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";
import { LotMeter, PeerAvatar, Reliability, SourceIcon } from "./peer";

/** How far from the listed price an offer can be and still auto-accept. */
const OFFER_TOLERANCE_PCT = 2.5;
/** Offer slider reaches this far either side of the listed price. */
const OFFER_BAND_PCT = 6;

/**
 * Direct P2P deal sheet — trade with ONE named neighbour and choose exactly how
 * much of their lot to take.
 *
 * This is the "can I just buy from this person, part of their kWh, then the
 * next part later?" flow:
 *  - volume runs from the seller's minimum slice up to the whole lot,
 *  - an optional offer price inside a tolerance band (with an honest verdict:
 *    accepted / countered),
 *  - optional delivery in instalments — every instalment settles atomically and
 *    mints its own hash-chained block, shown live as it lands.
 */
export function DealSheet() {
  const dealOrderId = useMarket((s) => s.dealOrderId);
  const openDeal = useMarket((s) => s.openDeal);
  const orders = useMarket((s) => s.orders);
  const wallet = useMarket((s) => s.wallet);
  const marketPrice = useMarket((s) => s.price);
  const pending = useMarket((s) => s.pending);
  const progress = useMarket((s) => s.dealProgress);
  const deal = useMarket((s) => s.deal);

  const { user, goSignIn } = useSolarState();
  const actions = useSolarActions();
  const peerName = usePeerName();

  const order = orders.find((o) => o.id === dealOrderId) ?? null;
  const open = Boolean(order);
  const buying = order?.side === "ask";

  const referencePrice = useMemo(() => {
    const book = summariseBook(orders);
    return book.mid || marketPrice;
  }, [orders, marketPrice]);

  const min = order ? minDealKwh(order) : 0.5;
  const max = order ? Math.max(min, Number(order.kwh.toFixed(1))) : 1;

  const [kwh, setKwh] = useState(1);
  const [budgetMode, setBudgetMode] = useState(false);
  const [budget, setBudget] = useState(100);
  const [offerOn, setOfferOn] = useState(false);
  const [offer, setOffer] = useState(8.5);
  const [instalments, setInstalments] = useState(1);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Reset the sheet whenever a different lot is opened.
  useEffect(() => {
    if (!order) return;
    const start = Math.min(Math.max(minDealKwh(order), Math.round(order.kwh * 0.5 * 10) / 10), order.kwh);
    setKwh(Number(start.toFixed(1)));
    setOffer(Number(order.price.toFixed(2)));
    setOfferOn(false);
    setInstalments(1);
    setBudgetMode(false);
    setBudget(Math.max(50, Math.round(order.kwh * order.price)));
    setLastResult(null);
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the volume inside whatever the lot still has (ambient fills shrink it).
  useEffect(() => {
    if (!order) return;
    setKwh((v) => Number(Math.min(Math.max(v, min), max).toFixed(1)));
  }, [min, max, order]);

  const quoted = useMemo(() => {
    if (!order) return null;
    return directDeal({
      order,
      kwh,
      offerPrice: offerOn ? offer : undefined,
      side: order.side,
      referencePrice,
      tolerancePct: OFFER_TOLERANCE_PCT,
    });
  }, [order, kwh, offer, offerOn, referencePrice]);

  // Budget mode: convert ₹ into the most energy this lot can deliver (fee incl.).
  // Reads the lot through a ref so it only re-runs when the *budget* changes —
  // otherwise it would fight the slider and the live book ticks.
  const orderRef = useRef(order);
  orderRef.current = order;
  useEffect(() => {
    if (!budgetMode) return;
    const lot = orderRef.current;
    if (!lot || lot.side !== "ask") return;
    const { kwh: affordable } = affordableKwh([lot], budget);
    const lo = minDealKwh(lot);
    const hi = Math.max(lo, Number(lot.kwh.toFixed(1)));
    setKwh(Number(Math.min(Math.max(affordable, lo), hi).toFixed(1)));
  }, [budgetMode, budget]);

  const parts = useMemo(
    () => (quoted?.ok ? splitInstalments(quoted.quote.filledKwh, instalments, min) : []),
    [quoted, instalments, min],
  );

  const quote = quoted?.ok ? quoted.quote : null;
  const valid = quoted?.ok ?? false;
  const price = quote?.avgPrice ?? order?.price ?? 0;

  const walletAfter = wallet
    ? buying
      ? wallet.inr - (quote?.netInr ?? 0)
      : wallet.inr + (quote?.netInr ?? 0)
    : 0;
  const surplusAfter = wallet ? wallet.surplusKwh - (buying ? 0 : (quote?.filledKwh ?? 0)) : 0;
  const insufficient =
    (buying && wallet != null && walletAfter < -1e-9) ||
    (!buying && wallet != null && surplusAfter < -1e-9);

  const marginLabel = (() => {
    if (!quote || !referencePrice) return null;
    const pct = ((quote.avgPrice - referencePrice) / referencePrice) * 100;
    const better = buying ? pct < 0 : pct > 0;
    return {
      pct: Math.abs(pct),
      better,
      text: `${Math.abs(pct).toFixed(2)}% ${better ? "better" : "worse"} than market (${formatInr(referencePrice, 2)})`,
    };
  })();

  async function confirm() {
    if (!order || !quote) return;
    if (!user) {
      toast.info("Create your profile to trade directly with a neighbour");
      goSignIn();
      return;
    }
    setLastResult(null);
    const result = await deal(
      {
        orderId: order.id,
        side: order.side,
        kwh: quote.filledKwh,
        offerPrice: offerOn ? offer : undefined,
        instalments,
      },
      {
        settle: (legs) => actions.settle(legs, buying ? "buy" : "sell"),
        listRest: (side, k, p) => actions.listOrder(side, k, p),
        peerName,
      },
    );
    if (result.ok) {
      toast.success(result.message);
      setLastResult(result.message);
      if (!result.partial && result.accepted) {
        window.setTimeout(() => openDeal(null), 900);
      }
    } else {
      toast.error(result.message);
      setLastResult(result.message);
    }
  }

  if (!order) {
    return (
      <Dialog open={false} onOpenChange={() => openDeal(null)}>
        <DialogContent className="hidden" />
      </Dialog>
    );
  }

  const offerBand = {
    min: Number((order.price * (1 - OFFER_BAND_PCT / 100)).toFixed(2)),
    max: Number((order.price * (1 + OFFER_BAND_PCT / 100)).toFixed(2)),
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && openDeal(null)}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {buying ? (
              <ArrowDownRight className="size-4 text-accent" />
            ) : (
              <ArrowUpRight className="size-4 text-primary" />
            )}
            Direct P2P deal
            <Badge variant={buying ? "accent" : "default"} className="text-[10px]">
              {buying ? "You buy" : "You sell"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Pick how much of {order.peer}&rsquo;s lot to take — a slice or the whole lot — and
            optionally spread delivery over instalments. Every instalment settles atomically and
            mints its own block.
          </DialogDescription>
        </DialogHeader>

        {/* Counterparty */}
        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3">
          <PeerAvatar order={order} size={9} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{order.peer}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {order.area} ·{" "}
                {order.distanceKm < 1
                  ? `${Math.round(order.distanceKm * 1000)} m`
                  : `${order.distanceKm.toFixed(1)} km`}
              </span>
              <span className="inline-flex items-center gap-1">
                <SourceIcon source={order.source} />
                {SOURCE_LABEL[order.source]}
              </span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Reliability value={order.reliability} settled={order.settled} />
              <span className="font-mono text-[10px] text-muted-foreground tabular">
                {order.address.slice(0, 6)}…{order.address.slice(-4)}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Their price</p>
            <p
              className={cn(
                "font-mono text-base tabular",
                buying ? "text-primary" : "text-accent",
              )}
            >
              {formatInrPerKwh(order.price)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground tabular">
              {formatKwh(order.kwh)} left
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Volume */}
          <div className="rounded-xl border border-border/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Volume from this lot
              </p>
              {buying ? (
                <button
                  type="button"
                  onClick={() => setBudgetMode((v) => !v)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                    budgetMode
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {budgetMode ? "₹ budget on" : "₹ budget"}
                </button>
              ) : null}
            </div>

            {budgetMode && buying ? (
              <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                Spend
                <Input
                  type="number"
                  min={10}
                  step={10}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="h-9 font-mono tabular"
                />
                ₹ → {kwh.toFixed(1)} kWh
              </label>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={min}
                  max={max}
                  step={0.1}
                  value={kwh}
                  onChange={(e) => setKwh(Number(e.target.value))}
                  className="h-9 font-mono tabular"
                  aria-label="Volume in kWh"
                />
                <span className="shrink-0 text-[11px] text-muted-foreground">kWh</span>
              </div>
            )}

            <Slider
              className="mt-1"
              min={min}
              max={max}
              step={0.1}
              value={[Math.min(Math.max(kwh, min), max)]}
              onValueChange={(v) => setKwh(v[0] ?? min)}
            />

            <div className="mt-1 flex flex-wrap gap-1">
              {[
                { label: `Min ${min.toFixed(1)}`, value: min },
                { label: "25%", value: order.kwh * 0.25 },
                { label: "50%", value: order.kwh * 0.5 },
                { label: "75%", value: order.kwh * 0.75 },
                { label: "Full lot", value: order.kwh },
              ].map((chip) => {
                const value = Number(Math.max(min, Math.min(max, chip.value)).toFixed(1));
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setKwh(value)}
                    className={cn(
                      "rounded-md border px-1.5 py-1 font-mono text-[10px] tabular transition-colors",
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

            <LotMeter order={{ ...order, kwh, lotKwh: order.lotKwh }} className="mt-2" />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Takes {((kwh / Math.max(order.lotKwh, 0.1)) * 100).toFixed(0)}% of their lot ·{" "}
              {(order.kwh - kwh).toFixed(1)} kWh stays with {order.peer.split(" ")[0]}
            </p>
          </div>

          {/* Price + delivery */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Price
                </p>
                <button
                  type="button"
                  onClick={() => setOfferOn((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                    offerOn
                      ? "bg-warn/15 text-warn"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  <HandCoins className="size-3" />
                  {offerOn ? "Your offer" : "Accept theirs"}
                </button>
              </div>

              {offerOn ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min={offerBand.min}
                      max={offerBand.max}
                      step={0.05}
                      value={offer}
                      onChange={(e) => setOffer(Number(e.target.value))}
                      className="h-9 font-mono tabular"
                      aria-label="Your offer per kWh"
                    />
                    <span className="shrink-0 text-[11px] text-muted-foreground">₹/kWh</span>
                  </div>
                  <Slider
                    className="mt-1"
                    min={offerBand.min}
                    max={offerBand.max}
                    step={0.05}
                    value={[Math.min(Math.max(offer, offerBand.min), offerBand.max)]}
                    onValueChange={(v) => setOffer(v[0] ?? order.price)}
                  />
                  <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed">
                    {quoted?.ok && !quoted.accepted ? (
                      <>
                        <Info className="mt-px size-3 shrink-0 text-warn" />
                        <span className="text-warn">
                          Outside the {OFFER_TOLERANCE_PCT}% band — they counter at{" "}
                          {formatInrPerKwh(quoted.counterPrice ?? order.price)} and the deal settles
                          there unless you cancel.
                        </span>
                      </>
                    ) : (
                      <>
                        <BadgeCheck className="mt-px size-3 shrink-0 text-primary" />
                        <span className="text-muted-foreground">
                          Within {OFFER_TOLERANCE_PCT}% of their price — auto-accepts at{" "}
                          <span className="font-mono text-foreground tabular">
                            {formatInrPerKwh(price)}
                          </span>
                          .
                        </span>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Settling at their listed{" "}
                  <span className="font-mono text-foreground tabular">
                    {formatInrPerKwh(order.price)}
                  </span>
                  . Switch to &ldquo;Your offer&rdquo; to negotiate inside a{" "}
                  {OFFER_TOLERANCE_PCT}% band.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border/70 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <Repeat className="size-3" />
                Delivery
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {[1, 2, 3, 4].map((n) => {
                  const disabled = !order.allowsInstalments && n > 1;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled}
                      onClick={() => setInstalments(n)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px] transition-colors",
                        instalments === n
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        disabled && "cursor-not-allowed opacity-40 hover:border-border/70",
                      )}
                    >
                      {n === 1 ? "One delivery" : `${n} instalments`}
                    </button>
                  );
                })}
              </div>
              {!order.allowsInstalments ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {order.peer} delivers this lot in one go only.
                </p>
              ) : parts.length > 1 ? (
                <ul className="mt-2 space-y-1">
                  {parts.map((part, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-md bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground tabular"
                    >
                      <CalendarClock className="size-3 shrink-0 text-primary" />
                      <span className="text-foreground">{part.toFixed(1)} kWh</span>
                      <span className="ml-auto">
                        {i === 0
                          ? "now"
                          : new Intl.DateTimeFormat("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                              timeZone: "Asia/Kolkata",
                            }).format(new Date(instalmentEta(i)))}
                      </span>
                      <span>· block +{i + 1}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  One atomic settlement, one block.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quote */}
        <dl className="space-y-1.5 rounded-xl bg-background p-3 text-sm">
          <Row label="Volume" value={formatKwh(quote?.filledKwh ?? kwh)} />
          <Row label="Price" value={formatInrPerKwh(price)} strong />
          <Row label="Gross" value={formatInr(quote?.grossInr ?? kwh * price, 2)} />
          <Row
            label={`Grid fee (${(GRID_FEE_BPS / 100).toFixed(0)}%)`}
            value={`${buying ? "+" : "−"}${formatInr(quote?.feeInr ?? 0, 2)}`}
          />
          <Row
            label={buying ? "You pay" : "You receive"}
            value={formatInr(quote?.netInr ?? kwh * price, 2)}
            strong
            tone={buying ? "accent" : "primary"}
          />
          {wallet ? (
            buying ? (
              <Row label="Wallet after" value={formatInr(Math.max(0, walletAfter), 2)} />
            ) : (
              <Row label="Surplus after" value={`${Math.max(0, surplusAfter).toFixed(1)} kWh`} />
            )
          ) : (
            <Row label="Wallet" value="Not connected" />
          )}
          {marginLabel ? (
            <Row
              label="Your margin"
              value={marginLabel.text}
              tone={marginLabel.better ? "primary" : "warn"}
            />
          ) : null}
          <Row
            label="Ledger"
            value={`${Math.max(1, parts.length)} block${parts.length > 1 ? "s" : ""} · SHA-256 chained`}
          />
        </dl>

        {!valid && quoted && !quoted.ok ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            {quoted.message}
          </p>
        ) : null}
        {insufficient ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            {buying
              ? `Short by ${formatInr(Math.abs(walletAfter), 2)} — top up your wallet or reduce the volume.`
              : `You only have ${wallet?.surplusKwh.toFixed(1)} kWh of surplus to deliver.`}
          </p>
        ) : null}

        {/* Progress */}
        {progress.running || progress.done > 0 ? (
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {progress.running ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="size-3.5 text-primary" />
              )}
              <span className="text-foreground">{progress.note}</span>
              <span className="ml-auto font-mono tabular">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{
                  width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-muted-foreground tabular">
              {progress.kwhDone.toFixed(1)} kWh · {formatInr(progress.inrDone, 2)}
              {progress.blocks.length ? ` · blocks ${progress.blocks.join(", ")}` : ""}
            </p>
          </div>
        ) : null}

        {lastResult && !progress.running ? (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] text-primary">{lastResult}</p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant={buying ? "accent" : "default"}
            className="flex-1"
            disabled={!valid || pending || progress.running || insufficient}
            onClick={() => void confirm()}
          >
            {pending || progress.running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : user ? (
              buying ? (
                <ArrowDownRight className="size-4" />
              ) : (
                <ArrowUpRight className="size-4" />
              )
            ) : (
              <UserPlus className="size-4" />
            )}
            {user
              ? pending || progress.running
                ? "Settling on ledger…"
                : `${buying ? "Buy" : "Sell"} ${(quote?.filledKwh ?? kwh).toFixed(1)} kWh ${
                    parts.length > 1 ? `in ${parts.length} parts` : "now"
                  }`
              : "Sign in to deal"}
          </Button>
          <Button size="lg" variant="outline" onClick={() => openDeal(null)} disabled={progress.running}>
            Cancel
          </Button>
        </div>

        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-px size-3 shrink-0 text-primary" />
          Atomic settlement in Postgres — INR and kWh move together, then each delivery is minted as
          a hash-chained block you can verify in the ledger.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "primary" | "accent" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right font-mono text-[11px] tabular",
          strong ? "text-sm font-medium" : "",
          tone === "primary"
            ? "text-primary"
            : tone === "accent"
              ? "text-accent"
              : tone === "warn"
                ? "text-warn"
                : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
