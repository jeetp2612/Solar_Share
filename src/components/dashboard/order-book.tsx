import { useMemo, useState } from "react";
import { ArrowDownUp, MapPin, Search, Sparkles, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatInr, formatInrPerKwh } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import { DUST_KWH, summariseBook } from "@/lib/deal";
import { MICROGRID, SOURCE_LABEL, type Order, type OrderSide } from "@/lib/market-data";
import { cn } from "@/lib/utils";
import { LotMeter, PeerAvatar, SourceIcon } from "./peer";

type Filter = "all" | OrderSide;
type Sort = "price" | "size" | "distance" | "reliability";

const SORTS: { key: Sort; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "size", label: "Size" },
  { key: "distance", label: "Near me" },
  { key: "reliability", label: "Rating" },
];

/**
 * Marketplace — the feeder's live order book.
 *
 * Modernised into an exchange-style two-sided book: asks stack down to the mid
 * price, bids stack below it, each row carries a **depth bar** (cumulative
 * liquidity at that level), a lot meter (how much of the neighbour's lot is
 * still available) and trust signals (area, distance, source, rating). The
 * action button opens a **direct P2P deal** with that specific person, so you
 * can take part of their lot rather than sweeping the whole book.
 */
export function OrderBook() {
  const orders = useMarket((s) => s.orders);
  const price = useMarket((s) => s.price);
  const selectedOrderId = useMarket((s) => s.selectedOrderId);
  const selectOrder = useMarket((s) => s.selectOrder);
  const openDeal = useMarket((s) => s.openDeal);

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("price");
  const [query, setQuery] = useState("");
  const [areas, setAreas] = useState<string[]>([]);

  const book = useMemo(() => summariseBook(orders), [orders]);

  const allAreas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) counts.set(o.area, (counts.get(o.area) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([area]) => area);
  }, [orders]);

  const matches = (o: Order) => {
    const q = query.trim().toLowerCase();
    if (q && !`${o.peer} ${o.area} ${o.address} ${SOURCE_LABEL[o.source]}`.toLowerCase().includes(q)) {
      return false;
    }
    if (areas.length && !areas.includes(o.area)) return false;
    return o.kwh > DUST_KWH;
  };

  const sorted = (side: OrderSide): Order[] => {
    const list = orders.filter((o) => o.side === side && matches(o));
    const byPrice = side === "ask" ? (a: Order, b: Order) => a.price - b.price : (a: Order, b: Order) => b.price - a.price;
    switch (sort) {
      case "size":
        return [...list].sort((a, b) => b.kwh - a.kwh);
      case "distance":
        return [...list].sort((a, b) => a.distanceKm - b.distanceKm);
      case "reliability":
        return [...list].sort((a, b) => b.reliability - a.reliability || byPrice(a, b));
      default:
        return [...list].sort(byPrice);
    }
  };

  const asks = sorted("ask");
  const bids = sorted("bid");
  const showAsks = filter !== "bid";
  const showBids = filter !== "ask";

  // Cumulative depth per side, keyed by order id → drives the depth bars.
  const depth = useMemo(() => {
    const build = (list: Order[]) => {
      const map = new Map<string, { cum: number; pct: number }>();
      const byPrice = list.slice().sort((a, b) => (a.side === "ask" ? a.price - b.price : b.price - a.price));
      let cum = 0;
      for (const o of byPrice) {
        cum += o.kwh;
        map.set(o.id, { cum, pct: 0 });
      }
      const max = cum || 1;
      for (const [, v] of map) v.pct = Math.round((v.cum / max) * 100);
      return map;
    };
    return { ask: build(orders.filter((o) => o.side === "ask")), bid: build(orders.filter((o) => o.side === "bid")) };
  }, [orders]);

  const toggleArea = (area: string) =>
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));

  const total = asks.length + bids.length;

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Marketplace
            <Badge variant="muted" className="font-mono text-[10px] tabular">
              {total} lots · {MICROGRID.nodesOnline} nodes
            </Badge>
          </CardTitle>
          <CardDescription>
            Live order book for rooftop lots on this feeder — tap a lot to deal with that person
            directly.
          </CardDescription>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex rounded-md bg-secondary p-0.5" role="group" aria-label="Book side">
            {(["all", "ask", "bid"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  "h-8 rounded-sm px-2.5 text-[11px] font-medium transition-colors duration-150",
                  filter === key
                    ? "bg-background text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {key === "ask" ? "Asks" : key === "bid" ? "Bids" : "All"}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search peer, area, source…"
              className="h-8 pl-8 text-xs"
              aria-label="Search the book"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-1">
        {/* Market header — mid, spread, depth */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Best ask"
            value={book.bestAsk ? formatInr(book.bestAsk.price, 2) : "—"}
            tone="primary"
            sub={book.bestAsk ? `${book.bestAsk.peer} · ${book.bestAsk.kwh.toFixed(1)} kWh` : "no offers"}
          />
          <Metric
            label="Best bid"
            value={book.bestBid ? formatInr(book.bestBid.price, 2) : "—"}
            tone="accent"
            sub={book.bestBid ? `${book.bestBid.peer} · ${book.bestBid.kwh.toFixed(1)} kWh` : "no bids"}
          />
          <Metric
            label="Mid / spread"
            value={formatInr(book.mid, 2)}
            sub={`spread ${formatInr(book.spread, 3)} · ref ${formatInr(price, 2)}`}
          />
          <Metric
            label="Depth"
            value={`${book.askDepthKwh.toFixed(0)} / ${book.bidDepthKwh.toFixed(0)}`}
            sub="kWh offered / wanted"
          />
        </div>

        {/* Sort + area filters */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            <ArrowDownUp className="size-3" />
            Sort
          </span>
          <div className="flex flex-wrap gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] transition-colors",
                  sort === s.key
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
            {allAreas.slice(0, 6).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] transition-colors",
                  areas.includes(area)
                    ? "bg-accent/15 text-accent"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {area}
              </button>
            ))}
            {areas.length ? (
              <button
                type="button"
                onClick={() => setAreas([])}
                className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground underline decoration-dotted hover:text-foreground"
              >
                clear
              </button>
            ) : null}
          </div>
        </div>

        {/* The book */}
        <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-background">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-background/95 text-[10px] tracking-wide text-muted-foreground uppercase backdrop-blur">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Peer</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">Source</th>
                <th className="px-3 py-2 font-medium">Lot</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Depth</th>
                <th className="px-3 py-2 text-right font-medium">Deal</th>
              </tr>
            </thead>
            <tbody>
              {showAsks
                ? asks.map((order) => (
                    <BookRow
                      key={order.id}
                      order={order}
                      best={order.id === book.bestAsk?.id}
                      selected={selectedOrderId === order.id}
                      depthPct={depth.ask.get(order.id)?.pct ?? 0}
                      cumKwh={depth.ask.get(order.id)?.cum ?? 0}
                      onSelect={() => selectOrder(selectedOrderId === order.id ? null : order.id)}
                      onDeal={() => openDeal(order.id)}
                    />
                  ))
                : null}

              {showAsks && showBids ? (
                <tr className="border-y border-border/70 bg-secondary/40">
                  <td colSpan={6} className="px-3 py-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground tabular">
                      <Sparkles className="size-3 text-primary" />
                      <span className="text-foreground">Mid {formatInrPerKwh(book.mid)}</span>
                      <span>spread {formatInr(book.spread, 3)}</span>
                      <span className="ml-auto">
                        {asks.reduce((s, o) => s + o.kwh, 0).toFixed(1)} kWh above ·{" "}
                        {bids.reduce((s, o) => s + o.kwh, 0).toFixed(1)} kWh below
                      </span>
                    </div>
                  </td>
                </tr>
              ) : null}

              {showBids
                ? bids.map((order) => (
                    <BookRow
                      key={order.id}
                      order={order}
                      best={order.id === book.bestBid?.id}
                      selected={selectedOrderId === order.id}
                      depthPct={depth.bid.get(order.id)?.pct ?? 0}
                      cumKwh={depth.bid.get(order.id)?.cum ?? 0}
                      onSelect={() => selectOrder(selectedOrderId === order.id ? null : order.id)}
                      onDeal={() => openDeal(order.id)}
                    />
                  ))
                : null}

              {total === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    No lots match those filters — clear the search or pick another area.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Depth = cumulative kWh at that price level or better. Buying takes the cheapest asks
          first; a direct deal lets you choose one neighbour and part of their lot.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "accent";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-2.5 py-2">
      <p className="text-[9px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm tabular",
          tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="truncate text-[9px] text-muted-foreground tabular">{sub}</p> : null}
    </div>
  );
}

function BookRow({
  order,
  best,
  selected,
  depthPct,
  cumKwh,
  onSelect,
  onDeal,
}: {
  order: Order;
  best: boolean;
  selected: boolean;
  depthPct: number;
  cumKwh: number;
  onSelect: () => void;
  onDeal: () => void;
}) {
  const isAsk = order.side === "ask";
  const isYours = order.address === "you";
  return (
    <tr
      onClick={onSelect}
      className={cn(
        "relative cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-secondary/60",
        order.fresh && "row-fresh",
        selected && "bg-secondary/80",
      )}
    >
      {/* Depth bar */}
      <td className="relative px-3 py-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 opacity-[0.13]",
            isAsk ? "bg-primary" : "bg-accent",
          )}
          style={{ width: `${depthPct}%` }}
        />
        <span className="relative flex items-center gap-2.5">
          <PeerAvatar order={order} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="block truncate text-sm leading-tight text-foreground">
                {isYours ? "Your order" : order.peer}
              </span>
              {best ? (
                <span
                  className={cn(
                    "rounded px-1 font-mono text-[8px] font-medium",
                    isAsk ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent",
                  )}
                >
                  BEST
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-2.5" />
                {order.area} ·{" "}
                {order.distanceKm < 1
                  ? `${Math.round(order.distanceKm * 1000)} m`
                  : `${order.distanceKm.toFixed(1)} km`}
              </span>
              <span className="inline-flex items-center gap-0.5 tabular">
                <Star className="size-2.5 fill-warn text-warn" />
                {order.reliability.toFixed(1)}
              </span>
            </span>
          </span>
        </span>
      </td>

      <td className="hidden px-3 py-2.5 lg:table-cell">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <SourceIcon source={order.source} className={isAsk ? "text-primary" : "text-accent"} />
          {SOURCE_LABEL[order.source]}
        </span>
      </td>

      <td className="px-3 py-2.5">
        <span className="block font-mono text-xs text-foreground tabular">
          {order.kwh.toFixed(1)} kWh
        </span>
        <LotMeter order={order} className="mt-1 w-20" />
      </td>

      <td className="px-3 py-2.5">
        <span
          className={cn(
            "block font-mono text-sm tabular",
            isAsk ? "text-primary" : "text-accent",
          )}
        >
          {formatInr(order.price, 2)}
        </span>
        <span className="block text-[9px] text-muted-foreground tabular">
          {formatInr(order.kwh * order.price, 0)} lot
        </span>
      </td>

      <td className="hidden px-3 py-2.5 text-right sm:table-cell">
        <span className="block font-mono text-[11px] text-muted-foreground tabular">
          {cumKwh.toFixed(1)}
        </span>
        <span className="block font-mono text-[9px] text-muted-foreground/70 tabular">
          {depthPct}%
        </span>
      </td>

      <td className="px-3 py-2.5 text-right">
        <Button
          size="sm"
          variant={selected ? "default" : isAsk ? "accent" : "outline"}
          className="h-11 sm:h-8"
          onClick={(e) => {
            e.stopPropagation();
            onDeal();
          }}
        >
          {isYours ? "View" : isAsk ? "Buy" : "Sell"}
        </Button>
      </td>
    </tr>
  );
}
