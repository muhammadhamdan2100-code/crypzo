import { useEffect, useRef } from "react";

interface Props {
  symbol: string; // e.g. "CRYPTOCAP:TOTAL", "CRYPTOCAP:BTC.D"
  title: string;
  height?: number;
}

export function TradingViewMini({ symbol, title, height = 220 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      symbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange: "3M",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
      noTimeScale: false,
      chartOnly: false,
      trendLineColor: "rgba(34, 211, 238, 1)",
      underLineColor: "rgba(34, 211, 238, 0.15)",
      underLineBottomColor: "rgba(34, 211, 238, 0)",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          TradingView · 3M
        </span>
      </div>
      <div ref={ref} className="overflow-hidden rounded-xl" style={{ height }} />
    </div>
  );
}
