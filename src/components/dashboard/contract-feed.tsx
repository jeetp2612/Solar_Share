import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClock, formatInr, shortAddr } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import { cn } from "@/lib/utils";

export function ContractFeed() {
  const txs = useMarket((s) => s.txs);
  const [copied, setCopied] = useState<string | null>(null);

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
          <CardTitle>Trade feed</CardTitle>
          <CardDescription>Settlements on the feeder — member trades are on-chain.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {txs.map((tx) => (
            <li
              key={tx.id}
              className={cn(
                "rounded-xl px-3 py-2.5",
                tx.fresh ? "row-fresh bg-secondary/40" : "bg-background",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm leading-snug">
                  <span className="text-foreground">{tx.fromName}</span>
                  <span className="text-muted-foreground"> sold </span>
                  <span className="font-mono tabular text-primary">{tx.kwh.toFixed(1)} kWh</span>
                  <span className="text-muted-foreground"> to </span>
                  <span className="text-foreground">{tx.toName}</span>
                </p>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular">
                  {formatClock(tx.timestamp)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="font-mono tabular">{formatInr(tx.price, 2)}/kWh</span>
                <span className="font-mono">{tx.block != null ? `blk ${tx.block.toLocaleString("en-IN")}` : "local"}</span>
                <button
                  type="button"
                  onClick={() => copyHash(tx.txHash)}
                  className="inline-flex items-center gap-1 font-mono text-accent hover:text-foreground"
                >
                  {copied === tx.txHash ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {shortAddr(tx.txHash)}
                </button>
                <span
                  className={cn(
                    "ml-auto inline-flex items-center gap-1",
                    tx.status === "confirmed" ? "text-primary" : "text-warn",
                  )}
                >
                  {tx.status === "confirmed" ? "Confirmed" : "Pending"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
