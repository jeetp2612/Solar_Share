import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClock, formatUsd } from "@/lib/format";
import { useMarket } from "@/lib/market-store";

type Row = {
  t: number;
  price: number;
  supply: number;
  demand: number;
  time: string;
};

export function PriceChart() {
  const history = useMarket((s) => s.history);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const data: Row[] = history.map((p) => ({
    ...p,
    time: formatClock(p.t),
  }));

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader>
        <div>
          <CardTitle>Dynamic local price</CardTitle>
          <CardDescription>
            Price tracks rooftop supply (sunlight) against neighborhood demand in real time.
          </CardDescription>
        </div>
        <Legend />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-64 w-full sm:h-72">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="supplyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  domain={["auto", "auto"]}
                />
                <YAxis yAxisId="energy" hide domain={[0, "auto"]} />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "var(--color-subtle)", strokeDasharray: "3 3" }}
                />
                <Area
                  yAxisId="energy"
                  type="monotone"
                  dataKey="supply"
                  stroke="var(--color-primary)"
                  strokeWidth={1.25}
                  fill="url(#supplyFill)"
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="energy"
                  type="monotone"
                  dataKey="demand"
                  stroke="var(--color-accent)"
                  strokeWidth={1.25}
                  fill="url(#demandFill)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  stroke="var(--color-foreground)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full rounded-xl bg-secondary/60" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Legend() {
  return (
    <ul className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
      <li className="flex items-center gap-1.5">
        <span className="h-px w-4 bg-foreground" />
        Price
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-primary" />
        Supply
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-accent" />
        Demand
      </li>
    </ul>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[var(--shadow-card-hover)]">
      <p className="mb-1 font-mono text-muted-foreground">{row.time} CT</p>
      <p className="tabular text-foreground">Price {formatUsd(row.price, 3)}</p>
      <p className="tabular text-primary">Supply {row.supply.toFixed(0)} kWh</p>
      <p className="tabular text-accent">Demand {row.demand.toFixed(0)} kWh</p>
    </div>
  );
}
