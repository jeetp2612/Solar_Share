import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import type { Order, OrderSide } from "@/lib/market-data";
import { cn } from "@/lib/utils";

type Filter = "all" | OrderSide;

export function OrderBook() {
  const orders = useMarket((s) => s.orders);
  const selectedOrderId = useMarket((s) => s.selectedOrderId);
  const selectOrder = useMarket((s) => s.selectOrder);
  const mode = useMarket((s) => s.mode);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const list = filter === "all" ? orders : orders.filter((o) => o.side === filter);
    return [...list].sort((a, b) => {
      if (a.side !== b.side) return a.side === "ask" ? -1 : 1;
      return a.side === "ask" ? a.price - b.price : b.price - a.price;
    });
  }, [orders, filter]);

  const asks = orders.filter((o) => o.side === "ask").sort((a, b) => a.price - b.price);
  const bids = orders.filter((o) => o.side === "bid").sort((a, b) => b.price - a.price);
  const bestAsk = asks[0];
  const bestBid = bids[0];
  const spread = bestAsk && bestBid ? bestAsk.price - bestBid.price : 0;
  const mid = bestAsk && bestBid ? (bestAsk.price + bestBid.price) / 2 : bestAsk?.price ?? bestBid?.price ?? 0;

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader>
        <div>
          <CardTitle>Marketplace</CardTitle>
          <CardDescription>Live order book for rooftop lots on this feeder.</CardDescription>
        </div>
        <div className="flex rounded-md bg-secondary p-0.5">
          {(["all", "ask", "bid"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "h-8 rounded-sm px-2.5 text-[11px] font-medium capitalize transition-colors duration-150",
                filter === key ? "bg-background text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground",
              )}
            >
              {key === "ask" ? "Asks" : key === "bid" ? "Bids" : "All"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            Best ask{" "}
            <span className="text-primary tabular">{bestAsk ? formatUsd(bestAsk.price, 3) : "—"}</span>
          </span>
          <span>
            Best bid{" "}
            <span className="text-accent tabular">{bestBid ? formatUsd(bestBid.price, 3) : "—"}</span>
          </span>
          <span className="tabular">
            Spread {formatUsd(Math.max(0, spread), 3)} · Mid {formatUsd(mid, 3)}
          </span>
        </div>

        <div className="max-h-80 overflow-auto rounded-xl bg-background">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 font-medium">Peer</th>
                <th className="px-3 py-2.5 font-medium">Dist.</th>
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-3 py-2.5 font-medium">Price</th>
                <th className="px-3 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  selected={selectedOrderId === order.id}
                  prefer={mode === "consumer" ? "ask" : "bid"}
                  onSelect={() => selectOrder(selectedOrderId === order.id ? null : order.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderRow({
  order,
  selected,
  prefer,
  onSelect,
}: {
  order: Order;
  selected: boolean;
  prefer: OrderSide;
  onSelect: () => void;
}) {
  const isAsk = order.side === "ask";
  return (
    <tr
      className={cn(
        "border-b border-border/70 last:border-0",
        order.fresh && "row-fresh",
        selected && "bg-secondary/80",
      )}
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
              isAsk ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent",
            )}
          >
            {order.peer.slice(0, 1)}
          </span>
          <span>
            <span className="block text-sm leading-tight text-foreground">{order.peer}</span>
            <span className="block font-mono text-[10px] text-muted-foreground">
              {order.address.slice(0, 6)}…{order.address.slice(-4)}
            </span>
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {order.distanceKm < 1 ? `${Math.round(order.distanceKm * 1000)} m` : `${order.distanceKm.toFixed(1)} km`}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs tabular">{order.kwh.toFixed(1)} kWh</td>
      <td className="px-3 py-2.5">
        <span className={cn("font-mono text-xs tabular", isAsk ? "text-primary" : "text-accent")}>
          {formatUsd(order.price, 3)}
        </span>
        <Badge variant="muted" className="ml-2 hidden capitalize lg:inline-flex">
          {order.side}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button
          size="sm"
          variant={selected ? "default" : prefer === order.side ? "secondary" : "outline"}
          className="h-11 sm:h-9"
          onClick={onSelect}
        >
          {selected ? "Selected" : isAsk ? "Buy" : "Fill"}
        </Button>
      </td>
    </tr>
  );
}
