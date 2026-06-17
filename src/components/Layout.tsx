import type { ReactNode } from "react";
import { Ticker } from "./Ticker";
import { BottomNav, TopBar } from "./Nav";

export function AppLayout({ children, hideTicker }: { children: ReactNode; hideTicker?: boolean }) {
  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <TopBar />
      {!hideTicker && <Ticker />}
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <BottomNav />
    </div>
  );
}
