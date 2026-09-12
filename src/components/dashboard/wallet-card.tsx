import { useState } from "react";
import { Banknote, Loader2, Sun, Wallet as WalletIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatInr, formatKwh } from "@/lib/format";
import { useSolarActions, useSolarState } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";

/**
 * Member wallet — profile-based (no roles). Two primary options:
 *   1. Buy energy  (spend INR, receive kWh)
 *   2. Sell energy (spend solar surplus, receive INR)
 * plus top-up / withdraw to move money with the bank (each mints a ledger block).
 */
export function WalletCard() {
  const { user, profile, wallet, loading, goSignIn } = useSolarState();
  const actions = useSolarActions();
  const [fundOpen, setFundOpen] = useState<"topup" | "withdraw" | null>(null);
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);

  const panelKw = profile?.panelKwp ?? 3;

  function focusTrade(action: "buy" | "sell") {
    // Switch the trade panel to the matching option and scroll it into view.
    window.dispatchEvent(new CustomEvent("solarshare:trade-action", { detail: action }));
    document.getElementById("trade-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function doFund() {
    if (!amount || amount <= 0) return;
    setBusy(true);
    const ok =
      fundOpen === "topup" ? await actions.topUp(amount) : await actions.withdraw(amount);
    setBusy(false);
    if (ok) {
      setFundOpen(null);
      setAmount(100);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <WalletIcon className="size-4 text-primary" />
            My wallet
          </CardTitle>
          <CardDescription>
            {user
              ? `${profile?.fullName ?? user.displayName} · ${panelKw.toFixed(1)} kWp rooftop`
              : "Open a wallet with your profile"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-2">
        {loading && user ? (
          <div className="space-y-2">
            <div className="h-10 w-2/3 animate-pulse rounded-lg bg-secondary" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-secondary" />
          </div>
        ) : user && wallet ? (
          <>
            <div className="rounded-xl bg-gradient-to-br from-primary/12 via-transparent to-accent/10 p-4">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">INR balance</p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight tabular">
                {formatInr(wallet.inr, 2)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-background/70 px-2.5 py-2">
                  <p className="text-muted-foreground">kWh on hand</p>
                  <p className="font-mono text-sm text-accent tabular">{wallet.kwhCredits.toFixed(1)}</p>
                </div>
                <div className="rounded-lg bg-background/70 px-2.5 py-2">
                  <p className="text-muted-foreground">Surplus to sell</p>
                  <p className="font-mono text-sm text-primary tabular">{wallet.surplusKwh.toFixed(1)} kWh</p>
                </div>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sun className={cn("size-3.5", wallet.generatingKw > 0.05 ? "text-primary" : "text-muted-foreground/50")} />
              {wallet.generatingKw > 0.05
                ? `Roof generating ${wallet.generatingKw.toFixed(2)} kW — surplus accrues automatically`
                : "Night / low sun — sell stored surplus or buy from neighbours"}
            </p>

            {/* The two options */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="accent" className="gap-2" onClick={() => focusTrade("buy")}>
                <Zap className="size-4" />
                Buy energy
              </Button>
              <Button variant="default" className="gap-2" onClick={() => focusTrade("sell")}>
                <Sun className="size-4" />
                Sell energy
              </Button>
            </div>

            <div className="mt-auto space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Earned <span className="font-mono text-foreground tabular">{formatInr(wallet.totalEarnedInr, 0)}</span> ·
                  Sold <span className="font-mono text-foreground tabular">{wallet.totalSoldKwh.toFixed(1)} kWh</span>
                </span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setFundOpen(fundOpen === "topup" ? null : "topup")}
                  >
                    Top up
                  </button>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setFundOpen(fundOpen === "withdraw" ? null : "withdraw")}
                  >
                    Withdraw
                  </button>
                </span>
              </div>

              {fundOpen ? (
                <div className="flex items-center gap-2 rounded-lg bg-background p-2">
                  <Banknote className="size-4 shrink-0 text-primary" />
                  <Input
                    type="number"
                    min={1}
                    step={50}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="h-8 font-mono tabular"
                    aria-label="Amount in rupees"
                  />
                  <span className="text-xs text-muted-foreground">₹</span>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void doFund()}
                    className="h-8 shrink-0"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : fundOpen === "topup" ? "Add" : "Send"}
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <WalletIcon className="size-6 text-primary" />
            </span>
            <p className="max-w-52 text-xs leading-relaxed text-muted-foreground">
              Create a free profile to open your wallet — start with{" "}
              <span className="text-foreground">₹500 credit</span>, then buy and sell
              kWh with your neighbours.
            </p>
            <a href="/login">
              <Button size="sm" className="gap-2">
                Create profile
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
