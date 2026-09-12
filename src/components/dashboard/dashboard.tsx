import { useEffect } from "react";
import { useMarket } from "@/lib/market-store";
import { Header, StatusBar } from "./header";
import { OverviewCards } from "./overview-cards";
import { OrderBook } from "./order-book";
import { QuickTrade } from "./quick-trade";
import { PriceChart } from "./price-chart";
import { ContractFeed } from "./contract-feed";
import { WalletCard } from "./wallet-card";
import { LedgerDialog } from "./ledger-dialog";

export function Dashboard() {
  const startLive = useMarket((s) => s.startLive);
  const tick = useMarket((s) => s.tick);

  useEffect(() => {
    startLive();
    const id = window.setInterval(() => tick(), 2200);
    return () => window.clearInterval(id);
  }, [startLive, tick]);

  return (
    <div className="app-canvas min-h-dvh">
      <Header />
      <StatusBar />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 pb-10 sm:px-6 sm:py-6 lg:px-8">
        <OverviewCards />
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
          <OrderBook />
          <QuickTrade />
        </section>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
          <PriceChart />
          <div className="flex flex-col gap-4">
            <WalletCard />
            <ContractFeed />
          </div>
        </section>
      </main>
      <LedgerDialog />
    </div>
  );
}
