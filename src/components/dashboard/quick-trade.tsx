import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatKwh, formatUsd } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import { cn } from "@/lib/utils";

export function QuickTrade() {
  const mode = useMarket((s) => s.mode);
  const price = useMarket((s) => s.price);
  const orders = useMarket((s) => s.orders);
  const selectedOrderId = useMarket((s) => s.selectedOrderId);
  const wallet = useMarket((s) => s.wallet);
  const pending = useMarket((s) => s.pending);
  const buy = useMarket((s) => s.buy);
  const sell = useMarket((s) => s.sell);
  const openConnect = useMarket((s) => s.openConnect);

  const selected = orders.find((o) => o.id === selectedOrderId) ?? null;
  const action: "buy" | "sell" = selected
    ? selected.side === "ask"
      ? "buy"
      : "sell"
    : mode === "prosumer"
      ? "sell"
      : "buy";

  const maxKwh = useMemo(() => {
    if (action === "sell") return Number((wallet?.surplusKwh ?? 12).toFixed(1));
    if (selected?.side === "ask") return selected.kwh;
    return 20;
  }, [action, selected, wallet]);

  const [kwh, setKwh] = useState(5);
  const [limitOn, setLimitOn] = useState(false);
  const [limit, setLimit] = useState(Number(price.toFixed(3)));

  useEffect(() => {
    setKwh((v) => Math.min(Math.max(0.5, v), Math.max(0.5, maxKwh)));
  }, [maxKwh]);

  useEffect(() => {
    if (selected) {
      setLimit(selected.price);
      setKwh(Math.min(selected.kwh, maxKwh));
    } else {
      setLimit(Number(price.toFixed(3)));
    }
  }, [selected, price, maxKwh]);

  const quotePrice = selected?.price ?? (limitOn ? limit : price);
  const notional = kwh * quotePrice;

  async function submit() {
    if (!wallet) {
      openConnect(true);
      return;
    }
    const limitPrice = limitOn || selected ? quotePrice : undefined;
    const result = action === "buy" ? await buy(kwh, limitPrice) : await sell(kwh, limitPrice);
    if (result.ok) toast.success(result.message);
    else if (result.reason !== "wallet") toast.error(result.message);
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>{action === "buy" ? "Quick buy" : "Quick sell"}</CardTitle>
          <CardDescription>
            {selected
              ? `Filled against ${selected.peer}`
              : action === "buy"
                ? "Sweep cheapest local asks"
                : "Hit bids or list surplus on the book"}
          </CardDescription>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
            action === "buy" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary",
          )}
        >
          {action === "buy" ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
          {action === "buy" ? "Consumer fill" : "Prosumer offer"}
        </span>
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
          value={[kwh]}
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
              USD/kWh
              <Input
                type="number"
                min={0.05}
                max={0.4}
                step={0.001}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-9 w-24 font-mono tabular"
              />
            </label>
          ) : (
            <span className="font-mono text-xs text-muted-foreground tabular">
              Ref {formatUsd(price, 3)}
            </span>
          )}
        </div>

        <dl className="mt-auto space-y-2 rounded-xl bg-background p-3 text-sm">
          <Row label="Est. price" value={formatUsd(quotePrice, 3) + "/kWh"} />
          <Row label="Notional" value={formatUsd(notional, 2)} />
          {wallet ? (
            <Row
              label={action === "buy" ? "USD remaining" : "Surplus after"}
              value={
                action === "buy"
                  ? formatUsd(Math.max(0, wallet.usd - notional), 2)
                  : formatKwh(Math.max(0, wallet.surplusKwh - kwh))
              }
            />
          ) : (
            <Row label="Wallet" value="Not connected" />
          )}
        </dl>

        <Button
          size="lg"
          variant={action === "buy" ? "accent" : "default"}
          disabled={pending}
          onClick={() => void submit()}
          className="w-full"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending
            ? "Awaiting settlement…"
            : wallet
              ? `${action === "buy" ? "Buy" : "Sell"} ${kwh.toFixed(1)} kWh`
              : "Connect to trade"}
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Settlement is atomic on EnergyPool — kWh and USD move in one transaction once the matcher clears.
        </p>
      </CardContent>
    </Card>
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
