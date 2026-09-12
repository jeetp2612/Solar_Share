import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMarket } from "@/lib/market-store";
import {
  solarAddPaymentMethod,
  solarGetState,
  solarListOrder,
  solarSetDefaultPaymentMethod,
  solarSettleTrade,
  solarTestnet,
  solarTopUp,
  solarVerifyChain,
  solarWithdraw,
} from "./api";
import type {
  ChainVerification,
  FillLeg,
  PaymentMethod,
  SavePaymentMethodArgs,
  SettleResult,
  TestnetStatus,
  UserOrderRow,
  PaymentRecord,
} from "./types";

/** Stable fallbacks, so a consumer's `useMemo`/`useEffect` deps do not churn. */
const NO_ORDERS: UserOrderRow[] = [];
const NO_METHODS: PaymentMethod[] = [];
const NO_PAYMENTS: PaymentRecord[] = [];

/**
 * `useCurrentUserState()` rebuilds its `user` object on every render, so a
 * `useMemo`/`useCallback` keyed on it would never settle and every effect that
 * depends on an action would re-fire (this is what made the ledger dialog poll
 * the chain continuously). Keyed on the id instead: same member, same identity.
 */
function useUserById<T extends { id: string } | null>(user: T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- id is the identity; the rest of the profile is re-read from the session
  return useMemo(() => user, [user?.id]);
}

/**
 * Client bridge to the SQL + ledger backend.
 *
 * - `useSolarState()` — signed-in user's profile / wallet / chain head,
 *   polled so the wallet card stays fresh (generation accumulates server-side).
 * - actions — top-up / withdraw / settle trade / list order. Each invalidates
 *   the query so the UI reflects the server's authoritative state.
 *
 * Signed-out visitors see `wallet: null` and the UI offers sign-in.
 *
 * **Everything returned here is referentially stable** between renders whose
 * inputs are unchanged: actions are `useCallback`s and the state object is
 * memoised. Components are free to put these in effect / `useCallback` deps
 * without causing a render → new-identity → re-run loop.
 */
export function useSolarState() {
  const { user: sessionUser, isPending } = useCurrentUserState();
  const user = useUserById(sessionUser);
  const setWallet = useMarket((s) => s.setWallet);
  const setBlock = useMarket((s) => s.setBlock);
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["solar", "state", user?.id],
    queryFn: async () => {
      try {
        return await solarGetState();
      } catch (err) {
        // Signed out (401 "Unauthorized") or backend hiccup — treat as no state.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Unauthorized")) return null;
        throw err;
      }
    },
    enabled: Boolean(user),
    staleTime: 10_000,
    // No data yet (signed out / first paint) → retry sooner; background tabs
    // get left alone so a hidden app never wakes the UI for nothing.
    refetchInterval: (q) => (q.state.data ? 15_000 : 5_000),
    refetchIntervalInBackground: false,
    retry: 1,
  });

  // Mirror into the market store so dashboard components read one place. The
  // store setters ignore no-op writes, so an unchanged poll stops here.
  useEffect(() => {
    const st = query.data;
    if (!st) {
      setWallet(null);
      setBlock(null);
      return;
    }
    setWallet(st.wallet);
    setBlock(st.chainHead.blockNo);
  }, [query.data, setWallet, setBlock]);

  // Session died mid-demo -> back to the market, wallet cleared.
  useEffect(() => {
    if (!isPending && !user) {
      setWallet(null);
    }
  }, [isPending, user, setWallet]);

  const goSignIn = useCallback(() => {
    void navigate({ to: "/login" });
  }, [navigate]);

  const st = query.data;
  return useMemo(
    () => ({
      user,
      isPending,
      profile: st?.profile ?? null,
      wallet: st?.wallet ?? null,
      myOrders: st?.myOrders ?? NO_ORDERS,
      recentPayments: st?.recentPayments ?? NO_PAYMENTS,
      paymentMethods: st?.paymentMethods ?? NO_METHODS,
      chainHead: st?.chainHead ?? null,
      loading: query.isPending && Boolean(user),
      goSignIn,
    }),
    [user, isPending, st, query.isPending, goSignIn],
  );
}

/** Actions that mutate the ledger/wallet; surface toasts and sync the store. */
export function useSolarActions() {
  const queryClient = useQueryClient();
  const { user, goSignIn } = useSolarState();
  const navigate = useNavigate();
  const setWallet = useMarket((s) => s.setWallet);
  const setBlock = useMarket((s) => s.setBlock);

  // Latest auth state, read at *call* time — keeps every action identity stable
  // while the closure still sees the current session.
  const auth = useRef({ user, goSignIn });
  useEffect(() => {
    auth.current = { user, goSignIn };
  }, [user, goSignIn]);

  const guard = useCallback((): boolean => {
    if (auth.current.user) return true;
    toast.info("Create your profile to open a wallet");
    auth.current.goSignIn();
    return false;
  }, []);

  const applySettled = useCallback(
    (result: SettleResult) => {
      setWallet(result.wallet);
      setBlock(result.block.blockNo);
      void queryClient.invalidateQueries({ queryKey: ["solar"] });
    },
    [queryClient, setWallet, setBlock],
  );

  const settle = useCallback(
    async (legs: FillLeg[], action: "buy" | "sell") => {
      if (!guard()) return null;
      const result = await solarSettleTrade({ data: { action, legs } });
      if (result.ok) applySettled(result);
      return result;
    },
    [guard, applySettled],
  );

  const addPaymentMethod = useCallback(
    async (input: SavePaymentMethodArgs): Promise<PaymentMethod | null> => {
      if (!guard()) return null;
      const result = await solarAddPaymentMethod({ data: input });
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: ["solar"] });
        toast.success(`UPI method saved: ${result.method.label}`);
        return result.method;
      }
      toast.error(result.message);
      return null;
    },
    [guard, queryClient],
  );

  const setDefaultPaymentMethod = useCallback(
    async (methodId: string): Promise<boolean> => {
      if (!guard()) return false;
      const result = await solarSetDefaultPaymentMethod({ data: { methodId } });
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: ["solar"] });
        return true;
      }
      toast.error(result.message);
      return false;
    },
    [guard, queryClient],
  );

  const topUp = useCallback(
    async (amount: number, methodId?: string): Promise<boolean> => {
      if (!guard()) return false;
      const result = await solarTopUp({ data: { amount, methodId } });
      if (result.ok) {
        applySettled(result);
        toast.success(
          `UPI top-up confirmed: ₹${result.amountInr.toFixed(0)} · ref ${result.payment?.providerRef ?? "recorded"} · block ${result.block.blockNo}`,
        );
        return true;
      }
      toast.error(result.message);
      return false;
    },
    [guard, applySettled],
  );

  const withdraw = useCallback(
    async (amount: number, methodId?: string): Promise<boolean> => {
      if (!guard()) return false;
      const result = await solarWithdraw({ data: { amount, methodId } });
      if (result.ok) {
        applySettled(result);
        toast.success(
          `UPI withdrawal queued: ₹${result.amountInr.toFixed(0)} · ref ${result.payment?.providerRef ?? "recorded"} · block ${result.block.blockNo}`,
        );
        return true;
      }
      toast.error(result.message);
      return false;
    },
    [guard, applySettled],
  );

  const listOrder = useCallback(
    async (side: "ask" | "bid", kwh: number, price: number): Promise<boolean> => {
      if (!guard()) return false;
      type ListOrderResult =
        | { ok: true; order: { id: string }; block: { blockNo: number } }
        | { ok: false; message: string };
      const result = (await solarListOrder({
        data: { side, kwh, priceInr: price },
      })) as unknown as ListOrderResult;
      if (result.ok) {
        setBlock(result.block.blockNo);
        void queryClient.invalidateQueries({ queryKey: ["solar"] });
        return true;
      }
      toast.error(result.message);
      return false;
    },
    [guard, queryClient, setBlock],
  );

  /** "Verify chain" — recompute every hash from genesis. */
  const verifyChain = useCallback(async (): Promise<ChainVerification | null> => {
    if (!guard()) return null;
    return solarVerifyChain();
  }, [guard]);

  /**
   * Public-chain bridge reading. `force` bypasses the server-side cache — only
   * a *manual* refresh should do that, an automatic one must not.
   */
  const testnet = useCallback(
    (force?: boolean) => solarTestnet({ data: { force } }) as Promise<TestnetStatus>,
    [],
  );

  /** Convenience: sign-in redirect for trade CTAs. */
  const requireAuth = useCallback(
    (message: string) => {
      if (auth.current.user) return true;
      toast.info(message);
      void navigate({ to: "/login" });
      return false;
    },
    [navigate],
  );

  return useMemo(
    () => ({
      settle,
      addPaymentMethod,
      setDefaultPaymentMethod,
      topUp,
      withdraw,
      listOrder,
      verifyChain,
      testnet,
      requireAuth,
    }),
    [
      settle,
      addPaymentMethod,
      setDefaultPaymentMethod,
      topUp,
      withdraw,
      listOrder,
      verifyChain,
      testnet,
      requireAuth,
    ],
  );
}

/** Shared: peer display name for the signed-in user (ledger "You"). */
export function usePeerName(): string {
  const { user, profile } = useSolarState();
  return useMemo(() => profile?.fullName ?? user?.displayName ?? "You", [profile, user]);
}
