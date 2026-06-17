import { useQuery } from "@tanstack/react-query";
import { fetchTickerCoins, fmtPct, fmtUsd, type Coin } from "@/lib/coingecko";
import { BINANCE_PAIRS, useBinanceTickers } from "@/lib/binance-ws";

function Item({ c }: { c: Coin }) {
  const up = (c.price_change_percentage_24h ?? 0) >= 0;
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 whitespace-nowrap">
      <img src={c.image} alt="" className="h-5 w-5 rounded-full" loading="lazy" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {c.symbol}
      </span>
      <span className="num text-sm font-medium text-foreground tabular-nums">{fmtUsd(c.current_price)}</span>
      <span className={`num text-xs font-semibold tabular-nums ${up ? "text-[var(--success)]" : "text-destructive"}`}>
        {fmtPct(c.price_change_percentage_24h)}
      </span>
    </div>
  );
}

export function Ticker() {
  // Initial seed (image, name) from CoinGecko
  const { data } = useQuery({
    queryKey: ["ticker"],
    queryFn: fetchTickerCoins,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  // Live sub-second updates from Binance WebSocket
  const pairs = Object.values(BINANCE_PAIRS);
  const ticks = useBinanceTickers(pairs);

  const coins: Coin[] = (data ?? []).map((c) => {
    const pair = BINANCE_PAIRS[c.id];
    const live = pair ? ticks[pair] : undefined;
    return live
      ? { ...c, current_price: live.price, price_change_percentage_24h: live.changePct }
      : c;
  });
  const doubled = [...coins, ...coins];

  return (
    <div className="relative overflow-hidden border-y border-border bg-[oklch(0.18_0.025_265_/_0.6)] backdrop-blur">
      <div className="absolute left-0 top-0 z-10 flex h-full items-center gap-1 bg-gradient-to-r from-background via-background to-transparent px-3 pr-8">
        <span className="h-2 w-2 rounded-full bg-[var(--success)] pulse-dot" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--success)]">
          Live
        </span>
      </div>
      <div className="flex w-max ticker-track py-1 pl-24">
        {doubled.map((c, i) => (
          <Item key={`${c.id}-${i}`} c={c} />
        ))}
      </div>
    </div>
  );
}
