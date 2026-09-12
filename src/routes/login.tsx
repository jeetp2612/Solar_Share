import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Lock, Mail, Sun, UserRound, ShieldCheck } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

type Tab = "signin" | "signup";

function LoginPage() {
  const [tab, setTab] = useState<Tab>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const call =
        tab === "signup"
          ? authClient.signUp.email({
              name: name.trim() || "Solar Member",
              email,
              password,
              callbackURL: "/",
            })
          : authClient.signIn.email({ email, password, callbackURL: "/" });
      const { error: err } = await call;
      if (err) {
        setError(err.message ?? "Something went wrong");
        return;
      }
      // On success better-auth redirects to callbackURL (full page). If the
      // client flow returned without redirecting, navigate ourselves.
      if (typeof window !== "undefined") window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-canvas flex min-h-dvh">
      <div className="hidden w-[46%] flex-col justify-between border-r border-border/70 bg-card/40 p-10 lg:flex">
        <a href="/" className="flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <span>
            <Wordmark className="block leading-none" />
            <span className="mt-1 block text-[11px] tracking-wide text-muted-foreground">
              Peer-to-peer solar exchange
            </span>
          </span>
        </a>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            Your rooftop.
            <br />
            <span className="text-primary">Your income.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Join the Mumbai Rooftop Microgrid. Sell surplus solar to your
            neighbours for ₹, buy energy when the sun is down — every settlement
            recorded on a verifiable ledger.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Sun className="size-4 text-primary" />
              Everyone can <span className="text-foreground">buy and sell</span> kWh — no roles
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-primary" />
              Wallet + trades stored in <span className="text-foreground">SQL</span>, settlements
              hash-chained
            </li>
            <li className="flex items-center gap-2.5">
              <Lock className="size-4 text-primary" />
              Real email + password account, your data is yours
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Mumbai Rooftop Microgrid · BKC–Andheri Feeder 14 · 47 nodes online
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <a
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to live market
          </a>

          <div className="mb-6 lg:hidden">
            <LogoMark className="size-10" />
            <p className="mt-2 text-xs text-muted-foreground">
              Mumbai Rooftop Microgrid · P2P solar exchange
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="mb-6 flex rounded-lg bg-secondary p-1" role="group" aria-label="Auth mode">
              {(["signup", "signin"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setError(null);
                  }}
                  className={`h-9 flex-1 rounded-md text-sm font-medium transition-[background-color,color] duration-150 ${
                    tab === t
                      ? "bg-background text-foreground shadow-[var(--shadow-card)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "signup" ? "Create profile" : "Sign in"}
                </button>
              ))}
            </div>

            <h2 className="font-display text-xl font-semibold tracking-tight">
              {tab === "signup" ? "Join the microgrid" : "Welcome back"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {tab === "signup"
                ? "New profiles start with a ₹500 wallet credit."
                : "Sign in to your wallet and rooftop."}
            </p>

            <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
              {tab === "signup" ? (
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-xs font-medium text-muted-foreground">Full name</label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Aarav Sharma"
                      autoComplete="name"
                      className="pl-9"
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete={tab === "signup" ? "new-password" : "current-password"}
                    className="pl-9"
                  />
                </div>
              </div>

              {error ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={busy || password.length < 8}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {tab === "signup" ? "Create profile" : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Demo accounts — passwords are hashed and stored in the app's own
            Postgres database.
          </p>
        </div>
      </div>
    </div>
  );
}
