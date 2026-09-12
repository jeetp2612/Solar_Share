import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Globe2,
  Hash,
  Link2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
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
import type { BlockDetail, ChainVerification, TestnetStatus } from "@/lib/solar/types";
import { useSolarActions } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";

const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export function LedgerDialog() {
  const open = useMarket((s) => s.ledgerOpen);
  const setOpen = useMarket((s) => s.setLedgerOpen);
  const { verifyChain, testnet } = useSolarActions();
  const [blocks, setBlocks] = useState<BlockDetail[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [testnetStatus, setTestnetStatus] = useState<TestnetStatus | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBlocks(await solarRecentBlocks());
    } catch {
      /* signed out or backend hiccup — keep last state */
    }
  }, []);

  useEffect(() => {
    if (open) {
      setVerification(null);
      void refresh();
      void (async () => {
        try {
          setTestnetStatus(await testnet());
        } catch {
          setTestnetStatus(null);
        }
      })();
    }
  }, [open, refresh, testnet]);

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

  function copy(hash: string) {
    void navigator.clipboard.writeText(hash);
    setCopied(hash);
    toast.success("Hash copied");
    window.setTimeout(() => setCopied((c) => (c === hash ? null : c)), 1200);
  }

  const head = blocks[blocks.length - 1] ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Energy ledger</DialogTitle>
          <DialogDescription>
            Every member settlement is a hash-chained block stored in Postgres.
            Verify recomputes the whole chain from genesis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chain status */}
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Chain head</p>
                <p className="font-mono text-lg tabular text-foreground">
                  {head ? `#${head.blockNo.toLocaleString("en-IN")}` : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Latest hash</p>
                <button
                  type="button"
                  onClick={() => head && copy(head.blockHash)}
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-primary tabular hover:underline"
                >
                  {head ? shortHash(head.blockHash) : "—"}
                  <Copy className={cn("size-3", copied === head?.blockHash && "text-foreground")} />
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Prev link</p>
                <p className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground tabular">
                  <Link2 className="size-3" />
                  {head ? shortHash(head.prevHash) : "—"}
                </p>
              </div>
              <Button size="sm" className="ml-auto gap-2" disabled={verifying} onClick={() => void onVerify()}>
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

          {/* Testnet bridge */}
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="flex items-center gap-2 text-[11px] tracking-wide text-muted-foreground uppercase">
              <Globe2 className="size-3.5" />
              Testnet bridge · Polygon Sepolia
            </p>
            {testnetStatus?.online ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-mono text-foreground tabular">block {testnetStatus.blockNumber?.toLocaleString("en-IN")}</span>
                {testnetStatus.peerCount != null ? ` · ${testnetStatus.peerCount} peers` : ""} ·{" "}
                <span className="font-mono">{testnetStatus.latestBlockHash ? shortHash(testnetStatus.latestBlockHash) : "—"}</span>
                <span className="ml-1 text-primary">live</span>
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <WifiOff className="size-3.5" />
                {testnetStatus?.error ? "Public RPC unreachable from here — " : "Checking… "}
                <span>embedded ledger is active regardless.</span>
              </p>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
              Read-only bridge to the public chain — the integration point where a
              deployed EnergyPool contract would broadcast these blocks.
            </p>
          </div>

          {/* Recent blocks */}
          <div>
            <p className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">Recent blocks</p>
            <ul className="space-y-2">
              {[...blocks].reverse().map((b) => (
                <li key={b.blockNo} className="rounded-xl border border-border/60 bg-background p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-foreground tabular">
                      <Hash className="size-3 text-primary" />#{b.blockNo.toLocaleString("en-IN")}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular">
                      {b.timestamp.slice(11, 19)} UTC · {b.txCount} tx
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular">
                      {b.totalKwh > 0 ? `${b.totalKwh.toFixed(1)} kWh · ` : ""}
                      {b.totalInr > 0 ? formatInr(b.totalInr, 0) : "chain ops"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/80 tabular">
                    {b.blockHash}
                  </p>
                  {b.txs.map((t) => (
                    <p key={t.txHash} className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                      <KindTag kind={t.kind} />
                      <span className="text-foreground">{t.fromName}</span>
                      <span className="text-muted-foreground">
                        {t.kind === "topup" ? "→ topped up" : t.kind === "withdraw" ? "→ withdrew" : t.kind === "listing" ? "→ listed" : "→"}
                      </span>
                      <span className="text-foreground">{t.toName}</span>
                      {t.kwh > 0 ? (
                        <span className="font-mono text-primary tabular">{t.kwh.toFixed(1)} kWh @ {formatInr(t.priceInr, 2)}</span>
                      ) : (
                        <span className="font-mono text-primary tabular">{formatInr(t.amountInr, 2)}</span>
                      )}
                    </p>
                  ))}
                </li>
              ))}
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
    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[9px] font-medium", m.cls)}>{m.label}</span>
  );
}
