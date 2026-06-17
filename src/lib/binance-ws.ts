import { useEffect, useMemo, useState } from "react";
import type { Coin } from "@/lib/coingecko";

// Map CoinGecko ids -> Binance USDT trading pairs.
// Curated list of the most-liquid USDT spot pairs on Binance.
export const BINANCE_PAIRS: Record<string, string> = {
  bitcoin: "btcusdt",
  ethereum: "ethusdt",
  solana: "solusdt",
  ripple: "xrpusdt",
  binancecoin: "bnbusdt",
  dogecoin: "dogeusdt",
  cardano: "adausdt",
  tron: "trxusdt",
  "shiba-inu": "shibusdt",
  litecoin: "ltcusdt",
  chainlink: "linkusdt",
  polkadot: "dotusdt",
  "matic-network": "maticusdt",
  "avalanche-2": "avaxusdt",
  cosmos: "atomusdt",
  "ethereum-classic": "etcusdt",
  stellar: "xlmusdt",
  "bitcoin-cash": "bchusdt",
  near: "nearusdt",
  filecoin: "filusdt",
  aptos: "aptusdt",
  arbitrum: "arbusdt",
  optimism: "opusdt",
  sui: "suiusdt",
  "hedera-hashgraph": "hbarusdt",
  aave: "aaveusdt",
  uniswap: "uniusdt",
  maker: "mkrusdt",
  "the-sandbox": "sandusdt",
  "decentraland": "manausdt",
  fantom: "ftmusdt",
  "internet-computer": "icpusdt",
  injective: "injusdt",
  thorchain: "runeusdt",
  "lido-dao": "ldousdt",
  "the-graph": "grtusdt",
  blockstack: "stxusdt",
  "immutable-x": "imxusdt",
  celestia: "tiausdt",
  pepe: "pepeusdt",
  sei: "seiusdt",
  "jupiter-exchange-solana": "jupusdt",
  "worldcoin-wld": "wldusdt",
  bittensor: "taousdt",
  ondo: "ondousdt",
  "render-token": "renderusdt",
  "fetch-ai": "fetusdt",
};

export interface LiveTick {
  pair: string;
  price: number;
  changePct: number;
  ts: number;
}

/**
 * Subscribes to Binance combined !ticker stream for the given pairs.
 * Auto-reconnects on disconnect with backoff and re-subscribes on pair changes.
 */
export function useBinanceTickers(pairs: string[]): Record<string, LiveTick> {
  const [ticks, setTicks] = useState<Record<string, LiveTick>>({});

  useEffect(() => {
    if (!pairs.length || typeof window === "undefined") return;
    const streams = pairs.map((p) => `${p}@ticker`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => {
        attempts = 0;
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg.data;
          if (!d?.s) return;
          const pair = String(d.s).toLowerCase();
          setTicks((prev) => ({
            ...prev,
            [pair]: {
              pair,
              price: parseFloat(d.c),
              changePct: parseFloat(d.P),
              ts: Date.now(),
            },
          }));
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        const backoff = Math.min(30_000, 1000 * 2 ** attempts++);
        retry = setTimeout(connect, backoff);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [pairs.join(",")]);

  return ticks;
}

/**
 * Overlay Binance live prices on a CoinGecko Coin[] (instant + sub-second).
 * Coins without a Binance pair pass through unchanged.
 */
export function useLivePrices(coins: Coin[] | undefined): Coin[] {
  const pairs = useMemo(() => {
    const set = new Set<string>();
    for (const c of coins ?? []) {
      const p = BINANCE_PAIRS[c.id];
      if (p) set.add(p);
    }
    return Array.from(set);
  }, [coins]);

  const ticks = useBinanceTickers(pairs);

  return useMemo(() => {
    if (!coins) return [];
    return coins.map((c) => {
      const pair = BINANCE_PAIRS[c.id];
      const live = pair ? ticks[pair] : undefined;
      return live
        ? { ...c, current_price: live.price, price_change_percentage_24h: live.changePct }
        : c;
    });
  }, [coins, ticks]);
}

/** Live single-coin price for the coin detail page. */
export function useLivePrice(coinId: string): LiveTick | undefined {
  const pair = BINANCE_PAIRS[coinId];
  const pairs = useMemo(() => (pair ? [pair] : []), [pair]);
  const ticks = useBinanceTickers(pairs);
  return pair ? ticks[pair] : undefined;
}
