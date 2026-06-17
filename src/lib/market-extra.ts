// Extra market datasources: global stats, trending, Fear & Greed.

export interface GlobalStats {
  total_market_cap_usd: number;
  total_volume_usd: number;
  btc_dominance: number;
  eth_dominance: number;
  market_cap_change_24h: number;
  active_cryptocurrencies: number;
}

export async function fetchGlobal(): Promise<GlobalStats> {
  const res = await fetch("https://api.coingecko.com/api/v3/global");
  if (!res.ok) throw new Error("global failed");
  const j = await res.json();
  const d = j.data ?? {};
  return {
    total_market_cap_usd: d.total_market_cap?.usd ?? 0,
    total_volume_usd: d.total_volume?.usd ?? 0,
    btc_dominance: d.market_cap_percentage?.btc ?? 0,
    eth_dominance: d.market_cap_percentage?.eth ?? 0,
    market_cap_change_24h: d.market_cap_change_percentage_24h_usd ?? 0,
    active_cryptocurrencies: d.active_cryptocurrencies ?? 0,
  };
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  image: string;
  market_cap_rank: number;
  score: number;
}

export async function fetchTrending(): Promise<TrendingCoin[]> {
  const res = await fetch("https://api.coingecko.com/api/v3/search/trending");
  if (!res.ok) throw new Error("trending failed");
  const j = await res.json();
  return (j.coins ?? []).slice(0, 7).map((c: any) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    image: c.item.small ?? c.item.thumb,
    market_cap_rank: c.item.market_cap_rank ?? 0,
    score: c.item.score ?? 0,
  }));
}

export interface FearGreed {
  value: number; // 0-100
  classification: string;
  updated: number;
}

export async function fetchFearGreed(): Promise<FearGreed> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1");
  if (!res.ok) throw new Error("fng failed");
  const j = await res.json();
  const d = j.data?.[0];
  return {
    value: Number(d?.value ?? 50),
    classification: d?.value_classification ?? "Neutral",
    updated: Number(d?.timestamp ?? Math.floor(Date.now() / 1000)),
  };
}

export interface Category {
  id: string;
  name: string;
  market_cap: number;
  market_cap_change_24h: number;
  top_3_coins: string[];
  volume_24h: number;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("https://api.coingecko.com/api/v3/coins/categories?order=market_cap_change_24h_desc");
  if (!res.ok) throw new Error("categories failed");
  const j = await res.json();
  return (j ?? []).slice(0, 12).map((c: any) => ({
    id: c.id,
    name: c.name,
    market_cap: c.market_cap ?? 0,
    market_cap_change_24h: c.market_cap_change_24h ?? 0,
    top_3_coins: c.top_3_coins ?? [],
    volume_24h: c.volume_24h ?? 0,
  }));
}

export interface RecentCoin {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

// CoinGecko public API exposes no listing-date sort; we use id_desc as a
// reasonable proxy for "newly indexed / low-cap discoveries".
export async function fetchRecentlyAdded(): Promise<RecentCoin[]> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=id_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h"
  );
  if (!res.ok) throw new Error("recent failed");
  const j = await res.json();
  return (j ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    image: c.image,
    current_price: c.current_price ?? 0,
    price_change_percentage_24h: c.price_change_percentage_24h ?? 0,
    market_cap: c.market_cap ?? 0,
  }));
}

