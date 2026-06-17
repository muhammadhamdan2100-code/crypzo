import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownUp, Search } from "lucide-react";
import { fetchMarkets, fmtCompact, fmtPct, fmtUsd } from "@/lib/coingecko";
import { useLivePrices } from "@/lib/binance-ws";
import { Sparkline } from "./Sparkline";

type SortKey = "market_cap" | "price" | "change24h" | "volume";

export function MarketList() {
  const { data, isLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: () => fetchMarkets(100, 1),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const live = useLivePrices(data);


  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("market_cap");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const list = live.filter(

      (c) =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.symbol.toLowerCase().includes(q.toLowerCase()),
    );
    const get = (c: (typeof list)[number]) =>
      sort === "price" ? c.current_price
      : sort === "change24h" ? c.price_change_percentage_24h
      : sort === "volume" ? c.total_volume
      : c.market_cap;
    return [...list].sort((a, b) => (dir === "asc" ? get(a) - get(b) : get(b) - get(a)));
  }, [live, q, sort, dir]);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(k); setDir("desc"); }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold tracking-tight">Live Market</h2>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search coins…"
            className="w-full rounded-lg border border-border bg-[oklch(0.18_0.025_265_/_0.6)] py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--neon-cyan)] focus:outline-none"
          />
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid-cols-[2.5rem_1.4fr_1fr_1fr_0.9fr_1fr_5rem]">
          <span>#</span>
          <span>Coin</span>
          <button onClick={() => toggleSort("price")} className="flex items-center gap-1 text-right justify-end hover:text-foreground">
            Price <ArrowDownUp className="h-3 w-3" />
          </button>
          <button onClick={() => toggleSort("change24h")} className="hidden text-right hover:text-foreground sm:block">24h</button>
          <button onClick={() => toggleSort("market_cap")} className="hidden text-right hover:text-foreground sm:block">Mkt Cap</button>
          <button onClick={() => toggleSort("volume")} className="hidden text-right hover:text-foreground sm:block">Volume</button>
          <span className="hidden text-right sm:block">7d</span>
          <span className="sm:hidden text-right">24h</span>
        </div>

        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/50" />
            ))}
          </div>
        )}

        <ul className="divide-y divide-border">
          {rows.map((c) => {
            const up = (c.price_change_percentage_24h ?? 0) >= 0;
            return (
              <li key={c.id}>
                <Link
                  to="/coin/$id"
                  params={{ id: c.id }}
                  className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 px-3 py-3 transition hover:bg-secondary/40 sm:grid-cols-[2.5rem_1.4fr_1fr_1fr_0.9fr_1fr_5rem]"
                >
                  <span className="num text-xs text-muted-foreground">{c.market_cap_rank}</span>
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={c.image} alt="" className="h-8 w-8 rounded-full" loading="lazy" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="text-[11px] font-medium uppercase text-muted-foreground">{c.symbol}</div>
                    </div>
                  </div>
                  <div className="num text-right text-sm font-semibold">{fmtUsd(c.current_price)}</div>
                  <div className={`num hidden text-right text-sm font-semibold sm:block ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                    {fmtPct(c.price_change_percentage_24h)}
                  </div>
                  <div className="num hidden text-right text-xs text-muted-foreground sm:block">${fmtCompact(c.market_cap)}</div>
                  <div className="num hidden text-right text-xs text-muted-foreground sm:block">${fmtCompact(c.total_volume)}</div>
                  <div className="hidden justify-end sm:flex">
                    <Sparkline data={c.sparkline_in_7d?.price ?? []} up={(c.price_change_percentage_7d_in_currency ?? 0) >= 0} />
                  </div>
                  <div className={`num text-right text-xs font-semibold sm:hidden ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                    {fmtPct(c.price_change_percentage_24h)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
