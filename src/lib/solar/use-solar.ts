import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMarket } from "@/lib/market-store";
import {
  solarGetState,
  solarListOrder,
  solarSettleTrade,
  solarTestnet,
  solarTopUp,
  solarVerifyChain,
  solarWithdraw,
} from "./api";
import type { FillLeg, SettleResult, TestnetStatus, ChainVerification } from "./types";

/**
 * Client bridge to the SQL + ledger backend.
 *
 * - `useSolarState()` — signed-in user's profile / wallet / chain head,
 *   polled so the wallet card stays fresh (generation accumulates server-side).
 * - actions — top-up / withdraw / settle trade / list order. Each invalidates
 *   the query so the UI reflects the server's authoritative state.
 *
 * Signed-out visitors see `wallet: null` and the UI offers sign-in.
 */
export function useSolarState() {
  const { user, isPending } = useCurrentUserState();
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
    refetchInterval: (q) => (q.state.data ? 15_000 : 5_000),
    retry: 1,
  });

  // Mirror into the market store so dashboard components read one place.
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

  const goSignIn = () => {
    navigate({ to: "/login" });
  };

  return {
    user,
    isPending,
    profile: query.data?.profile ?? null,
    wallet: query.data?.wallet ?? null,
    myOrders: query.data?.myOrders ?? [],
    chainHead: query.data?.chainHead ?? null,
    loading: query.isPending && Boolean(user),
    goSignIn,
  };
}

/** Actions that mutate the ledger/wallet; surface toasts and sync the store. */
export function useSolarActions() {
  const queryClient = useQueryClient();
  const { user, goSignIn } = useSolarState();
  const navigate = useNavigate();
  const setWallet = useMarket((s) => s.setWallet);
  const setBlock = useMarket((s) => s.setBlock);

  function guard() {
    if (!user) {
      toast.info("Create your profile to open a wallet");
      goSignIn();
      return false;
    }
    return true;
  }

  function applySettled(result: SettleResult) {
    setWallet(result.wallet);
    setBlock(result.block.blockNo);
    void queryClient.invalidateQueries({ queryKey: ["solar"] });
  }

  return {
    /** Client-side matcher already picked legs; settle on-chain server-side. */
    settle: async (legs: FillLeg[], action: "buy" | "sell") => {
      if (!guard()) return null;
      const result = await solarSettleTrade({ data: { action, legs } });
      if (result.ok) applySettled(result);
      return result;
    },

    topUp: async (amount: number): Promise<boolean> => {
      if (!guard()) return false;
      const result = await solarTopUp({ data: { amount } });
      if (result.ok) {
        applySettled(result);
        toast.success(`Wallet topped up with ₹${result.amountInr.toFixed(0)} · block ${result.block.blockNo}`);
        return true;
      }
      toast.error(result.message);
      return false;
    },

    withdraw: async (amount: number): Promise<boolean> => {
      if (!guard()) return false;
      const result = await solarWithdraw({ data: { amount } });
      if (result.ok) {
        applySettled(result);
        toast.success(`Withdrew ₹${result.amountInr.toFixed(0)} to your bank · block ${result.block.blockNo}`);
        return true;
      }
      toast.error(result.message);
      return false;
    },

    listOrder: async (side: "ask" | "bid", kwh: number, price: number): Promise<boolean> => {
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

    /** "Verify chain" — recompute every hash from genesis. */
    verifyChain: async (): Promise<ChainVerification | null> => {
      if (!guard()) return null;
      return solarVerifyChain();
    },

    testnet: () => solarTestnet() as Promise<TestnetStatus>,

    /** Convenience: sign-in redirect for trade CTAs. */
    requireAuth: (message: string) => {
      if (!user) {
        toast.info(message);
        navigate({ to: "/login" });
        return false;
      }
      return true;
    },
  };
}

/** Shared: peer display name for the signed-in user (ledger "You"). */
export function usePeerName(): string {
  const { user, profile } = useSolarState();
  return useMemo(() => profile?.fullName ?? user?.displayName ?? "You", [profile, user]);
}
