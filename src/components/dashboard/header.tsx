import { BookOpenCheck, ChevronDown, LogOut, ShieldCheck } from "lucide-react";
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
import { formatInr, formatKwh } from "@/lib/format";
import { signOut } from "@/lib/auth/client";
import { MICROGRID } from "@/lib/market-data";
import { useMarket } from "@/lib/market-store";
import { useSolarState } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";

export function Header() {
  const block = useMarket((s) => s.block);
  const setLedgerOpen = useMarket((s) => s.setLedgerOpen);
  const { user, profile, wallet, isPending } = useSolarState();

  const initials = (profile?.fullName ?? user?.displayName ?? "S")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex min-w-0 items-center gap-2.5">
          <LogoMark className="size-8 shrink-0" />
          <span className="min-w-0">
            <Wordmark className="block leading-none" />
            <span className="hidden text-[10px] tracking-wide text-muted-foreground sm:block">
              P2P solar exchange · Mumbai
            </span>
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLedgerOpen(true)}
            className="gap-2"
          >
            <BookOpenCheck className="size-4 text-primary" />
            <span className="hidden text-xs sm:inline">Ledger</span>
            {block != null ? (
              <span className="rounded-sm bg-secondary px-1.5 font-mono text-[10px] tabular text-foreground">
                blk {block.toLocaleString("en-IN")}
              </span>
            ) : null}
          </Button>

          {isPending ? (
            <div className="h-9 w-28 animate-pulse rounded-lg bg-secondary" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-0 gap-2 pl-2 pr-3">
                  <span className="flex size-7 items-center justify-center rounded-sm bg-primary/15 text-[11px] font-semibold text-primary">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-32 truncate text-xs leading-none">
                      {profile?.fullName ?? user.displayName ?? "Member"}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground tabular">
                      {wallet ? `${formatInr(wallet.inr, 0)} · ${formatKwh(wallet.kwhCredits, 0)}` : "opening wallet…"}
                    </span>
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate text-xs font-normal">
                    {profile?.fullName ?? user.displayName}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {user.primaryEmail} · {profile?.area ?? "Mumbai"}
                  </span>
                </DropdownMenuLabel>
                {wallet ? (
                  <div className="px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    <p className="flex justify-between">
                      <span>INR balance</span>
                      <span className="font-mono text-foreground tabular">{formatInr(wallet.inr, 0)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>kWh on hand</span>
                      <span className="font-mono text-foreground tabular">{formatKwh(wallet.kwhCredits, 1)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Surplus to sell</span>
                      <span className="font-mono text-foreground tabular">{formatKwh(wallet.surplusKwh, 1)}</span>
                    </p>
                  </div>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setLedgerOpen(true)}>
                  <ShieldCheck className="size-4" />
                  View ledger & verify
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void signOut("/");
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a href="/login">
              <Button className="gap-2" size="sm">
                <span className="hidden sm:inline">Sign in / Join</span>
                <span className="sm:hidden">Sign in</span>
              </Button>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function StatusBar() {
  const irradiance = useMarket((s) => s.irradiance);
  const block = useMarket((s) => s.block);

  return (
    <div className="border-b border-border/80">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto px-4 py-2 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
        <Badge variant="default" className="shrink-0">
          <span className="live-dot size-1.5 rounded-full bg-primary" />
          Live
        </Badge>
        <span className="hidden shrink-0 sm:inline">{MICROGRID.feeder} · {MICROGRID.city}</span>
        <span className="shrink-0 tabular">{MICROGRID.nodesOnline} nodes</span>
        <span className="shrink-0 tabular">Sunlight {(irradiance * 100).toFixed(0)}%</span>
        <span className="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
          <ShieldCheck className={cn("size-3", "text-primary")} />
          <span>SHA-256 ledger</span>
        </span>
        <span className="shrink-0 font-mono tabular">
          {block != null ? `Block ${block.toLocaleString("en-IN")}` : "Connecting ledger…"}
        </span>
      </div>
    </div>
  );
}
