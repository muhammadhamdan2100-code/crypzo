import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/Layout";
import {
  fetchNews,
  NEWS_CATEGORIES,
  NEWS_COINS,
  NEWS_WINDOWS,
  timeAgo,
  type NewsItem,
} from "@/lib/news";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Live Crypto News — Market Nova Pro" },
      { name: "description", content: "Real-time crypto and finance news, filterable by coin, category and time window. Updates every minute." },
      { property: "og:title", content: "Live Crypto News — Market Nova Pro" },
      { property: "og:description", content: "Real-time crypto news with smart filtering." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const [coin, setCoin] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [windowH, setWindowH] = useState<number>(24);
  const [search, setSearch] = useState("");

  const apiCats = [coin, category].filter(Boolean).join(",");

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["news", apiCats],
    queryFn: () => fetchNews({ categories: apiCats || undefined }),
    refetchInterval: 5 * 60_000, // 5 minutes
    staleTime: 4 * 60_000,
    gcTime: 30 * 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const filtered = useMemo(() => {
    const now = Date.now() / 1000;
    const cutoff = windowH > 0 ? now - windowH * 3600 : 0;
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((n) => (cutoff ? n.published_on >= cutoff : true))
      .filter((n) => (q ? n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) : true))
      .sort((a, b) => b.published_on - a.published_on);
  }, [data, windowH, search]);

  return (
    <AppLayout>
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] neon-glow">
          <Newspaper className="h-5 w-5 text-[var(--primary-foreground)]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Live Market <span className="neon-text">News</span></h1>
          <p className="text-xs text-muted-foreground">
            Auto-refreshing · Last update {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:text-foreground"
          aria-label="Refresh news"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <section className="glass mb-4 space-y-3 rounded-2xl p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search headlines…"
          className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-[var(--neon-cyan)]"
        />
        <FilterRow label="Coin" options={NEWS_COINS as any} value={coin} onChange={setCoin} />
        <FilterRow label="Category" options={NEWS_CATEGORIES as any} value={category} onChange={setCategory} />
        <FilterRow
          label="Window"
          options={NEWS_WINDOWS.map((w) => ({ id: String(w.id), label: w.label }))}
          value={String(windowH)}
          onChange={(v) => setWindowH(Number(v))}
        />
      </section>


      <section className="grid gap-3 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass h-48 animate-pulse rounded-2xl bg-secondary/30" />
            ))
          : filtered.map((n) => <NewsCard key={n.id} item={n} />)}
      </section>

      {!isLoading && filtered.length === 0 && (
        <div className="glass mt-4 rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No headlines match your filters.
        </div>
      )}
    </AppLayout>
  );
}

function FilterRow<T extends { id: string; label: string }>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id || "all"}
              onClick={() => onChange(o.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
                active
                  ? "bg-[image:var(--gradient-primary)] text-[var(--primary-foreground)] neon-glow"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const cats = item.categories?.split("|").filter(Boolean).slice(0, 3) ?? [];
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="glass group flex flex-col overflow-hidden rounded-2xl transition hover:border-[var(--neon-cyan)]"
    >
      {item.imageurl && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-secondary/40">
          <img
            src={item.imageurl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
            onError={(e) => ((e.currentTarget.style.display = "none"))}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="neon-text">{item.source_info?.name ?? item.source}</span>
          <span>·</span>
          <span>{timeAgo(item.published_on)}</span>
        </div>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-[var(--neon-cyan)]">
          {item.title}
        </h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {c}
              </span>
            ))}
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </a>
  );
}
