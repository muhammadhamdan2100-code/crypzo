// Aggregated keyless news (RSS via server fn). Filters applied client-side.
import { fetchNewsAggregated, type NewsItem } from "./news.functions";

export type { NewsItem };

export interface FetchNewsParams {
  categories?: string; // comma-separated, e.g. "BTC,Trading"
}

export async function fetchNews(params: FetchNewsParams = {}): Promise<NewsItem[]> {
  const all = await fetchNewsAggregated();
  if (!params.categories) return all;
  const wanted = params.categories.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!wanted.length) return all;
  return all.filter((n) => {
    const tags = (n.categories ?? "").toUpperCase().split("|").filter(Boolean);
    return wanted.every((w) => tags.includes(w));
  });
}

export const NEWS_CATEGORIES = [
  { id: "", label: "All" },
  { id: "Trading", label: "Trading" },
  { id: "Mining", label: "Mining" },
  { id: "Exchange", label: "Exchange" },
  { id: "Regulation", label: "Regulation" },
  { id: "Technology", label: "Technology" },
  { id: "Market", label: "Market" },
  { id: "Blockchain", label: "Blockchain" },
] as const;

export const NEWS_COINS = [
  { id: "", label: "All Coins" },
  { id: "BTC", label: "Bitcoin" },
  { id: "ETH", label: "Ethereum" },
  { id: "SOL", label: "Solana" },
  { id: "XRP", label: "XRP" },
  { id: "BNB", label: "BNB" },
  { id: "DOGE", label: "Dogecoin" },
  { id: "ADA", label: "Cardano" },
  { id: "TRX", label: "TRON" },
] as const;

export const NEWS_WINDOWS = [
  { id: 1, label: "1h" },
  { id: 6, label: "6h" },
  { id: 24, label: "24h" },
  { id: 24 * 7, label: "7d" },
  { id: 0, label: "All" },
] as const;

export function timeAgo(unixSeconds: number): string {
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
