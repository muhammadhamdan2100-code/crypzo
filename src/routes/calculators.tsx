import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calculator as CalcIcon, Coins, LineChart, Percent, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/Layout";
import { fetchMarkets, fmtUsd } from "@/lib/coingecko";

export const Route = createFileRoute("/calculators")({
  head: () => ({
    meta: [
      { title: "Crypto Calculators — Market Nova Pro" },
      { name: "description", content: "DCA, compound interest, profit & loss, and position size calculators for crypto investors." },
    ],
  }),
  component: CalculatorsPage,
});

type Tab = "pnl" | "dca" | "compound" | "position";

function CalculatorsPage() {
  const [tab, setTab] = useState<Tab>("pnl");
  const tabs: { id: Tab; label: string; icon: typeof CalcIcon }[] = [
    { id: "pnl", label: "Profit & Loss", icon: CalcIcon },
    { id: "dca", label: "DCA", icon: Coins },
    { id: "compound", label: "Compound", icon: LineChart },
    { id: "position", label: "Position size", icon: Shield },
  ];
  return (
    <AppLayout>
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] neon-glow">
          <CalcIcon className="h-5 w-5 text-[var(--primary-foreground)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calculators</h1>
          <p className="text-sm text-muted-foreground">Plan trades, run scenarios, size your risk.</p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              tab === id ? "bg-[image:var(--gradient-primary)] text-[var(--primary-foreground)] neon-glow" : "border border-border bg-secondary text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "pnl" && <PnL />}
      {tab === "dca" && <DCA />}
      {tab === "compound" && <Compound />}
      {tab === "position" && <PositionSize />}
    </AppLayout>
  );
}

// ---------- P&L ----------
function PnL() {
  const { data: coins } = useQuery({ queryKey: ["markets"], queryFn: () => fetchMarkets(100, 1), staleTime: 60_000 });
  const [coinId, setCoinId] = useState("bitcoin");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [qty, setQty] = useState("");
  const [feePct, setFeePct] = useState("0.1");
  const coin = coins?.find((c) => c.id === coinId);
  const result = useMemo(() => {
    const b = parseFloat(buy), s = parseFloat(sell), q = parseFloat(qty), fp = parseFloat(feePct) || 0;
    if (!b || !q) return null;
    const sellPrice = s || coin?.current_price || 0;
    const investment = b * q;
    const currentValue = sellPrice * q;
    const fees = (investment + currentValue) * (fp / 100);
    const pnl = currentValue - investment - fees;
    const roi = (pnl / investment) * 100;
    return { investment, currentValue, fees, pnl, roi, usedLive: !s };
  }, [buy, sell, qty, feePct, coin]);
  const positive = (result?.pnl ?? 0) >= 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <FieldLabel label="Coin">
          <select value={coinId} onChange={(e) => setCoinId(e.target.value)} className={inputCls}>
            {coins?.slice(0, 80).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>)}
          </select>
          {coin && <div className="mt-2 text-xs text-muted-foreground">Live price: <span className="num font-bold text-foreground">{fmtUsd(coin.current_price)}</span></div>}
        </FieldLabel>
        <NumField label="Buy price" value={buy} onChange={setBuy} suffix="USD" />
        <NumField label="Sell price (optional — uses live)" value={sell} onChange={setSell} suffix="USD" placeholder={coin?.current_price?.toString()} />
        <NumField label="Quantity" value={qty} onChange={setQty} suffix={coin?.symbol.toUpperCase()} />
        <NumField label="Fee per side" value={feePct} onChange={setFeePct} suffix="%" />
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          {positive ? <TrendingUp className="h-5 w-5 text-[var(--success)]" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
          <h2 className="text-sm font-bold uppercase tracking-widest">Result</h2>
          {result?.usedLive && <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Live</span>}
        </div>
        {!result ? <p className="text-sm text-muted-foreground">Enter buy price and quantity.</p> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Investment" value={fmtUsd(result.investment)} />
              <Stat label="Current value" value={fmtUsd(result.currentValue)} />
              <Stat label="Fees" value={fmtUsd(result.fees)} />
              <Stat label="ROI" value={`${result.roi >= 0 ? "+" : ""}${result.roi.toFixed(2)}%`} accent={positive ? "up" : "down"} />
            </div>
            <Hero positive={positive} label={positive ? "Net profit" : "Net loss"} value={fmtUsd(result.pnl)} />
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- DCA ----------
function DCA() {
  const [amount, setAmount] = useState("100");
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [periods, setPeriods] = useState("52");
  const [startPrice, setStartPrice] = useState("30000");
  const [endPrice, setEndPrice] = useState("60000");
  const [growthPct, setGrowthPct] = useState("0.4");

  const result = useMemo(() => {
    const a = parseFloat(amount), n = parseInt(periods), s = parseFloat(startPrice), e = parseFloat(endPrice), g = parseFloat(growthPct) / 100;
    if (!a || !n || !s || !e) return null;
    let coins = 0, invested = 0;
    for (let i = 0; i < n; i++) {
      // log-linear interpolation + per-period drift
      const t = n === 1 ? 1 : i / (n - 1);
      const price = s * Math.pow(e / s, t) * Math.pow(1 + g, i);
      coins += a / price;
      invested += a;
    }
    const finalValue = coins * (e * Math.pow(1 + g, n - 1));
    const avgCost = invested / coins;
    const pnl = finalValue - invested;
    const roi = (pnl / invested) * 100;
    return { coins, invested, avgCost, finalValue, pnl, roi };
  }, [amount, periods, startPrice, endPrice, growthPct]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <NumField label="Amount per buy" value={amount} onChange={setAmount} suffix="USD" />
        <FieldLabel label="Frequency">
          <div className="grid grid-cols-3 gap-2">
            {(["daily", "weekly", "monthly"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFreq(f)} className={`rounded-xl px-3 py-2 text-xs font-bold uppercase ${freq === f ? "bg-[image:var(--gradient-primary)] text-[var(--primary-foreground)]" : "bg-secondary text-muted-foreground"}`}>{f}</button>
            ))}
          </div>
        </FieldLabel>
        <NumField label="Number of buys" value={periods} onChange={setPeriods} />
        <NumField label="Start price" value={startPrice} onChange={setStartPrice} suffix="USD" />
        <NumField label="End price" value={endPrice} onChange={setEndPrice} suffix="USD" />
        <NumField label="Drift per period" value={growthPct} onChange={setGrowthPct} suffix="%" />
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest">DCA outcome</h2>
        {!result ? <p className="text-sm text-muted-foreground">Fill the inputs.</p> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total invested" value={fmtUsd(result.invested)} />
              <Stat label="Coins accumulated" value={result.coins.toFixed(6)} />
              <Stat label="Avg cost" value={fmtUsd(result.avgCost)} />
              <Stat label="Final value" value={fmtUsd(result.finalValue)} accent="neon" />
            </div>
            <Hero positive={result.pnl >= 0} label={result.pnl >= 0 ? "Profit" : "Loss"} value={`${result.pnl >= 0 ? "+" : ""}${fmtUsd(result.pnl)} · ${result.roi.toFixed(2)}%`} />
            <p className="text-[11px] text-muted-foreground">DCA frequency is informational — totals depend on buys × amount.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Compound ----------
function Compound() {
  const [principal, setPrincipal] = useState("1000");
  const [contribution, setContribution] = useState("100");
  const [rate, setRate] = useState("8");
  const [years, setYears] = useState("10");
  const [freq, setFreq] = useState("12"); // compounds/year

  const result = useMemo(() => {
    const P = parseFloat(principal) || 0;
    const C = parseFloat(contribution) || 0;
    const r = (parseFloat(rate) || 0) / 100;
    const t = parseFloat(years) || 0;
    const n = parseInt(freq) || 12;
    const N = n * t;
    const i = r / n;
    const fvPrincipal = P * Math.pow(1 + i, N);
    const fvContrib = i === 0 ? C * N : C * ((Math.pow(1 + i, N) - 1) / i);
    const total = fvPrincipal + fvContrib;
    const invested = P + C * N;
    const interest = total - invested;
    return { total, invested, interest, roi: invested ? (interest / invested) * 100 : 0 };
  }, [principal, contribution, rate, years, freq]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <NumField label="Starting principal" value={principal} onChange={setPrincipal} suffix="USD" />
        <NumField label="Contribution per period" value={contribution} onChange={setContribution} suffix="USD" />
        <NumField label="Annual rate" value={rate} onChange={setRate} suffix="%" />
        <NumField label="Years" value={years} onChange={setYears} />
        <FieldLabel label="Compounds per year">
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className={inputCls}>
            <option value="1">Annually</option>
            <option value="2">Semi-annually</option>
            <option value="4">Quarterly</option>
            <option value="12">Monthly</option>
            <option value="52">Weekly</option>
            <option value="365">Daily</option>
          </select>
        </FieldLabel>
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest">Future value</h2>
        <div className="space-y-3">
          <Hero positive value={fmtUsd(result.total)} label="Total in account" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Invested" value={fmtUsd(result.invested)} />
            <Stat label="Interest earned" value={fmtUsd(result.interest)} accent="up" />
            <Stat label="Growth" value={`${result.roi.toFixed(2)}%`} accent="neon" />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------- Position size ----------
function PositionSize() {
  const [equity, setEquity] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("50000");
  const [stop, setStop] = useState("48000");
  const [leverage, setLeverage] = useState("1");

  const result = useMemo(() => {
    const eq = parseFloat(equity), rp = parseFloat(riskPct), en = parseFloat(entry), st = parseFloat(stop), lv = parseFloat(leverage) || 1;
    if (!eq || !rp || !en || !st || en === st) return null;
    const riskUsd = eq * (rp / 100);
    const perUnitRisk = Math.abs(en - st);
    const units = riskUsd / perUnitRisk;
    const notional = units * en;
    const margin = notional / lv;
    const direction: "long" | "short" = en > st ? "long" : "short";
    return { riskUsd, perUnitRisk, units, notional, margin, direction };
  }, [equity, riskPct, entry, stop, leverage]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <NumField label="Account equity" value={equity} onChange={setEquity} suffix="USD" />
        <NumField label="Risk per trade" value={riskPct} onChange={setRiskPct} suffix="%" />
        <NumField label="Entry price" value={entry} onChange={setEntry} suffix="USD" />
        <NumField label="Stop-loss price" value={stop} onChange={setStop} suffix="USD" />
        <NumField label="Leverage" value={leverage} onChange={setLeverage} suffix="x" />
      </Card>
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Percent className="h-5 w-5 text-[var(--neon-cyan)]" />
          <h2 className="text-sm font-bold uppercase tracking-widest">Position</h2>
          {result && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${result.direction === "long" ? "bg-[color-mix(in_oklab,var(--success)_22%,transparent)] text-[var(--success)]" : "bg-[color-mix(in_oklab,var(--destructive)_22%,transparent)] text-destructive"}`}>{result.direction}</span>}
        </div>
        {!result ? <p className="text-sm text-muted-foreground">Fill the inputs.</p> : (
          <div className="space-y-3">
            <Hero positive value={result.units.toFixed(6)} label="Units to buy/sell" />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Max loss" value={fmtUsd(result.riskUsd)} accent="down" />
              <Stat label="Risk per unit" value={fmtUsd(result.perUnitRisk)} />
              <Stat label="Notional" value={fmtUsd(result.notional)} />
              <Stat label="Margin required" value={fmtUsd(result.margin)} accent="neon" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- shared ----------
function Card({ children }: { children: React.ReactNode }) {
  return <section className="glass space-y-3 rounded-2xl p-5">{children}</section>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" | "neon" }) {
  const color = accent === "up" ? "text-[var(--success)]" : accent === "down" ? "text-destructive" : accent === "neon" ? "neon-text" : "";
  return (
    <div className="rounded-xl border border-border bg-[oklch(0.18_0.025_265_/_0.4)] p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
function Hero({ value, label, positive }: { value: string; label: string; positive: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-[oklch(0.18_0.025_265_/_0.5)] p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-3xl font-bold ${positive ? "text-[var(--success)]" : "text-destructive"}`}>{value}</div>
    </div>
  );
}
function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function NumField({ label, value, onChange, suffix, placeholder }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; placeholder?: string }) {
  return (
    <FieldLabel label={label}>
      <div className="relative">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "0.00"} inputMode="decimal" className={inputCls} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{suffix}</span>}
      </div>
    </FieldLabel>
  );
}
const inputCls = "num w-full rounded-xl border border-border bg-[oklch(0.18_0.025_265_/_0.6)] px-3 py-3 text-base font-semibold text-foreground focus:border-[var(--neon-cyan)] focus:outline-none";
