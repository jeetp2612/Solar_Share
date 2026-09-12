import type { ReactNode } from "react";
import { Activity, Gauge, SunMedium, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCompact, formatInr, formatKwh } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import { cn } from "@/lib/utils";

export function OverviewCards() {
  const price = useMarket((s) => s.price);
  const priceDelta = useMarket((s) => s.priceDelta);
  const congestion = useMarket((s) => s.congestion);
  const totalTradedKwh = useMarket((s) => s.totalTradedKwh);
  const wallet = useMarket((s) => s.wallet);
  const irradiance = useMarket((s) => s.irradiance);
  const supplyKwh = useMarket((s) => s.supplyKwh);
  const demandKwh = useMarket((s) => s.demandKwh);

  const up = priceDelta >= 0;
  const congestionMeta = {
    low: { label: "Low", hint: "Local solar is covering the feeder", className: "text-primary" },
    medium: { label: "Medium", hint: "Some load routing via the utility", className: "text-warn" },
    high: { label: "High", hint: "Feeder constrained — local fills preferred", className: "text-destructive" },
  }[congestion];

  return (
    <section className="stagger-in grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Market overview">
      <StatCard
        icon={Activity}
        label="Local energy price"
        value={formatInr(price, 2)}
        unit="/kWh"
        hint={
          <span className={cn("tabular", up ? "text-primary" : "text-destructive")}>
            {up ? "+" : ""}
            {formatInr(Math.abs(priceDelta), 3)}
          </span>
        }
      />
      <StatCard
        icon={Gauge}
        label="Grid congestion"
        value={congestionMeta.label}
        hint={<span className={congestionMeta.className}>{congestionMeta.hint}</span>}
        meter={<CongestionMeter level={congestion} />}
      />
      <StatCard
        icon={SunMedium}
        label="Energy traded"
        value={formatCompact(totalTradedKwh, 1)}
        unit="kWh"
        hint={
          <span>
            Supply {formatCompact(supplyKwh, 0)} · Demand {formatCompact(demandKwh, 0)}
          </span>
        }
      />
      <StatCard
        icon={Wallet}
        label={wallet ? "Your wallet" : "Wallet"}
        value={wallet ? formatInr(wallet.inr, 0) : "—"}
        unit={wallet ? "INR" : undefined}
        hint={
          wallet ? (
            <span>
              {formatKwh(wallet.kwhCredits)} on hand ·{" "}
              <span className="text-primary">{wallet.surplusKwh.toFixed(1)} kWh</span> to sell
            </span>
          ) : (
            <a href="/login" className="text-primary hover:underline">
              Create profile to trade
            </a>
          )
        }
        meter={
          wallet ? (
            <p className="mt-2 text-[11px] text-muted-foreground tabular">
              Roof {wallet.generatingKw > 0.05 ? `generating ${wallet.generatingKw.toFixed(2)} kW` : "idle"} · sun{" "}
              {(irradiance * 100).toFixed(0)}%
            </p>
          ) : undefined
        }
      />
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  meter,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  unit?: string;
  hint: ReactNode;
  meter?: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[11px] font-medium tracking-wide uppercase">{label}</span>
      </div>
      <p className="mt-3 flex items-baseline gap-1.5 font-display">
        <span className="text-2xl font-semibold tracking-tight text-foreground tabular sm:text-3xl">{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </p>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
      {meter}
    </Card>
  );
}

function CongestionMeter({ level }: { level: "low" | "medium" | "high" }) {
  const active = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <div className="mt-3 flex gap-1" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            "h-1 flex-1 rounded-full",
            n <= active
              ? n === 3
                ? "bg-destructive"
                : n === 2
                  ? "bg-warn"
                  : "bg-primary"
              : "bg-secondary",
          )}
        />
      ))}
    </div>
  );
}
