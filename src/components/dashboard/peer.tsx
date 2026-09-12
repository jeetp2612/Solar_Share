import { Battery, Home, Star, SunMedium, Users } from "lucide-react";
import type { EnergySource, Order } from "@/lib/market-data";
import { cn } from "@/lib/utils";

/** Icon per energy source — used across the marketplace and the deal sheet. */
export function SourceIcon({
  source,
  className,
}: {
  source: EnergySource;
  className?: string;
}) {
  const Icon = source === "community-array" ? Users : source === "home-battery" ? Battery : Home;
  return <Icon className={cn("size-3.5", className)} aria-hidden="true" />;
}

/** Peer initial tile, tinted by the side they are on. */
export function PeerAvatar({ order, size = 7 }: { order: Order; size?: 6 | 7 | 9 }) {
  const isAsk = order.side === "ask";
  const box = size === 9 ? "size-9 text-xs" : size === 7 ? "size-7 text-[11px]" : "size-6 text-[10px]";
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-md font-semibold",
        box,
        order.address === "you"
          ? "bg-foreground/15 text-foreground"
          : isAsk
            ? "bg-primary/15 text-primary"
            : "bg-accent/15 text-accent",
      )}
      aria-hidden="true"
    >
      {order.address === "you" ? "YOU" : order.peer.slice(0, 1)}
    </span>
  );
}

/** 4.8 ★ + settled count — the trust signal for trading with a named person. */
export function Reliability({
  value,
  settled,
  className,
}: {
  value: number;
  settled?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular", className)}>
      <Star className="size-3 fill-warn text-warn" aria-hidden="true" />
      {value.toFixed(1)}
      {settled != null ? <span className="opacity-70">· {settled} settled</span> : null}
    </span>
  );
}

/** How much of a lot is still available, as a thin bar. */
export function LotMeter({ order, className }: { order: Order; className?: string }) {
  const pct = order.lotKwh > 0 ? Math.max(0, Math.min(1, order.kwh / order.lotKwh)) : 0;
  const partial = pct < 0.999;
  return (
    <span className={cn("block", className)}>
      <span
        className={cn(
          "block h-1 w-full overflow-hidden rounded-full bg-secondary",
          order.side === "ask" ? "[&>i]:bg-primary/70" : "[&>i]:bg-accent/70",
        )}
      >
        <i className="block h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%` }} />
      </span>
      {partial ? (
        <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground tabular">
          {order.kwh.toFixed(1)} of {order.lotKwh.toFixed(1)} kWh left
        </span>
      ) : null}
    </span>
  );
}

export function SunStrength({ irradiance }: { irradiance: number }) {
  const pct = Math.round(irradiance * 100);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular">
      <SunMedium className={cn("size-3", pct > 40 ? "text-warn" : "text-muted-foreground/60")} />
      {pct}%
    </span>
  );
}
