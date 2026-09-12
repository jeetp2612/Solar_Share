import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Server,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BRIDGE_NETWORK, formatAge, groupHash, shortGroupedHash } from "@/lib/solar/network-core";
import type { BridgeReason, TestnetStatus } from "@/lib/solar/types";
import { cn } from "@/lib/utils";

/**
 * Live public-chain panel (Polygon Amoy, chainId 80002).
 *
 * Built to be *readable and stable* — the two things the first version was not:
 *  - the endpoint is **pinned/sticky**, so the URL shown does not rotate,
 *  - the reading is a **snapshot**: values only change on an explicit refresh
 *    or on the (pausable) auto-refresh countdown, and the "as of …" clock makes
 *    the age of what you are looking at explicit,
 *  - hashes are **grouped in 4-hex chunks** (with a "show full" toggle) instead
 *    of one unreadable 66-character run,
 *  - failures are **classified** into a plain-language headline + detail, and
 *    the last verified head is kept on screen (labelled stale) rather than
 *    blanking out when the environment has no egress.
 */

const REFRESH_MS = 20_000;

const STATUS_META: Record<
  "live" | "stale" | "offline" | "checking",
  { label: string; className: string; dot: string }
> = {
  live: { label: "Live", className: "bg-primary/15 text-primary", dot: "bg-primary live-dot" },
  stale: { label: "Last known", className: "bg-warn/15 text-warn", dot: "bg-warn" },
  offline: { label: "Unreachable", className: "bg-secondary text-muted-foreground", dot: "bg-subtle" },
  checking: { label: "Reading", className: "bg-accent/15 text-accent", dot: "bg-accent" },
};

const REASON_LABEL: Record<BridgeReason, string> = {
  ok: "ok",
  checking: "reading",
  "no-egress": "no egress",
  timeout: "timeout",
  "rate-limited": "rate limit",
  "http-error": "http error",
  "wrong-network": "wrong network",
  "rpc-error": "rpc error",
};

export function NetworkPanel({
  status,
  loading,
  onRefresh,
}: {
  status: TestnetStatus | null;
  loading: boolean;
  onRefresh: (opts?: { force?: boolean }) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [expandedHash, setExpandedHash] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [nextIn, setNextIn] = useState(REFRESH_MS);
  const [, setClock] = useState(0);
  const lastAutoAt = useRef(Date.now());

  // "as of …" clock: re-render every second so the age reads correctly without
  // touching the displayed values.
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-refresh countdown (pausable — so numbers stop moving while reading).
  useEffect(() => {
    if (paused || loading) return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - lastAutoAt.current;
      const remaining = REFRESH_MS - elapsed;
      if (remaining <= 0) {
        lastAutoAt.current = Date.now();
        setNextIn(REFRESH_MS);
        onRefresh();
      } else {
        setNextIn(remaining);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [paused, loading, onRefresh]);

  const copy = useCallback((value: string, what: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(value);
    toast.success(`${what} copied`);
    window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 1200);
  }, []);

  const state: "live" | "stale" | "offline" | "checking" = !status
    ? "checking"
    : status.online
      ? "live"
      : status.stale
        ? "stale"
        : loading
          ? "checking"
          : "offline";
  const meta = STATUS_META[state];
  const ageMs = status ? Math.max(status.ageMs, Date.now() - status.checkedAt) : 0;
  const hash = status?.latestBlockHash ?? null;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex items-center gap-2 text-[11px] tracking-wide text-muted-foreground uppercase">
          <Globe2 className="size-3.5" />
          Live network · {status?.chain ?? BRIDGE_NETWORK.label}
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
            meta.className,
          )}
        >
          <span className={cn("size-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
        {status?.chainId ? (
          <Badge variant="outline" className="font-mono text-[10px] tabular">
            chainId {status.chainId}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-mono text-[10px] tabular">
            chainId {BRIDGE_NETWORK.chainId} expected
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular">
          {status?.networkKind ?? BRIDGE_NETWORK.kind} · read-only
        </span>
      </header>

      {/* Head reading */}
      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Head block</p>
          <p className="font-mono text-2xl leading-tight text-foreground tabular">
            {status?.blockNumber != null ? `#${status.blockNumber.toLocaleString("en-IN")}` : "—"}
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground">
          <p className="tabular">
            {status?.blockNumber != null ? `as of ${formatAge(ageMs)}` : "no reading yet"}
            {status?.latencyMs != null ? ` · ${status.latencyMs} ms RPC` : ""}
            {status?.peerCount != null ? ` · ${status.peerCount} peers` : ""}
          </p>
          {status?.latestBlockTime ? (
            <p className="tabular">
              mined{" "}
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "medium",
                timeZone: "Asia/Kolkata",
              }).format(new Date(status.latestBlockTime))}{" "}
              IST
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-[11px]"
            disabled={!status?.explorerBlockUrl}
            asChild={Boolean(status?.explorerBlockUrl)}
          >
            {status?.explorerBlockUrl ? (
              <a href={status.explorerBlockUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5" />
                Explorer
              </a>
            ) : (
              <span>
                <ExternalLink className="size-3.5" />
                Explorer
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Hash — grouped so it is actually readable */}
      <div className="mt-3 rounded-lg bg-background/70 px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Block hash</p>
            <p
              className={cn(
                "mt-0.5 font-mono text-[11px] break-all text-foreground tabular",
                !expandedHash && "break-words",
              )}
            >
              {hash ? (expandedHash ? groupHash(hash) : shortGroupedHash(hash, 3, 2)) : "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hash ? (
              <>
                <button
                  type="button"
                  onClick={() => setExpandedHash((v) => !v)}
                  className="rounded px-1.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {expandedHash ? "Shorten" : "Show full"}
                </button>
                <button
                  type="button"
                  onClick={() => copy(hash, "Block hash")}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium text-accent hover:text-foreground"
                >
                  {copied === hash ? <Check className="size-3" /> : <Copy className="size-3" />}
                  Copy
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Pinned endpoint — this is the URL that stays put */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 px-3 py-2 text-[11px]">
        <Server className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">RPC</span>
        <span className="font-medium text-foreground">
          {status?.endpoint ? status.endpoint.label : "no endpoint reached"}
        </span>
        {status?.endpoint?.provider ? (
          <span className="text-muted-foreground">· {status.endpoint.provider}</span>
        ) : null}
        {status?.pinned ? (
          <Badge variant="default" className="px-1.5 py-0 text-[9px]">
            pinned by env
          </Badge>
        ) : (
          <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
            sticky
          </Badge>
        )}
        {status?.endpoint ? (
          <button
            type="button"
            onClick={() => copy(status.endpoint!.url, "RPC URL")}
            className="ml-auto inline-flex max-w-full items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
            title={status.endpoint.url}
          >
            <span className="truncate">{status.endpoint.url}</span>
            <Copy className="size-3 shrink-0" />
          </button>
        ) : null}
      </div>

      {/* Plain-language status */}
      <p
        className={cn(
          "mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed",
          state === "live"
            ? "bg-primary/10 text-primary"
            : state === "stale"
              ? "bg-warn/10 text-warn"
              : "bg-secondary/70 text-muted-foreground",
        )}
      >
        {state === "live" ? null : state === "checking" ? (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
        ) : (
          <WifiOff className="mt-0.5 size-3.5 shrink-0" />
        )}
        <span className="min-w-0">
          <span className="font-medium">
            {status?.headline ?? "Reading the public chain…"}
          </span>
          {status?.detail ? <span className="block opacity-90">{status.detail}</span> : null}
          {status && status.reason !== "ok" ? (
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="mt-1 font-mono text-[10px] underline decoration-dotted opacity-70 hover:opacity-100"
            >
              {showDebug ? "hide detail" : `why? (${REASON_LABEL[status.reason]})`}
            </button>
          ) : null}
          {showDebug && status ? (
            <span className="mt-1 block font-mono text-[10px] leading-relaxed opacity-80">
              reason: {status.reason}
              {status.error ? ` · ${status.error}` : ""}
              {status.endpointsTried.length
                ? ` · tried: ${status.endpointsTried.join(" → ")}`
                : ""}
            </span>
          ) : null}
        </span>
      </p>

      {/* Controls */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-[11px]"
          onClick={() => {
            setPaused((v) => !v);
            lastAutoAt.current = Date.now();
          }}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {paused ? "Resume auto-refresh" : "Pause auto-refresh"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-[11px]"
          disabled={loading}
          onClick={() => {
            lastAutoAt.current = Date.now();
            setNextIn(REFRESH_MS);
            onRefresh({ force: true });
          }}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh now
        </Button>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular">
          {paused ? "paused — values frozen" : `next read in ${Math.ceil(nextIn / 1000)}s`}
        </span>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
        Read-only bridge to a public chain — the integration point where a deployed EnergyPool
        contract would broadcast these blocks. Pin one provider with{" "}
        <code className="font-mono text-[10px] text-foreground">SOLARSHARE_RPC_URL</code>.
      </p>
    </section>
  );
}
