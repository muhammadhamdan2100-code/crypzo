import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { ArrowLeft, ExternalLink, Newspaper } from "lucide-react";
import { AppLayout } from "@/components/Layout";
import { TradingViewChart } from "@/components/TradingViewChart";
import { fmtCompact, fmtPct, fmtUsd } from "@/lib/coingecko";
import { useLivePrice } from "@/lib/binance-ws";
import { fetchNewsAggregated } from "@/lib/news.functions";
import { timeAgo } from "@/lib/news";

export const Route = createFileRoute("/coin/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} — Market Nova Pro` },
      { name: "description", content: `Live ${params.id} price, professional TradingView charts and market stats.` },
    ],
  }),
  component: CoinPage,
});

function CoinPage() {
  const { id } = Route.useParams();
  const coin = useQuery({
    queryKey: ["coin", id],
    queryFn: () => fetchCoinExtended(id),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const c = coin.data;
  const live = useLivePrice(id);
  const price = live?.price ?? c?.current_price;
  const change24 = live?.changePct ?? c?.price_change_percentage_24h;
  const up = (change24 ?? 0) >= 0;

  return (
    <AppLayout>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to market
      </Link>

      <header className="glass mb-4 flex flex-wrap items-center gap-4 rounded-2xl p-4">
        {c?.image && <img src={c.image} alt="" className="h-12 w-12 rounded-full" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">{c?.name ?? id}</h1>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{c?.symbol} · Rank #{c?.market_cap_rank ?? "—"}</span>
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-[var(--success)]">
                <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" /> Live
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-2xl font-bold">{fmtUsd(price)}</div>
          <div className={`num text-sm font-semibold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
            {fmtPct(change24)} · 24h
          </div>
        </div>
      </header>

      <section className="glass mb-4 overflow-hidden rounded-2xl p-2 sm:p-3">
        {c?.symbol ? (
          <TradingViewChart symbol={c.symbol} interval="60" height={520} />
        ) : (
          <div className="h-[520px] animate-pulse rounded-xl bg-secondary/40" />
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Market Cap" value={`$${fmtCompact(c?.market_cap)}`} />
        <Stat label="24h Volume" value={`$${fmtCompact(c?.total_volume)}`} />
        <Stat label="Circulating" value={c?.circulating_supply != null ? `${fmtCompact(c.circulating_supply)} ${c?.symbol?.toUpperCase() ?? ""}` : "—"} />
        <Stat label="Rank" value={`#${c?.market_cap_rank ?? "—"}`} />
        <Stat label="24h Change" value={fmtPct(change24)} accent={up ? "up" : "down"} />
        <Stat label="7d Change" value={fmtPct(c?.price_change_percentage_7d)} accent={(c?.price_change_percentage_7d ?? 0) >= 0 ? "up" : "down"} />
      </section>

      <RelatedNews symbol={c?.symbol} name={c?.name} />

      {c?.description?.en && (
        <section className="glass mt-4 rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider">About {c.name}</h3>
          <p
            className="prose-sm max-w-none text-sm leading-relaxed text-muted-foreground [&_a]:text-[var(--neon-cyan)]"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(c.description.en.split(". ").slice(0, 4).join(". ") + ".", {
                ALLOWED_TAGS: ["a", "b", "i", "em", "strong", "br", "p"],
                ALLOWED_ATTR: ["href", "target", "rel"],
              }),
            }}
          />
        </section>
      )}
    </AppLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  const color = accent === "up" ? "text-[var(--success)]" : accent === "down" ? "text-destructive" : "";
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}

function RelatedNews({ symbol, name }: { symbol?: string; name?: string }) {
  const news = useQuery({
    queryKey: ["news", "all"],
    queryFn: () => fetchNewsAggregated(),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
    retry: 2,
  });

  if (!symbol && !name) return null;
  const sym = (symbol ?? "").toUpperCase();
  const nameLower = (name ?? "").toLowerCase();

  const related = (news.data ?? [])
    .filter((n) => {
      const tags = (n.categories ?? "").toUpperCase().split("|");
      if (sym && tags.includes(sym)) return true;
      const t = `${n.title} ${n.body}`.toLowerCase();
      return (nameLower && t.includes(nameLower)) || (sym && new RegExp(`\\b${sym.toLowerCase()}\\b`).test(t));
    })
    .slice(0, 6);

  return (
    <section className="glass mt-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Related News</h3>
      </div>
      {news.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/40" />
          ))}
        </div>
      ) : related.length === 0 ? (
        <div className="text-xs text-muted-foreground">No recent coverage matched.</div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {related.map((n) => (
            <li key={n.id}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/40 p-2 transition hover:border-[var(--neon-cyan)]"
              >
                {n.imageurl ? (
                  <img
                    src={n.imageurl}
                    alt=""
                    loading="lazy"
                    className="h-12 w-16 shrink-0 rounded object-cover"
                    onError={(e) => ((e.currentTarget.style.display = "none"))}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="neon-text">{n.source}</span>
                    <span>·</span>
                    <span>{timeAgo(n.published_on)}</span>
                  </div>
                  <div className="line-clamp-2 text-xs font-semibold group-hover:text-[var(--neon-cyan)]">{n.title}</div>
                </div>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Extended fetcher with 7d change + circulating supply.
async function fetchCoinExtended(id: string) {
  const url = `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch coin");
  const j = await res.json();
  return {
    id: j.id,
    symbol: j.symbol,
    name: j.name,
    image: j.image?.large as string,
    current_price: j.market_data?.current_price?.usd as number,
    market_cap: j.market_data?.market_cap?.usd as number,
    market_cap_rank: j.market_cap_rank as number,
    total_volume: j.market_data?.total_volume?.usd as number,
    circulating_supply: j.market_data?.circulating_supply as number | null,
    price_change_percentage_24h: j.market_data?.price_change_percentage_24h as number,
    price_change_percentage_7d: j.market_data?.price_change_percentage_7d as number,
    description: { en: (j.description?.en as string) ?? "" },
  };
}


