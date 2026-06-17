import { useEffect, useMemo, useRef } from "react";

// Coins we know are listed on Binance as USDT pairs.
const BINANCE_USDT = new Set([
  "btc","eth","sol","xrp","bnb","doge","ada","trx","ltc","link","dot","matic","avax",
  "atom","etc","xlm","bch","near","fil","apt","arb","op","sui","hbar","aave","uni",
  "mkr","sand","mana","ftm","icp","inj","rune","ldo","grt","stx","imx","tia","pepe",
  "shib","sei","jup","wld","tao","ondo","render","fet",
]);

function tvSymbol(symbol: string): string {
  const s = symbol.toLowerCase();
  if (BINANCE_USDT.has(s)) return `BINANCE:${s.toUpperCase()}USDT`;
  // Fallback to a broad spot market index
  return `CRYPTO:${s.toUpperCase()}USD`;
}

interface Props {
  symbol: string;
  interval?: "60" | "240" | "D" | "W";
  height?: number;
}

export function TradingViewChart({ symbol, interval = "60", height = 480 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const tvSym = useMemo(() => tvSymbol(symbol), [symbol]);

  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    container.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSym,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(15, 20, 35, 0.4)",
      gridColor: "rgba(80, 90, 120, 0.18)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      withdateranges: true,
      save_image: false,
      studies: ["STD;RSI", "STD;MACD"],
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [tvSym, interval]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container overflow-hidden rounded-xl border border-border"
      style={{ height }}
    />
  );
}
