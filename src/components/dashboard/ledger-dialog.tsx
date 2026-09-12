import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  ChevronUp,
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
import {
  absorbBlocks,
  drainPending,
  emptyLedgerFeed,
  MAX_LEDGER_ROWS,
  type LedgerFeed,
} from "@/lib/solar/ledger-feed";
import { groupHash, shortGroupedHash } from "@/lib/solar/network-core";
import type { BlockDetail, ChainVerification, TestnetStatus } from "@/lib/solar/types";
import { useSolarActions } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";
import { NetworkPanel } from "./network-panel";

/** Blocks list refresh cadence while the dialog is open (pausable). */
const BLOCKS_POLL_MS = 12_000;
/** A held block is released this often — the chain grows one block at a time. */
const BLOCK_STEP_MS = 240;
const MAX_ROWS = MAX_LEDGER_ROWS;

/**
 * Anchoring the scroll position is only meaningful in the browser, and this
 * dialog is server-rendered along with the route it lives on.
 */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Energy ledger dialog.
 *
 * The list is a *live* one: other members keep minting blocks while you read.
 * It used to reload wholesale on every poll — every row re-rendered and
 * re-animated at once, an opened block collapsed, the position you had
 * scrolled to jumped, and the whole dialog hammered the chain + the public RPC
 * on every render. Now:
 *
 *  - polls are silent and *incremental* (`absorbBlocks`) — unchanged rows are
 *    kept by identity so their DOM is never touched,
 *  - a genuinely new block is not spliced into the list: it waits in a queue
 *    and lands **one at a time** (`drainPending`), so the list grows instead of
 *    swapping,
 *  - if you are mid-read (a block opened, or you have scrolled away from the
 *    top) arrivals are held and offered as "N new blocks · add one",
 *  - rows inserted above your eyes are compensated by scrolling, so nothing
 *    shifts under you,
 *  - a failed read keeps the last known ledger instead of blanking it.
 */
export function LedgerDialog() {
  const open = useMarket((s) => s.ledgerOpen);
  const setOpen = useMarket((s) => s.setLedgerOpen);
  const { verifyChain, testnet } = useSolarActions();
  const [feed, setFeed] = useState<LedgerFeed>(emptyLedgerFeed);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [testnetStatus, setTestnetStatus] = useState<TestnetStatus | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksPaused, setBlocksPaused] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const mounted = useRef(true);
  const scroller = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const listHeight = useRef(0);
  /** Block numbers as they were on the previous commit, to spot top insertions. */
  const shownBefore = useRef<number[]>([]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Reading the chain right now? Then nothing may move underneath. */
  const reading = expanded !== null || scrolled;

  /**
   * Read the chain and fold it into the feed. `setFeed` bails out when the
   * merge reports no change, so a poll that learned nothing renders nothing.
   */
  const pullBlocks = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setBlocksLoading(true);
    try {
      const next = await solarRecentBlocks();
      if (mounted.current && Array.isArray(next)) {
        setFeed((cur) => absorbBlocks(cur, next, { maxRows: MAX_ROWS, now: Date.now() }).feed);
      }
    } catch {
      /* signed out or backend hiccup — keep the last known ledger on screen */
    } finally {
      if (mounted.current) setBlocksLoading(false);
    }
  }, []);

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

  /** Release one held block into the list. */
  const releaseOne = useCallback(() => {
    setFeed((cur) => drainPending(cur, { count: 1, maxRows: MAX_ROWS, now: Date.now() }).feed);
  }, []);

  /** Release everything the queue is holding. */
  const releaseAll = useCallback(() => {
    setFeed((cur) =>
      drainPending(cur, { count: cur.pending.length || 1, maxRows: MAX_ROWS, now: Date.now() }).feed,
    );
  }, []);

  // Latest callbacks, read at call time — so the effects below depend on `open`
  // alone and can never re-arm themselves on a render.
  const pull = useRef(pullBlocks);
  const network = useRef(refreshNetwork);
  useEffect(() => {
    pull.current = pullBlocks;
    network.current = refreshNetwork;
  });

  // One catch-up read per open. `testnet` stays on its cached reading here —
  // only the panel's own "Refresh now" bypasses that cache.
  useEffect(() => {
    if (!open) return;
    setExpanded(null);
    setScrolled(false);
    setVerification(null);
    listHeight.current = 0;
    shownBefore.current = [];
    void pull.current();
    void network.current();
  }, [open]);

  // Keep the list current while the dialog is open — pausable, and quiet while
  // the tab is hidden. Updates land through the queue, never as a full reload.
  useEffect(() => {
    if (!open || blocksPaused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void pull.current({ silent: true });
    }, BLOCKS_POLL_MS);
    return () => window.clearInterval(id);
  }, [open, blocksPaused]);

  // …and let held blocks in one by one, but never while a row is open or the
  // member has scrolled away from the top (they can add them by hand instead).
  useEffect(() => {
    if (!open || blocksPaused || reading || feed.pending.length === 0) return;
    const id = window.setTimeout(releaseOne, BLOCK_STEP_MS);
    return () => window.clearTimeout(id);
  }, [open, blocksPaused, reading, feed.pending, releaseOne]);

  // Scroll anchoring: rows are inserted at the top of the list, so a reader who
  // is part-way down would otherwise have everything they are looking at pushed
  // down by exactly the height of what landed. Put it back.
  useBrowserLayoutEffect(() => {
    const el = scroller.current;
    const ul = list.current;
    if (!el || !ul) return;
    const nos = feed.blocks.map((b) => b.blockNo);
    const was = shownBefore.current;
    shownBefore.current = nos;
    const height = ul.scrollHeight;
    const delta = height - listHeight.current;
    listHeight.current = height;
    if (was.length === 0 || delta <= 0) return;
    // Rows arrive at the newest end, i.e. at the *top* of the rendered list.
    const lastSeenAt = nos.indexOf(was[was.length - 1]);
    const landedAbove = lastSeenAt < 0 ? 0 : nos.length - 1 - lastSeenAt;
    if (landedAbove > 0 && el.scrollTop > 0) el.scrollTop += delta;
  }, [feed.blocks]);

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

  const copy = useCallback((hash: string, what = "Hash") => {
    void navigator.clipboard.writeText(hash);
    setCopied(hash);
    toast.success(`${what} copied`);
    window.setTimeout(() => setCopied((c) => (c === hash ? null : c)), 1200);
  }, []);

  const toggleRow = useCallback((blockNo: number) => {
    setExpanded((cur) => (cur === blockNo ? null : blockNo));
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrolled(e.currentTarget.scrollTop > 8);
  }, []);

  /** Held blocks are released on a timer — no need for the pill while that runs. */
  const releasing = open && !blocksPaused && !reading;
  const holdWhy = blocksPaused
    ? "the feed is paused"
    : "held back so your place in the list does not move";

  const blocks = feed.blocks;
  /** Newest visible row — the head as this list shows it. */
  const head = blocks.length > 0 ? blocks[blocks.length - 1] : null;
  /** The UI reads newest-first; only rebuilt when the list itself changed. */
  const visible = useMemo(() => [...blocks].reverse(), [blocks]);
  const held = feed.pending.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        ref={scroller}
        onScroll={onScroll}
        className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
      >
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
                {blocks.length} shown{held > 0 ? ` · ${held} waiting` : ""}
                {held > 0 && releasing ? " — adding one at a time" : ""}
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
                  onClick={() => void pullBlocks()}
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

            {/* Arrivals that are waiting for their turn — add them at your own pace. */}
            {held > 0 && !releasing ? (
              <div
                className="mb-2 flex items-center gap-2 rounded-lg border border-primary/35 bg-primary/5 px-3 py-1.5"
                role="status"
                aria-live="polite"
              >
                <ChevronUp className="size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-[11px] text-foreground">
                  {held} newer {held === 1 ? "block" : "blocks"} on the chain — {holdWhy}.
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 shrink-0 px-2 text-[11px]"
                  onClick={releaseOne}
                >
                  Add one
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 shrink-0 px-2 text-[11px]"
                  onClick={releaseAll}
                >
                  Add all
                </Button>
              </div>
            ) : null}

            <ul ref={list} className="space-y-2">
              {visible.map((b) => (
                <LedgerBlockRow
                  key={b.blockNo}
                  block={b}
                  isOpen={expanded === b.blockNo}
                  copied={copied === b.blockHash}
                  onToggle={toggleRow}
                  onCopy={copy}
                />
              ))}
              {blocks.length === 0 && blocksLoading ? (
                <li className="space-y-2" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl border border-border/50 bg-secondary/40"
                    />
                  ))}
                </li>
              ) : null}
              {blocks.length === 0 && !blocksLoading ? (
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

/**
 * One block. Memoised, and given a row object that only changes when that block
 * changed — so a poll that brought a new head re-renders exactly one row. The
 * enter animation is on the element itself, so it plays once, when the block
 * first mounts, and never again while it sits in the list.
 */
const LedgerBlockRow = memo(function LedgerBlockRow({
  block: b,
  isOpen,
  copied,
  onToggle,
  onCopy,
}: {
  block: BlockDetail;
  isOpen: boolean;
  copied: boolean;
  onToggle: (blockNo: number) => void;
  onCopy: (hash: string, what?: string) => void;
}) {
  return (
    <li className="block-land rounded-xl border border-border/60 bg-background p-3">
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
          onClick={() => onToggle(b.blockNo)}
          className="shrink-0 text-[10px] font-medium text-accent hover:text-foreground"
        >
          {isOpen ? "shorten" : "read"}
        </button>
        <button
          type="button"
          onClick={() => onCopy(b.blockHash, "Block hash")}
          className="shrink-0 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {b.txs.map((t) => (
        <p key={t.txHash} className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]">
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
            <span className="font-mono text-primary tabular">{formatInr(t.amountInr, 2)}</span>
          )}
        </p>
      ))}
    </li>
  );
});

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
