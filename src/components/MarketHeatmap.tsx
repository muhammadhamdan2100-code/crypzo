import { Link } from "@tanstack/react-router";
import type { Coin } from "@/lib/coingecko";
import { fmtPct } from "@/lib/coingecko";

interface Props {
  coins: Coin[];
  loading?: boolean;
  count?: number;
}

// Visual heatmap: tile area proportional to market cap, color = 24h change.
export function MarketHeatmap({ coins, loading, count = 50 }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-secondary/40" />
        ))}
      </div>
    );
  }

  const list = coins.slice(0, count);
  const max = Math.max(...list.map((c) => c.market_cap ?? 0));

  return (
    <div className="grid auto-rows-[64px] grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
      {list.map((c) => {
        const pct = c.price_change_percentage_24h ?? 0;
        // Map -10..+10 → 0..130 hue (red→green)
        const clamped = Math.max(-10, Math.min(10, pct));
        const hue = Math.round(((clamped + 10) / 20) * 130);
        const intensity = Math.min(0.55, 0.15 + Math.abs(clamped) / 25);
        const weight = (c.market_cap ?? 0) / (max || 1);
        // Bigger caps span more cells via row/col span.
        const span = weight > 0.6 ? "col-span-2 row-span-2" : weight > 0.25 ? "col-span-2" : "";

        return (
          <Link
            key={c.id}
            to="/coin/$id"
            params={{ id: c.id }}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border border-border/60 p-2 transition hover:border-[var(--neon-cyan)] ${span}`}
            style={{
              background: `linear-gradient(135deg, oklch(0.30 ${intensity * 0.4} ${hue}) 0%, oklch(0.20 ${intensity * 0.3} ${hue}) 100%)`,
            }}
          >
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
              <img src={c.image} alt="" className="h-3.5 w-3.5 rounded-full" />
              <span className="truncate">{c.symbol}</span>
            </div>
            <div className="num text-[11px] font-bold text-white">
              {fmtPct(pct)}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
