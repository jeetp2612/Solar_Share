import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Loader2, Sun, UserPlus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatInr, formatInrPerKwh } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import { usePeerName, useSolarActions, useSolarState } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";

type Action = "buy" | "sell";

export function QuickTrade() {
  const price = useMarket((s) => s.price);
  const orders = useMarket((s) => s.orders);
  const selectedOrderId = useMarket((s) => s.selectedOrderId);
  const wallet = useMarket((s) => s.wallet);
  const pending = useMarket((s) => s.pending);
  const buy = useMarket((s) => s.buy);
  const sell = useMarket((s) => s.sell);
  const { user, goSignIn } = useSolarState();
  const actions = useSolarActions();
  const peerName = usePeerName();

  const selected = orders.find((o) => o.id === selectedOrderId) ?? null;

  // Everyone gets both options. Selecting a book row presets the matching action.
  const [action, setAction] = useState<Action>("buy");
  useEffect(() => {
    if (selected) setAction(selected.side === "ask" ? "buy" : "sell");
  }, [selected]);

  // The wallet card's Buy/Sell option buttons drive the panel.
  useEffect(() => {
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "buy" || detail === "sell") setAction(detail);
    };
    window.addEventListener("solarshare:trade-action", onAction);
    return () => window.removeEventListener("solarshare:trade-action", onAction);
  }, []);

  const maxKwh = useMemo(() => {
    if (action === "sell") return Number((wallet?.surplusKwh ?? 10).toFixed(1));
    if (selected?.side === "ask") return Math.max(0.5, Number(selected.kwh.toFixed(1)));
    return 20;
  }, [action, selected, wallet]);

  const [kwh, setKwh] = useState(5);
  const [limitOn, setLimitOn] = useState(false);
  const [limit, setLimit] = useState(Number(price.toFixed(2)));

  useEffect(() => {
    setKwh((v) => Math.min(Math.max(0.5, v), Math.max(0.5, maxKwh)));
  }, [maxKwh]);

  useEffect(() => {
    if (selected) {
      setLimit(Number(selected.price.toFixed(2)));
      setKwh(Math.min(selected.kwh, Math.max(0.5, maxKwh)));
    } else {
      setLimit(Number(price.toFixed(2)));
    }
  }, [selected, price, maxKwh]);

  const quotePrice = selected?.price ?? (limitOn ? limit : price);
  const notional = kwh * quotePrice;

  async function submit() {
    if (!user) {
      toast.info("Create your profile to buy & sell energy");
      goSignIn();
      return;
    }
    const limitPrice = limitOn || selected ? quotePrice : undefined;
    const settle = (legs: Parameters<typeof actions.settle>[0]) => actions.settle(legs, action);
    const listRest = (side: "ask" | "bid", k: number, p: number) => actions.listOrder(side, k, p);
    const result = action === "buy" ? await buy(kwh, limitPrice, settle, listRest, peerName) : await sell(kwh, limitPrice, settle, listRest, peerName);
    if (result.ok) toast.success(result.message);
    else if (result.reason !== "auth") toast.error(result.message);
  }

  const sellCapped = action === "sell" && wallet != null && kwh > wallet.surplusKwh + 1e-9;

  return (
    <Card id="trade-panel" className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Trade energy</CardTitle>
          <CardDescription>
            {selected
              ? `Filled against ${selected.peer}`
              : action === "buy"
                ? "Sweep cheapest local asks"
                : "Hit bids or list surplus on the book"}
          </CardDescription>
        </div>
        {/* The two options — everyone can buy AND sell. */}
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
      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        <label className="block text-xs font-medium text-muted-foreground">
          Volume
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              type="number"
              min={0.5}
              max={maxKwh}
              step={0.1}
              value={kwh}
              onChange={(e) => setKwh(Number(e.target.value))}
              className="font-mono tabular"
            />
            <span className="shrink-0 text-xs text-muted-foreground">kWh</span>
          </div>
        </label>
        <Slider
          min={0.5}
          max={Math.max(0.5, maxKwh)}
          step={0.1}
          value={[Math.min(kwh, Math.max(0.5, maxKwh))]}
          onValueChange={(v) => setKwh(v[0] ?? 0.5)}
        />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLimitOn((v) => !v)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
              limitOn ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            {limitOn ? "Limit" : "Market"}
          </button>
          {limitOn ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              ₹/kWh
              <Input
                type="number"
                min={1}
                max={50}
                step={0.05}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-9 w-24 font-mono tabular"
              />
            </label>
          ) : (
            <span className="font-mono text-xs text-muted-foreground tabular">
              Ref {formatInrPerKwh(price)}
            </span>
          )}
        </div>

        <dl className="mt-auto space-y-2 rounded-xl bg-background p-3 text-sm">
          <Row label="Est. price" value={formatInrPerKwh(quotePrice)} />
          <Row label="Notional" value={formatInr(notional, 2)} />
          {user && wallet ? (
            action === "buy" ? (
              <Row
                label="Wallet after"
                value={formatInr(Math.max(0, wallet.inr - notional), 2)}
              />
            ) : (
              <Row
                label="Surplus after"
                value={`${Math.max(0, wallet.surplusKwh - kwh).toFixed(1)} kWh`}
              />
            )
          ) : (
            <Row label="Wallet" value="Not connected" />
          )}
        </dl>

        <Button
          size="lg"
          variant={action === "buy" ? "accent" : "default"}
          disabled={pending || (Boolean(user) && sellCapped)}
          onClick={() => void submit()}
          className="w-full"
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
              ? action === "buy"
                ? `Buy ${kwh.toFixed(1)} kWh`
                : `Sell ${kwh.toFixed(1)} kWh`
              : "Sign in to trade"}
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Atomic settlement in Postgres — INR and kWh move together, then the
          trade is minted as a hash-chained block.
        </p>
      </CardContent>
    </Card>
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
        active ? "bg-background text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active && (tone === "primary" ? "text-primary" : "text-accent"))} />
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs tabular text-foreground">{value}</dd>
    </div>
  );
}
