import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Hash,
  Link2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInr } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import { solarRecentBlocks } from "@/lib/solar/api";
import { groupHash, shortGroupedHash } from "@/lib/solar/network-core";
import type { BlockDetail, ChainVerification, TestnetStatus } from "@/lib/solar/types";
import { useSolarActions } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";
import { NetworkPanel } from "./network-panel";

/** Blocks list refresh cadence while the dialog is open (pausable). */
const BLOCKS_REFRESH_MS = 10_000;

export function LedgerDialog() {
  const open = useMarket((s) => s.ledgerOpen);
  const setOpen = useMarket((s) => s.setLedgerOpen);
  const { verifyChain, testnet } = useSolarActions();
  const [blocks, setBlocks] = useState<BlockDetail[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [testnetStatus, setTestnetStatus] = useState<TestnetStatus | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksPaused, setBlocksPaused] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setBlocksLoading(true);
      try {
        const next = await solarRecentBlocks();
        if (mounted.current) setBlocks(next);
      } catch {
        /* signed out or backend hiccup — keep last state */
      } finally {
        if (mounted.current) setBlocksLoading(false);
      }
    },
    [],
  );

  const refreshNetwork = useCallback(
    async (opts?: { force?: boolean }) => {
      setNetworkLoading(true);
      try {
        const status = await testnet(opts?.force);
        if (mounted.current) setTestnetStatus(status);
      } catch {
        if (mounted.current) setTestnetStatus(null);
      } finally {
        if (mounted.current) setNetworkLoading(false);
      }
    },
    [testnet],
  );

  useEffect(() => {
    if (!open) return;
    setVerification(null);
    setExpanded(null);
    void refresh();
    void refreshNetwork({ force: true });
  }, [open, refresh, refreshNetwork]);

  // Keep the block list current while the dialog is open — pausable so a row you
  // are reading does not shift underneath you.
  useEffect(() => {
    if (!open || blocksPaused) return;
    const id = window.setInterval(() => void refresh({ silent: true }), BLOCKS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [open, blocksPaused, refresh]);

  async function onVerify() {
    setVerifying(true);
    try {
      const result = await verifyChain();
      if (!result) return;
      setVerification(result);
      if (result.ok) {
        toast.success(`Chain verified — ${result.blocksChecked} blocks, no tampering`);
      } else {
        toast.error(`Ledger problem at block ${result.firstBad?.blockNo ?? "?"}`);
      }
    } finally {
      setVerifying(false);
    }
  }

  function copy(hash: string, what = "Hash") {
    void navigator.clipboard.writeText(hash);
    setCopied(hash);
    toast.success(`${what} copied`);
    window.setTimeout(() => setCopied((c) => (c === hash ? null : c)), 1200);
  }

  const head = blocks[blocks.length - 1] ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Energy ledger</DialogTitle>
          <DialogDescription>
            Every member settlement is a hash-chained block stored in Postgres. Verify recomputes
            the whole chain from genesis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chain status */}
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Chain head
                </p>
                <p className="font-mono text-lg text-foreground tabular">
                  {head ? `#${head.blockNo.toLocaleString("en-IN")}` : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Latest hash
                </p>
                <button
                  type="button"
                  onClick={() => head && copy(head.blockHash, "Block hash")}
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-primary tabular hover:underline"
                  title={head?.blockHash}
                >
                  {head ? shortGroupedHash(head.blockHash, 2, 2) : "—"}
                  <Copy className={cn("size-3", copied === head?.blockHash && "text-foreground")} />
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Prev link
                </p>
                <p
                  className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground tabular"
                  title={head?.prevHash}
                >
                  <Link2 className="size-3" />
                  {head ? shortGroupedHash(head.prevHash, 2, 1) : "—"}
                </p>
              </div>
              <Button
                size="sm"
                className="ml-auto gap-2"
                disabled={verifying}
                onClick={() => void onVerify()}
              >
                {verifying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : verification?.ok ? (
                  <ShieldCheck className="size-4 text-primary" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {verifying ? "Verifying…" : "Verify chain"}
              </Button>
            </div>

            {head ? (
              <p className="mt-2 font-mono text-[10px] break-all text-muted-foreground/80 tabular">
                {groupHash(head.blockHash)}
              </p>
            ) : null}

            {verification ? (
              <p
                className={cn(
                  "mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                  verification.ok
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {verification.ok ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
                {verification.ok
                  ? `Verified ${verification.blocksChecked} blocks from genesis — hashes and links intact.`
                  : `Corruption at block ${verification.firstBad?.blockNo}: ${verification.firstBad?.reason} (expected …${verification.firstBad?.expected.slice(-8)}, got …${verification.firstBad?.actual.slice(-8)})`}
              </p>
            ) : null}
          </div>

          {/* Public chain bridge — pinned endpoint, readable status */}
          <NetworkPanel status={testnetStatus} loading={networkLoading} onRefresh={refreshNetwork} />

          {/* Recent blocks */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Recent blocks
              </p>
              <span className="font-mono text-[10px] text-muted-foreground/70 tabular">
                {blocks.length} shown
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-[11px]"
                  onClick={() => setBlocksPaused((v) => !v)}
                >
                  {blocksPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                  {blocksPaused ? "Resume" : "Pause"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-[11px]"
                  disabled={blocksLoading}
                  onClick={() => void refresh()}
                >
                  {blocksLoading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
            <ul className="space-y-2">
              {[...blocks].reverse().map((b) => {
                const isOpen = expanded === b.blockNo;
                return (
                  <li
                    key={b.blockNo}
                    className="rounded-xl border border-border/60 bg-background p-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-foreground tabular">
                        <Hash className="size-3 text-primary" />#
                        {b.blockNo.toLocaleString("en-IN")}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground tabular">
                        {b.timestamp.slice(11, 19)} UTC · {b.txCount} tx
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular">
                        {b.totalKwh > 0 ? `${b.totalKwh.toFixed(1)} kWh · ` : ""}
                        {b.totalInr > 0 ? formatInr(b.totalInr, 0) : "chain ops"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-start gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 font-mono text-[10px] text-muted-foreground/80 tabular",
                          isOpen ? "break-all" : "truncate",
                        )}
                      >
                        {isOpen ? groupHash(b.blockHash) : b.blockHash}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : b.blockNo)}
                        className="shrink-0 text-[10px] font-medium text-accent hover:text-foreground"
                      >
                        {isOpen ? "shorten" : "read"}
                      </button>
                      <button
                        type="button"
                        onClick={() => copy(b.blockHash, "Block hash")}
                        className="shrink-0 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        {copied === b.blockHash ? "copied" : "copy"}
                      </button>
                    </div>
                    {b.txs.map((t) => (
                      <p
                        key={t.txHash}
                        className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]"
                      >
                        <KindTag kind={t.kind} />
                        <span className="text-foreground">{t.fromName}</span>
                        <span className="text-muted-foreground">
                          {t.kind === "topup"
                            ? "→ topped up"
                            : t.kind === "withdraw"
                              ? "→ withdrew"
                              : t.kind === "listing"
                                ? "→ listed"
                                : "→"}
                        </span>
                        <span className="text-foreground">{t.toName}</span>
                        {t.kwh > 0 ? (
                          <span className="font-mono text-primary tabular">
                            {t.kwh.toFixed(1)} kWh @ {formatInr(t.priceInr, 2)}
                          </span>
                        ) : (
                          <span className="font-mono text-primary tabular">
                            {formatInr(t.amountInr, 2)}
                          </span>
                        )}
                      </p>
                    ))}
                  </li>
                );
              })}
              {blocks.length === 0 ? (
                <li className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                  Blocks appear here as members settle trades. Genesis is block 0.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KindTag({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    trade: { label: "TRADE", cls: "bg-primary/15 text-primary" },
    topup: { label: "TOP-UP", cls: "bg-accent/15 text-accent" },
    withdraw: { label: "WITHDRAW", cls: "bg-warn/15 text-warn" },
    listing: { label: "LISTING", cls: "bg-secondary text-muted-foreground" },
  };
  const m = map[kind] ?? map.listing;
  return (
    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[9px] font-medium", m.cls)}>
      {m.label}
    </span>
  );
}
