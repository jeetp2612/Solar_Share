import { useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  ReceiptText,
  Smartphone,
  Sun,
  Wallet as WalletIcon,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatInr, maskUpiId } from "@/lib/format";
import { useSolarActions, useSolarState } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";

/**
 * Member wallet — profile-based (no roles). Two primary options:
 *   1. Buy energy  (spend INR, receive kWh)
 *   2. Sell energy (spend solar surplus, receive INR)
 * plus UPI top-up / withdrawal rails (each payment is stored in SQL and linked
 * to the hash-chained ledger block that moved the wallet balance).
 */
export function WalletCard() {
  const { user, profile, wallet, loading, paymentMethods, recentPayments } = useSolarState();
  const actions = useSolarActions();
  const [fundOpen, setFundOpen] = useState<"topup" | "withdraw" | null>(null);
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [upiLabel, setUpiLabel] = useState("Primary UPI");
  const [upiId, setUpiId] = useState("");
  const [holderName, setHolderName] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const panelKw = profile?.panelKwp ?? 3;
  const defaultPayment = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0] ?? null;
  const selectedPayment = paymentMethods.find((m) => m.id === selectedMethodId) ?? defaultPayment;
  const latestPayment = recentPayments[0] ?? null;
  const hasSavedUpi = paymentMethods.length > 0;

  useEffect(() => {
    if (!paymentMethods.length) {
      setSelectedMethodId(null);
      return;
    }
    if (!selectedMethodId || !paymentMethods.some((m) => m.id === selectedMethodId)) {
      setSelectedMethodId(defaultPayment?.id ?? paymentMethods[0]?.id ?? null);
    }
  }, [defaultPayment?.id, paymentMethods, selectedMethodId]);

  function focusTrade(action: "buy" | "sell") {
    // Switch the trade panel to the matching option and scroll it into view.
    window.dispatchEvent(new CustomEvent("solarshare:trade-action", { detail: action }));
    document
      .getElementById("trade-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function savePaymentMethod() {
    if (!upiId.trim()) return;
    setSavingPayment(true);
    const method = await actions.addPaymentMethod({
      upiId,
      label: upiLabel,
      holderName: holderName || profile?.fullName || undefined,
    });
    setSavingPayment(false);
    if (method) {
      setSelectedMethodId(method.id);
      setPaymentOpen(false);
      setUpiId("");
      setUpiLabel("Primary UPI");
      setHolderName("");
    }
  }

  async function choosePaymentMethod(methodId: string) {
    setSelectedMethodId(methodId);
    await actions.setDefaultPaymentMethod(methodId);
  }

  async function doFund() {
    if (!amount || amount <= 0) return;
    if (fundOpen === "withdraw" && !selectedPayment) {
      setPaymentOpen(true);
      return;
    }
    setBusy(true);
    const ok =
      fundOpen === "topup"
        ? await actions.topUp(amount, selectedPayment?.id)
        : await actions.withdraw(amount, selectedPayment?.id);
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
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                INR balance
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight tabular">
                {formatInr(wallet.inr, 2)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-background/70 px-2.5 py-2">
                  <p className="text-muted-foreground">kWh on hand</p>
                  <p className="font-mono text-sm text-accent tabular">
                    {wallet.kwhCredits.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg bg-background/70 px-2.5 py-2">
                  <p className="text-muted-foreground">Surplus to sell</p>
                  <p className="font-mono text-sm text-primary tabular">
                    {wallet.surplusKwh.toFixed(1)} kWh
                  </p>
                </div>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sun
                className={cn(
                  "size-3.5",
                  wallet.generatingKw > 0.05 ? "text-primary" : "text-muted-foreground/50",
                )}
              />
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

            <div className="rounded-xl border border-border/70 bg-background/80 p-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="size-4 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-foreground">UPI payment method</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {selectedPayment
                          ? `${selectedPayment.label} · ${maskUpiId(selectedPayment.upiId)}`
                          : "Save a UPI ID for top-ups and withdrawals"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                      onClick={() => setPaymentOpen((v) => !v)}
                    >
                      {paymentOpen ? "Close" : hasSavedUpi ? "Add another" : "Add UPI"}
                    </button>
                  </div>

                  {paymentMethods.length ? (
                    <div className="mt-2 grid gap-1.5">
                      {paymentMethods.map((method) => {
                        const active = method.id === selectedPayment?.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => void choosePaymentMethod(method.id)}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                              active
                                ? "border-primary/50 bg-primary/10 text-foreground"
                                : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium">
                                {method.label}
                              </span>
                              <span className="block truncate font-mono text-[11px] tabular">
                                {maskUpiId(method.upiId)}
                              </span>
                            </span>
                            {active ? (
                              <CheckCircle2 className="size-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {paymentOpen ? (
                    <div className="mt-2 space-y-2 rounded-lg bg-card/70 p-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-muted-foreground">
                          Label
                          <Input
                            value={upiLabel}
                            onChange={(e) => setUpiLabel(e.target.value)}
                            placeholder="Primary UPI"
                            className="mt-1 h-8"
                          />
                        </label>
                        <label className="text-[11px] text-muted-foreground">
                          Holder name
                          <Input
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            placeholder={profile?.fullName ?? "Account holder"}
                            className="mt-1 h-8"
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="name@upi"
                          className="h-8 font-mono text-xs tabular"
                          aria-label="UPI ID"
                        />
                        <Button
                          size="sm"
                          disabled={savingPayment || !upiId.trim()}
                          onClick={() => void savePaymentMethod()}
                          className="h-8 shrink-0 gap-1.5"
                        >
                          {savingPayment ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                    UPI funding records are saved in SQL and linked to the same ledger block as the
                    wallet balance change.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Earned{" "}
                  <span className="font-mono text-foreground tabular">
                    {formatInr(wallet.totalEarnedInr, 0)}
                  </span>{" "}
                  · Sold{" "}
                  <span className="font-mono text-foreground tabular">
                    {wallet.totalSoldKwh.toFixed(1)} kWh
                  </span>
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
                <div className="space-y-1.5 rounded-lg bg-background p-2">
                  <div className="flex gap-1.5">
                    {[100, 250, 500, 1000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(v)}
                        className={cn(
                          "flex-1 rounded-md border px-1 py-1 font-mono text-[11px] tabular transition-colors",
                          amount === v
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        ₹{v}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
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
                      disabled={busy || (fundOpen === "withdraw" && !selectedPayment)}
                      onClick={() => void doFund()}
                      className="h-8 shrink-0"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : fundOpen === "topup" ? (
                        "Add"
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card/70 px-2.5 py-2 text-[11px] text-muted-foreground">
                    <CreditCard className="size-3.5 shrink-0 text-accent" />
                    <span className="shrink-0">
                      {fundOpen === "topup" ? "Pay from" : "Send to"}
                    </span>
                    {selectedPayment ? (
                      <span className="truncate font-mono text-foreground tabular">
                        {selectedPayment.label} · {maskUpiId(selectedPayment.upiId)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => setPaymentOpen(true)}
                      >
                        Save UPI first
                      </button>
                    )}
                  </div>
                  {fundOpen === "topup" && !selectedPayment ? (
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      No UPI saved yet — this demo can still credit via the virtual UPI rail, but
                      add your UPI ID to store a real method.
                    </p>
                  ) : null}
                  {fundOpen === "withdraw" && !selectedPayment ? (
                    <p className="text-[10px] leading-relaxed text-destructive">
                      Add a UPI ID first so withdrawals have a payout destination.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {latestPayment ? (
                <div className="flex items-start gap-2 rounded-lg bg-background px-2.5 py-2 text-[11px] text-muted-foreground">
                  <ReceiptText className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <p className="min-w-0 flex-1 truncate">
                    Last UPI {latestPayment.direction === "topup" ? "top-up" : "withdrawal"}:{" "}
                    <span className="font-mono text-foreground tabular">
                      {formatInr(latestPayment.amountInr, 0)}
                    </span>{" "}
                    · ref{" "}
                    <span className="font-mono text-foreground tabular">
                      {latestPayment.providerRef}
                    </span>
                  </p>
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
              <span className="text-foreground">₹500 credit</span>, then buy and sell kWh with your
              neighbours.
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
