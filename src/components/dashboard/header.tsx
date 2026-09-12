import { Copy, LogOut, Sun, Unplug, Zap } from "lucide-react";
import { toast } from "sonner";
import { LogoMark, Wordmark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUsd, shortAddr } from "@/lib/format";
import { useMarket } from "@/lib/market-store";
import { cn } from "@/lib/utils";

export function Header() {
  const mode = useMarket((s) => s.mode);
  const setMode = useMarket((s) => s.setMode);
  const wallet = useMarket((s) => s.wallet);
  const openConnect = useMarket((s) => s.openConnect);
  const disconnectWallet = useMarket((s) => s.disconnectWallet);

  function copyAddress() {
    if (!wallet) return;
    void navigator.clipboard.writeText(wallet.address);
    toast.success("Address copied");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex min-w-0 items-center gap-2.5">
          <LogoMark className="size-8 shrink-0" />
          <span className="min-w-0">
            <Wordmark className="block leading-none" />
            <span className="hidden text-[10px] tracking-wide text-muted-foreground sm:block">
              Local energy exchange
            </span>
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div
            className="flex rounded-lg bg-secondary p-1"
            role="group"
            aria-label="Trading mode"
          >
            <ModeChip
              active={mode === "consumer"}
              onClick={() => setMode("consumer")}
              icon={Zap}
              label="Consumer"
            />
            <ModeChip
              active={mode === "prosumer"}
              onClick={() => setMode("prosumer")}
              icon={Sun}
              label="Prosumer"
            />
          </div>

          {wallet ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-0 gap-2 pl-2 pr-3">
                  <span className="flex size-7 items-center justify-center rounded-sm bg-primary/15 font-mono text-[10px] text-primary">
                    0x
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block font-mono text-xs leading-none">{shortAddr(wallet.address)}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground tabular">
                      {formatUsd(wallet.usd, 2)}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Connected · {wallet.provider}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={copyAddress}>
                  <Copy className="size-4" />
                  Copy address
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => disconnectWallet()}>
                  <LogOut className="size-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => openConnect(true)} className="gap-2">
              <Unplug className="size-4" />
              <span className="hidden sm:inline">Connect wallet</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function ModeChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-11 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-[background-color,color] duration-150 ease-out sm:px-3",
        active ? "bg-background text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active && (label === "Prosumer" ? "text-primary" : "text-accent"))} />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label === "Prosumer" ? "Sell" : "Buy"}</span>
    </button>
  );
}

export function StatusBar() {
  const irradiance = useMarket((s) => s.irradiance);
  const block = useMarket((s) => s.block);
  const nodes = 47;

  return (
    <div className="border-b border-border/80">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto px-4 py-2 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
        <Badge variant="default" className="shrink-0">
          <span className="live-dot size-1.5 rounded-full bg-primary" />
          Live
        </Badge>
        <span className="hidden shrink-0 sm:inline">Eastside Microgrid · Austin</span>
        <span className="shrink-0">{nodes} nodes</span>
        <span className="shrink-0 tabular">Irradiance {(irradiance * 100).toFixed(0)}%</span>
        <span className="ml-auto hidden shrink-0 font-mono sm:inline">
          EnergyPool 0xE41c…D6e7
        </span>
        <span className="hidden shrink-0 font-mono tabular md:inline">Block {block.toLocaleString()}</span>
      </div>
    </div>
  );
}
