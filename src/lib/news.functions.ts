import { createServerFn } from "@tanstack/react-start";

export interface NewsItem {
  id: string;
  guid: string;
  published_on: number; // unix seconds
  imageurl: string;
  title: string;
  url: string;
  body: string;
  source: string;
  source_info?: { name: string; img?: string };
  categories: string; // pipe-separated
}

const FEEDS: { name: string; url: string }[] = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/" },
  { name: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
];

function pick(re: RegExp, s: string): string {
  const m = s.match(re);
  return m ? m[1] : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Derive crypto category tags from headline + body so the UI filters still work.
const COIN_KEYWORDS: Array<[string, RegExp]> = [
  ["BTC", /\b(btc|bitcoin)\b/i],
  ["ETH", /\b(eth|ethereum|ether)\b/i],
  ["SOL", /\b(sol|solana)\b/i],
  ["XRP", /\b(xrp|ripple)\b/i],
  ["BNB", /\b(bnb|binance coin)\b/i],
  ["DOGE", /\b(doge|dogecoin)\b/i],
  ["ADA", /\b(ada|cardano)\b/i],
  ["TRX", /\b(trx|tron)\b/i],
];
const TOPIC_KEYWORDS: Array<[string, RegExp]> = [
  ["Trading", /\b(trading|trader|futures|spot|leverage)\b/i],
  ["Mining", /\b(mining|miner|hashrate|asic)\b/i],
  ["Exchange", /\b(exchange|binance|coinbase|kraken|okx|bybit)\b/i],
  ["Regulation", /\b(sec|regulation|regulator|lawsuit|court|congress|cftc)\b/i],
  ["Technology", /\b(protocol|upgrade|layer\s*2|zk|rollup|smart contract|development)\b/i],
  ["Market", /\b(market|price|rally|crash|surge|drop|all-time high|ath)\b/i],
  ["Blockchain", /\b(blockchain|on-chain|node|validator|consensus)\b/i],
];

function deriveCategories(title: string, body: string): string {
  const text = `${title} ${body}`;
  const tags: string[] = [];
  for (const [tag, re] of COIN_KEYWORDS) if (re.test(text)) tags.push(tag);
  for (const [tag, re] of TOPIC_KEYWORDS) if (re.test(text)) tags.push(tag);
  return tags.join("|");
}

function parseRss(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item\b[\s\S]*?<\/item>/g;
  const matches = xml.match(itemRegex) ?? [];
  for (const raw of matches) {
    const title = stripTags(pick(/<title[^>]*>([\s\S]*?)<\/title>/, raw));
    const link = stripTags(pick(/<link[^>]*>([\s\S]*?)<\/link>/, raw)) ||
      pick(/<link[^>]*href="([^"]+)"/, raw);
    const pubDate = pick(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/, raw) ||
      pick(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/, raw);
    const rawBody =
      pick(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/, raw) ||
      pick(/<description[^>]*>([\s\S]*?)<\/description>/, raw) ||
      pick(/<summary[^>]*>([\s\S]*?)<\/summary>/, raw);
    const body = stripTags(rawBody).slice(0, 400);

    // Image: media:content, media:thumbnail, enclosure, or <img> in body
    let image =
      pick(/<media:content[^>]*url="([^"]+)"/, raw) ||
      pick(/<media:thumbnail[^>]*url="([^"]+)"/, raw) ||
      pick(/<enclosure[^>]*url="([^"]+)"/, raw) ||
      pick(/<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/, raw) ||
      pick(/<img[^>]+src="([^"]+)"/, rawBody);
    image = decodeEntities(image);

    const guid = stripTags(pick(/<guid[^>]*>([\s\S]*?)<\/guid>/, raw)) || link;
    const ts = Math.floor((pubDate ? Date.parse(pubDate) : Date.now()) / 1000);
    if (!title || !link || Number.isNaN(ts)) continue;

    items.push({
      id: `${sourceName}:${guid}`,
      guid,
      published_on: ts,
      imageurl: image,
      title,
      url: link,
      body,
      source: sourceName,
      source_info: { name: sourceName },
      categories: deriveCategories(title, body),
    });
  }
  return items;
}

async function fetchOne(name: string, url: string, signal: AbortSignal): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      signal,
      headers: {
        accept: "application/rss+xml, application/xml, text/xml, */*",
        "user-agent": "Mozilla/5.0 MarketNovaPro/1.0",
      },
    });
    if (!res.ok) {
      console.warn(`[news] ${name} HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRss(xml, name);
  } catch (e) {
    console.warn(`[news] ${name} failed`, (e as Error).message);
    return [];
  }
}

export const fetchNewsAggregated = createServerFn({ method: "GET" }).handler(
  async (): Promise<NewsItem[]> => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    try {
      const results = await Promise.all(FEEDS.map((f) => fetchOne(f.name, f.url, ctrl.signal)));
      const merged = results.flat();
      // Sort newest first; cap to avoid huge payloads.
      merged.sort((a, b) => b.published_on - a.published_on);
      return merged.slice(0, 120);
    } finally {
      clearTimeout(timeout);
    }
  },
);
