// CoinGecko public API helpers
const BASE = "https://api.coingecko.com/api/v3";

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price: number[] };
}

export async function fetchMarkets(perPage = 100, page = 1): Promise<Coin[]> {
  const url = `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=1h,24h,7d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch markets");
  return res.json();
}

export const TICKER_IDS = [
  "bitcoin", "ethereum", "solana", "ripple", "binancecoin",
  "dogecoin", "cardano", "tron",
];

export async function fetchTickerCoins(): Promise<Coin[]> {
  const url = `${BASE}/coins/markets?vs_currency=usd&ids=${TICKER_IDS.join(",")}&sparkline=false&price_change_percentage=24h`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch ticker");
  return res.json();
}

export interface MarketChart { prices: [number, number][] }

export async function fetchMarketChart(id: string, days: string): Promise<MarketChart> {
  const url = `${BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch chart");
  return res.json();
}

export async function fetchCoin(id: string): Promise<Coin & { description: { en: string } }> {
  const url = `${BASE}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch coin");
  const j = await res.json();
  return {
    id: j.id, symbol: j.symbol, name: j.name, image: j.image?.large,
    current_price: j.market_data?.current_price?.usd,
    market_cap: j.market_data?.market_cap?.usd,
    market_cap_rank: j.market_cap_rank,
    total_volume: j.market_data?.total_volume?.usd,
    price_change_percentage_24h: j.market_data?.price_change_percentage_24h,
    description: { en: j.description?.en ?? "" },
  };
}

export function fmtUsd(n: number | undefined | null, opts: Intl.NumberFormatOptions = {}) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const maximumFractionDigits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits, ...opts });
}

export function fmtCompact(n: number | undefined | null) {
  if (n == null || isNaN(n)) return "—";
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function fmtPct(n: number | undefined | null) {
  if (n == null || isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
