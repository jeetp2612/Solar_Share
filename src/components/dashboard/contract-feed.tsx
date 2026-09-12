import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  Handshake,
  Layers,
  Pause,
  Play,
  Tag,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClock, formatInr, formatKwh } from "@/lib/format";
import { useMarket, type FeedFilter } from "@/lib/market-store";
import { groupHash } from "@/lib/solar/network-core";
import { SOURCE_LABEL, type FeedKind, type Transaction } from "@/lib/market-data";
import { cn } from "@/lib/utils";
import { SourceIcon } from "./peer";

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "trades", label: "Trades" },
  { key: "deals", label: "P2P deals" },
  { key: "money", label: "Money" },
];

const KIND_META: Record<FeedKind, { label: string; icon: typeof Zap; chip: string; iconColor: string }> = {
  trade: { label: "Trade", icon: Zap, chip: "bg-primary/15 text-primary", iconColor: "text-primary" },
  deal: { label: "P2P deal", icon: Handshake, chip: "bg-accent/15 text-accent", iconColor: "text-accent" },
  listing: { label: "Listing", icon: Tag, chip: "bg-secondary text-muted-foreground", iconColor: "text-muted-foreground" },
  topup: { label: "Top-up", icon: ArrowDownToLine, chip: "bg-accent/15 text-accent", iconColor: "text-accent" },
  withdraw: { label: "Withdraw", icon: ArrowUpFromLine, chip: "bg-warn/15 text-warn", iconColor: "text-warn" },
  grid: { label: "Grid", icon: Activity, chip: "bg-secondary text-muted-foreground", iconColor: "text-subtle" },
};

/**
 * Trade feed — the feeder's activity, properly organised.
 *
 * Each row now says *what kind* of event it is (member trade, direct P2P deal,
 * new listing, UPI money movement, grid signal), who was involved, the energy,
 * the unit price, the rupee total, where it came from and which block settled
 * it. Rows expand to a readable (4-hex grouped) transaction hash, the feed can
 * be filtered to just your own activity, and it can be **paused** so a row you
 * are reading does not scroll away.
 */
export function ContractFeed() {
  const txs = useMarket((s) => s.txs);
  const filter = useMarket((s) => s.feedFilter);
  const setFilter = useMarket((s) => s.setFeedFilter);
  const paused = useMarket((s) => s.feedPaused);
  const setPaused = useMarket((s) => s.setFeedPaused);
  const setLedgerOpen = useMarket((s) => s.setLedgerOpen);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [, setClock] = useState(0);

  // Relative timestamps ("12s ago") need a heartbeat.
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const visible = useMemo(() => {
    switch (filter) {
      case "mine":
        return txs.filter((t) => t.mine);
      case "trades":
        return txs.filter((t) => t.kind === "trade");
      case "deals":
        return txs.filter((t) => t.kind === "deal");
      case "money":
        return txs.filter((t) => t.kind === "topup" || t.kind === "withdraw");
      default:
        return txs;
    }
  }, [txs, filter]);

  const counts = useMemo(
    () => ({
      mine: txs.filter((t) => t.mine).length,
      deals: txs.filter((t) => t.kind === "deal").length,
      kwh: txs.reduce((s, t) => s + t.kwh, 0),
    }),
    [txs],
  );

  function copyHash(hash: string) {
    void navigator.clipboard.writeText(hash);
    setCopied(hash);
    toast.success("Transaction hash copied");
    window.setTimeout(() => setCopied((c) => (c === hash ? null : c)), 1200);
  }

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Trade feed
            {!paused ? <span className="live-dot size-1.5 rounded-full bg-primary" /> : null}
          </CardTitle>
          <CardDescription>
            {paused
              ? "Paused — nothing new will land while you read."
              : `${counts.kwh.toFixed(0)} kWh in view · ${counts.deals} direct deals · ${counts.mine} yours`}
          </CardDescription>
        </div>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
            paused
              ? "border-warn/50 bg-warn/10 text-warn"
              : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 pt-0">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Feed filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors duration-150",
                filter === f.key
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="max-h-[26rem] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {visible.map((tx) => (
            <FeedRow
              key={tx.id}
              tx={tx}
              expanded={expanded === tx.id}
              copied={copied === tx.txHash}
              onToggle={() => setExpanded(expanded === tx.id ? null : tx.id)}
              onCopy={() => copyHash(tx.txHash)}
              onOpenLedger={() => setLedgerOpen(true)}
            />
          ))}
          {visible.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground">
              {filter === "mine"
                ? "Your settlements land here — buy or sell to see them on the feeder feed."
                : "No events match this filter yet."}
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}

function FeedRow({
  tx,
  expanded,
  copied,
  onToggle,
  onCopy,
  onOpenLedger,
}: {
  tx: Transaction;
  expanded: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onOpenLedger: () => void;
}) {
  const meta = KIND_META[tx.kind] ?? KIND_META.trade;
  const Icon = meta.icon;
  const energy = tx.kwh > 0;

  return (
    <li
      className={cn(
        "rounded-xl px-3 py-2.5 transition-colors",
        tx.fresh ? "row-fresh bg-secondary/40" : "bg-background",
        tx.mine && "ring-1 ring-primary/25",
      )}
    >
      <button type="button" onClick={onToggle} className="block w-full text-left" aria-expanded={expanded}>
        <div className="flex items-start gap-2.5">
          <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md", meta.chip)}>
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <Headline tx={tx} />
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground tabular">
              {energy ? (
                <>
                  <span className="font-mono text-primary">{formatKwh(tx.kwh)}</span>
                  <span className="font-mono">@ {formatInr(tx.price, 2)}/kWh</span>
                  <span className="font-mono text-foreground">{formatInr(tx.totalInr, 2)}</span>
                </>
              ) : tx.totalInr > 0 ? (
                <span className="font-mono text-foreground">{formatInr(tx.totalInr, 0)}</span>
              ) : null}
              {tx.area ? (
                <span className="inline-flex items-center gap-1">
                  {tx.source ? <SourceIcon source={tx.source} className="size-2.5" /> : null}
                  {tx.area}
                  {tx.distanceKm != null && tx.distanceKm > 0
                    ? ` · ${tx.distanceKm < 1 ? `${Math.round(tx.distanceKm * 1000)} m` : `${tx.distanceKm.toFixed(1)} km`}`
                    : ""}
                  {tx.source ? ` · ${SOURCE_LABEL[tx.source]}` : ""}
                </span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="block font-mono text-[10px] text-muted-foreground tabular" title={formatClock(tx.timestamp)}>
              {relativeTime(tx.timestamp)}
            </span>
            <span className="mt-1 flex items-center justify-end gap-1">
              {tx.instalment ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-accent/15 px-1 font-mono text-[9px] text-accent tabular">
                  <Layers className="size-2.5" />
                  {tx.instalment.index}/{tx.instalment.of}
                </span>
              ) : null}
              {tx.block != null ? (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenLedger();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onOpenLedger();
                    }
                  }}
                  className="cursor-pointer rounded bg-secondary px-1 font-mono text-[9px] text-foreground tabular hover:bg-primary/15 hover:text-primary"
                  title="Open the ledger"
                >
                  blk {tx.block.toLocaleString("en-IN")}
                </span>
              ) : (
                <span className="rounded bg-secondary px-1 font-mono text-[9px] text-muted-foreground">
                  local
                </span>
              )}
            </span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
          {tx.note ? <p className="text-[10px] leading-relaxed text-muted-foreground">{tx.note}</p> : null}
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 font-mono text-[10px] break-all text-muted-foreground tabular">
              {groupHash(tx.txHash)}
            </p>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-accent hover:text-foreground"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 text-[10px] text-muted-foreground tabular">
            <span>{formatClock(tx.timestamp)} IST</span>
            <span>
              {tx.fromName} → {tx.toName}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1",
                tx.status === "confirmed" ? "text-primary" : "text-warn",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  tx.status === "confirmed" ? "bg-primary" : "bg-warn",
                )}
              />
              {tx.status === "confirmed" ? "Confirmed" : "Pending"}
            </span>
          </p>
        </div>
      ) : null}
    </li>
  );
}

function Headline({ tx }: { tx: Transaction }) {
  const mine = tx.mine;
  const verb =
    tx.kind === "listing"
      ? "listed"
      : tx.kind === "topup"
        ? "topped up"
        : tx.kind === "withdraw"
          ? "withdrew"
          : tx.kind === "grid"
            ? ""
            : tx.kind === "deal"
              ? "dealt"
              : "sold";

  if (tx.kind === "grid") {
    return (
      <p className="text-[11px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">{tx.fromName}</span>
        {tx.note ? ` — ${tx.note}` : ""}
      </p>
    );
  }

  if (mine) {
    const youBought = tx.to === "you";
    return (
      <p className="text-[11px] leading-snug">
        <span className="font-medium text-primary">You</span>
        <span className="text-muted-foreground"> {youBought ? "bought" : "sold"} </span>
        <span className="font-mono text-foreground tabular">
          {tx.kwh > 0 ? formatKwh(tx.kwh) : formatInr(tx.totalInr, 0)}
        </span>
        <span className="text-muted-foreground"> {youBought ? "from" : "to"} </span>
        <span className="font-medium text-foreground">{youBought ? tx.fromName : tx.toName}</span>
        {tx.kind === "deal" ? (
          <span className="ml-1 rounded bg-accent/15 px-1 font-mono text-[9px] text-accent">direct</span>
        ) : null}
      </p>
    );
  }

  return (
    <p className="text-[11px] leading-snug">
      <span className="font-medium text-foreground">{tx.fromName}</span>
      <span className="text-muted-foreground"> {verb} </span>
      <span className="font-mono text-foreground tabular">
        {tx.kwh > 0 ? formatKwh(tx.kwh) : formatInr(tx.totalInr, 0)}
      </span>
      {tx.toName !== "Marketplace" ? (
        <>
          <span className="text-muted-foreground"> to </span>
          <span className="font-medium text-foreground">{tx.toName}</span>
        </>
      ) : (
        <span className="text-muted-foreground"> on the book</span>
      )}
    </p>
  );
}

function relativeTime(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
