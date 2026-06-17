import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Flame, Grid3x3, Layers, Sparkles, TrendingDown, TrendingUp, Wallet, Zap } from "lucide-react";
import { AppLayout } from "@/components/Layout";
import { MarketList } from "@/components/MarketList";
import { MarketHeatmap } from "@/components/MarketHeatmap";
import { TradingViewMini } from "@/components/TradingViewMini";
import { PortfolioSummaryCard, WatchlistSummaryCard } from "@/components/SummaryCards";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { fetchMarkets, fmtCompact, fmtPct, fmtUsd } from "@/lib/coingecko";
import { useLivePrices } from "@/lib/binance-ws";
import { fetchCategories, fetchFearGreed, fetchGlobal, fetchRecentlyAdded, fetchTrending } from "@/lib/market-extra";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Market Nova Pro — Live Crypto Dashboard, Portfolio & P&L" },
      { name: "description", content: "Real-time crypto prices, BTC dominance, Fear & Greed index, trending coins, portfolio tracking and realized P&L in a premium neon dashboard." },
      { property: "og:title", content: "Market Nova Pro" },
      { property: "og:description", content: "Premium real-time crypto intelligence dashboard." },
    ],
  }),
  component: Home,
});

function Home() {
  const markets = useQuery({
    queryKey: ["markets"],
    queryFn: () => fetchMarkets(100, 1),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const global = useQuery({
    queryKey: ["global"],
    queryFn: fetchGlobal,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const fng = useQuery({
    queryKey: ["fng"],
    queryFn: fetchFearGreed,
    refetchInterval: 15 * 60_000,
    staleTime: 10 * 60_000,
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  const recent = useQuery({
    queryKey: ["recently-added"],
    queryFn: fetchRecentlyAdded,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });


  const data = useLivePrices(markets.data);
  const top = data[0];
  const gainers = [...data].sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)).slice(0, 5);
  const losers = [...data].sort((a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0)).slice(0, 5);

  return (
    <AppLayout>
      {/* Hero */}
      <section className="glass relative mb-6 overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[image:var(--gradient-primary)] opacity-20 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-accent opacity-15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              Live · sub-second updates
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              The market, <span className="neon-text">live</span>.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Real-time prices, on-chain dominance and AI-grade intelligence — built for serious traders.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow"
              >
                <Wallet className="h-4 w-4" /> Portfolio
              </Link>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold"
              >
                <Activity className="h-4 w-4" /> Log trade
              </Link>
              <Link
                to="/news"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold"
              >
                <Sparkles className="h-4 w-4" /> News
              </Link>
            </div>
          </div>

          {top && (
            <Link to="/coin/$id" params={{ id: top.id }} className="glass rounded-2xl p-4 text-right hover:border-[var(--neon-cyan)]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bitcoin</div>
              <div className="num text-3xl font-bold">
                <AnimatedCounter value={top.current_price} format={(n) => fmtUsd(n)} />
              </div>
              <div className={`num text-sm font-bold ${(top.price_change_percentage_24h ?? 0) >= 0 ? "text-[var(--success)]" : "text-destructive"}`}>
                {fmtPct(top.price_change_percentage_24h)} · 24h
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* KPI grid */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Global Mkt Cap"
          loading={global.isLoading}
          value={global.data?.total_market_cap_usd ?? 0}
          format={(n) => `$${fmtCompact(n)}`}
          sub={global.data ? `${fmtPct(global.data.market_cap_change_24h)} · 24h` : undefined}
          subAccent={(global.data?.market_cap_change_24h ?? 0) >= 0 ? "up" : "down"}
        />
        <KpiCard
          label="24h Volume"
          loading={global.isLoading}
          value={global.data?.total_volume_usd ?? 0}
          format={(n) => `$${fmtCompact(n)}`}
        />
        <KpiCard
          label="BTC Dominance"
          loading={global.isLoading}
          value={global.data?.btc_dominance ?? 0}
          format={(n) => `${n.toFixed(2)}%`}
          sub={global.data ? `ETH ${global.data.eth_dominance.toFixed(2)}%` : undefined}
        />
        <FearGreedCard
          loading={fng.isLoading}
          value={fng.data?.value ?? 50}
          classification={fng.data?.classification ?? "Neutral"}
        />
      </section>

      {/* Trending */}
      <section className="glass mb-6 rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Trending now</h2>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            CoinGecko · 24h
          </span>
        </div>
        {trending.isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 w-40 shrink-0 animate-pulse rounded-xl bg-secondary/40" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {(trending.data ?? []).map((t, i) => (
              <Link
                key={t.id}
                to="/coin/$id"
                params={{ id: t.id }}
                className="group flex w-40 shrink-0 flex-col gap-1 rounded-xl border border-border bg-secondary/40 p-3 transition hover:border-[var(--neon-cyan)]"
              >
                <div className="flex items-center gap-2">
                  <img src={t.image} alt="" className="h-7 w-7 rounded-full" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{t.name}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{t.symbol}</div>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span>#{i + 1} trend</span>
                  {t.market_cap_rank > 0 && <span>Rank {t.market_cap_rank}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Portfolio + Watchlist summaries */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <PortfolioSummaryCard />
        <WatchlistSummaryCard />
      </section>

      {/* Movers */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <MoverCard title="Top Gainers · 24h" icon={<TrendingUp className="h-4 w-4 text-[var(--success)]" />} coins={gainers} />
        <MoverCard title="Top Losers · 24h" icon={<TrendingDown className="h-4 w-4 text-destructive" />} coins={losers} />
      </section>

      {/* Macro trend charts */}
      <section className="mb-6 grid gap-3 lg:grid-cols-2">
        <TradingViewMini symbol="CRYPTOCAP:TOTAL" title="Total Market Cap" />
        <TradingViewMini symbol="CRYPTOCAP:BTC.D" title="BTC Dominance" />
      </section>

      {/* Heatmap */}
      <section className="glass mb-6 rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Market Heatmap</h2>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top 50 · 24h</span>
        </div>
        <MarketHeatmap coins={data} loading={markets.isLoading} count={50} />
      </section>

      {/* Categories + Recently added */}
      <section className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Trending Categories</h2>
          </div>
          {categories.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-secondary/40" />)}</div>
          ) : (
            <ul className="space-y-1.5">
              {(categories.data ?? []).slice(0, 8).map((c) => {
                const up = c.market_cap_change_24h >= 0;
                return (
                  <li key={c.id} className="flex items-center gap-2 rounded p-1.5 hover:bg-secondary/40">
                    <div className="flex -space-x-2">
                      {c.top_3_coins.slice(0, 3).map((src, i) => (
                        <img key={i} src={src} alt="" className="h-5 w-5 rounded-full border border-background" />
                      ))}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{c.name}</span>
                    <span className="num text-[11px] text-muted-foreground">${fmtCompact(c.market_cap)}</span>
                    <span className={`num w-16 text-right text-xs font-bold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                      {fmtPct(c.market_cap_change_24h)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Recently Added</h2>
          </div>
          {recent.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-secondary/40" />)}</div>
          ) : (
            <ul className="space-y-1.5">
              {(recent.data ?? []).slice(0, 8).map((c) => {
                const up = c.price_change_percentage_24h >= 0;
                return (
                  <li key={c.id}>
                    <Link to="/coin/$id" params={{ id: c.id }} className="flex items-center gap-2 rounded p-1.5 hover:bg-secondary/40">
                      <img src={c.image} alt="" className="h-6 w-6 rounded-full" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{c.name}</span>
                      <span className="num text-[11px] text-muted-foreground">{fmtUsd(c.current_price)}</span>
                      <span className={`num w-16 text-right text-xs font-bold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                        {fmtPct(c.price_change_percentage_24h)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <MarketList />

    </AppLayout>
  );
}

function KpiCard({
  label, value, format, sub, subAccent, loading,
}: {
  label: string; value: number; format: (n: number) => string;
  sub?: string; subAccent?: "up" | "down"; loading?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      {loading ? (
        <div className="mt-2 h-6 w-24 animate-pulse rounded bg-secondary/60" />
      ) : (
        <div className="num mt-1 text-xl font-bold neon-text">
          <AnimatedCounter value={value} format={format} />
        </div>
      )}
      {sub && (
        <div className={`num mt-0.5 text-xs font-semibold ${subAccent === "up" ? "text-[var(--success)]" : subAccent === "down" ? "text-destructive" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function FearGreedCard({ value, classification, loading }: { value: number; classification: string; loading: boolean }) {
  // Color: red→amber→green across 0-100
  const hue = Math.round((value / 100) * 130); // 0=red, 130=green
  const angle = (value / 100) * 180; // semi-circle gauge
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fear & Greed</div>
      {loading ? (
        <div className="mt-2 h-12 w-24 animate-pulse rounded bg-secondary/60" />
      ) : (
        <div className="mt-1 flex items-center gap-3">
          <div className="relative h-12 w-20">
            <svg viewBox="0 0 100 55" className="h-full w-full">
              <path d="M5 50 A 45 45 0 0 1 95 50" stroke="oklch(0.30 0.04 265)" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path
                d="M5 50 A 45 45 0 0 1 95 50"
                stroke={`oklch(0.75 0.22 ${hue})`}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="141.37"
                strokeDashoffset={141.37 - (angle / 180) * 141.37}
              />
            </svg>
          </div>
          <div>
            <div className="num text-xl font-bold" style={{ color: `oklch(0.78 0.22 ${hue})` }}>
              <AnimatedCounter value={value} format={(n) => Math.round(n).toString()} />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{classification}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoverCard({ title, icon, coins }: { title: string; icon: React.ReactNode; coins: any[] }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <ul className="space-y-2">
        {coins.map((c) => {
          const up = (c.price_change_percentage_24h ?? 0) >= 0;
          return (
            <li key={c.id}>
              <Link to="/coin/$id" params={{ id: c.id }} className="flex items-center gap-3 rounded-lg p-1 hover:bg-secondary/40">
                <img src={c.image} className="h-7 w-7 rounded-full" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="num text-xs text-muted-foreground">{fmtUsd(c.current_price)}</div>
                </div>
                <div className={`num text-sm font-bold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                  {fmtPct(c.price_change_percentage_24h)}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
