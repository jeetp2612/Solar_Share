import { useEffect, useState } from "react";
import { Gift, UserRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSolarState } from "@/lib/solar/use-solar";
import { cn } from "@/lib/utils";

/** Greeting in Indian Standard Time — the microgrid is Mumbai's. */
function istGreeting(): string {
  const now = new Date();
  const hour = Number(
    now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }),
  ) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Personalized strip at the top of the dashboard:
 *   - signed in:  "{greeting}, {your name} ⚡" + one-time "₹500 welcome credit
 *     added" chip (shown the first time each account sees its wallet, tracked
 *     in localStorage)
 *   - guest:      "Create your profile" CTA with the ₹500 credit promise
 */
export function WelcomeBanner() {
  const { user, profile, wallet, isPending } = useSolarState();
  const [showWelcomeCredit, setShowWelcomeCredit] = useState(false);

  // Reveal (once per account) as soon as this account's wallet has loaded.
  useEffect(() => {
    if (!user || !wallet) return;
    const key = `solarshare:welcome-credit:${user.id}`;
    try {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        setShowWelcomeCredit(true);
      }
    } catch {
      // Storage unavailable (private mode) — show it on every visit instead.
      setShowWelcomeCredit(true);
    }
  }, [user, wallet]);

  if (isPending) {
    return (
      <section className="flex h-16 animate-pulse items-center gap-3 rounded-xl border border-border/70 bg-card/50 px-5">
        <span className="size-9 rounded-full bg-secondary" />
        <span className="h-4 w-56 rounded bg-secondary" />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card/60 to-transparent px-5 py-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <UserRound className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold tracking-tight">
            Create your profile to join the Mumbai Rooftop Microgrid
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One sign-up opens your wallet with a{" "}
            <span className="font-medium text-primary">₹500 welcome credit</span> — then buy
            or sell kWh with your neighbours.
          </p>
        </div>
        <a href="/login">
          <Button size="sm" className="gap-1.5">
            <Zap className="size-3.5" />
            Sign up free
          </Button>
        </a>
      </section>
    );
  }

  const name = profile?.fullName ?? user.displayName ?? "Member";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <UserRound className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold tracking-tight">
            {istGreeting()}, <span className="text-primary">{name}</span> ⚡
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {profile?.area ?? "Mumbai"} Rooftop Microgrid
            {profile
              ? ` · ${profile.panelKwp.toFixed(1)} kWp rooftop on your account`
              : " · opening your profile…"}
          </p>
        </div>
      </div>
      {wallet && showWelcomeCredit ? (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <Gift className="size-4 text-primary" />
          <div className="text-xs leading-tight">
            <p className={cn("font-semibold text-foreground")}>Welcome credit added</p>
            <p className="text-muted-foreground">₹500 is in your wallet</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
