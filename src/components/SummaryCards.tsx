import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Briefcase, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMarkets, fmtPct, fmtUsd } from "@/lib/coingecko";
import { useLivePrices } from "@/lib/binance-ws";
import { AnimatedCounter } from "@/components/AnimatedCounter";


interface Holding { coin_id: string; amount: number; buy_price: number }
interface WatchRow { coin_id: string; symbol: string; image: string | null }

export function PortfolioSummaryCard() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => fetchMarkets(100, 1), refetchInterval: 60_000 });
  const live = useLivePrices(markets.data);


  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("holdings").select("coin_id, amount, buy_price");
      if (active) setHoldings((data ?? []) as Holding[]);
    })();
    return () => { active = false };
  }, []);

  const priceMap = new Map(live.map((c) => [c.id, c.current_price]));
  const value = (holdings ?? []).reduce((s, h) => s + Number(h.amount) * (priceMap.get(h.coin_id) ?? 0), 0);
  const cost = (holdings ?? []).reduce((s, h) => s + Number(h.amount) * Number(h.buy_price), 0);
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
  const up = pnl >= 0;

  return (
    <Link to="/portfolio" className="glass group block rounded-2xl p-4 transition hover:border-[var(--neon-cyan)]">
      <div className="mb-2 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Portfolio</h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {(holdings?.length ?? 0)} assets
        </span>
      </div>
      {holdings === null ? (
        <div className="h-12 animate-pulse rounded bg-secondary/40" />
      ) : holdings.length === 0 ? (
        <div className="text-xs text-muted-foreground">No holdings yet — add your first position.</div>
      ) : (
        <>
          <div className="num text-2xl font-bold neon-text">
            <AnimatedCounter value={value} format={(n) => fmtUsd(n)} />
          </div>
          <div className={`num text-xs font-bold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
            {up ? "+" : ""}{fmtUsd(pnl)} · {fmtPct(pnlPct)}
          </div>
        </>
      )}
    </Link>
  );
}

export function WatchlistSummaryCard() {
  const [rows, setRows] = useState<WatchRow[] | null>(null);
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => fetchMarkets(100, 1), refetchInterval: 60_000 });
  const live = useLivePrices(markets.data);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("watchlist").select("coin_id, symbol, image").limit(8);
      if (active) setRows((data ?? []) as WatchRow[]);
    })();
    return () => { active = false };
  }, []);

  const priceMap = new Map(live.map((c) => [c.id, c]));


  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2">
        <Eye className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Watchlist</h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {(rows?.length ?? 0)} tracked
        </span>
      </div>
      {rows === null ? (
        <div className="h-12 animate-pulse rounded bg-secondary/40" />
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Star coins from the market list to track them here.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 4).map((w) => {
            const c = priceMap.get(w.coin_id);
            const up = (c?.price_change_percentage_24h ?? 0) >= 0;
            return (
              <li key={w.coin_id}>
                <Link to="/coin/$id" params={{ id: w.coin_id }} className="flex items-center gap-2 rounded p-1 text-xs hover:bg-secondary/40">
                  {w.image && <img src={w.image} alt="" className="h-5 w-5 rounded-full" />}
                  <span className="font-semibold uppercase">{w.symbol}</span>
                  <span className="num ml-auto">{fmtUsd(c?.current_price)}</span>
                  <span className={`num w-14 text-right text-[11px] font-bold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                    {fmtPct(c?.price_change_percentage_24h)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
