import { useState } from "react";
import { Link2, QrCode, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMarket } from "@/lib/market-store";
import type { WalletProvider } from "@/lib/market-data";
import { cn } from "@/lib/utils";

const PROVIDERS: {
  id: WalletProvider;
  label: string;
  hint: string;
  icon: typeof Wallet;
}[] = [
  { id: "injected", label: "Browser wallet", hint: "MetaMask, Rabby, Brave", icon: Wallet },
  { id: "walletconnect", label: "WalletConnect", hint: "Scan with any mobile wallet", icon: QrCode },
  { id: "coinbase", label: "Coinbase Wallet", hint: "Smart wallet or extension", icon: Link2 },
];

export function WalletDialog() {
  const open = useMarket((s) => s.connectOpen);
  const openConnect = useMarket((s) => s.openConnect);
  const connectWallet = useMarket((s) => s.connectWallet);
  const [busy, setBusy] = useState<WalletProvider | null>(null);

  async function onPick(id: WalletProvider) {
    setBusy(id);
    await connectWallet(id);
    setBusy(null);
  }

  return (
    <Dialog open={open} onOpenChange={openConnect}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect wallet</DialogTitle>
          <DialogDescription>
            Sign in to the Eastside microgrid to trade surplus solar. Demo wallets settle against a simulated EnergyPool contract.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map((p) => {
            const Icon = p.icon;
            const loading = busy === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy != null}
                onClick={() => void onPick(p.id)}
                className={cn(
                  "flex h-14 items-center gap-3 rounded-xl bg-secondary px-3.5 text-left transition-[background-color,transform] duration-150 ease-out",
                  "hover:bg-surface-2 active:scale-[0.98] disabled:opacity-60",
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-background text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{loading ? "Waiting for signature…" : p.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
