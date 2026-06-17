import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown, Download, FileSpreadsheet, FileText, Goal, Pencil, Plus,
  Sheet, Target, Trash2, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppLayout } from "@/components/Layout";
import { fetchMarkets, fmtPct, fmtUsd } from "@/lib/coingecko";
import { useHoldings } from "@/lib/portfolio";
import { usePortfolios, type Portfolio } from "@/lib/portfolios";
import { aggregatePositions, buildCostSeries, useTransactions, type Side } from "@/lib/transactions";
import { exportCsv, exportPdf, exportXlsx } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Dashboard — Market Nova Pro" },
      { name: "description", content: "Investor-grade crypto portfolio: allocation, realized/unrealized P&L, goals, multi-portfolio, exports." },
    ],
  }),
  component: PortfolioPage,
});

const PIE_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#fb7185", "#facc15", "#4ade80", "#c084fc"];

function PortfolioPage() {
  const { portfolios, active, activeId, setActiveId, create, remove: removePortfolio, update } = usePortfolios();
  const { data: markets } = useQuery({ queryKey: ["markets"], queryFn: () => fetchMarkets(250, 1), staleTime: 30_000, refetchInterval: 60_000 });
  const { holdings, add: addHolding, remove: removeHolding } = useHoldings(activeId);
  const { txs, add: addTx, remove: removeTx } = useTransactions(activeId);

  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showNewPortfolio, setShowNewPortfolio] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const priceFor = (id: string) => markets?.find((m) => m.id === id)?.current_price;
  const change24For = (id: string) => markets?.find((m) => m.id === id)?.price_change_percentage_24h ?? 0;

  // Enriched holdings (live prices)
  const enrichedHoldings = useMemo(() => holdings.map((h) => {
    const px = priceFor(h.coinId) ?? h.buyPrice;
    const value = px * h.amount;
    const cost = h.buyPrice * h.amount;
    const pnl = value - cost;
    const roi = cost ? (pnl / cost) * 100 : 0;
    const day = change24For(h.coinId) / 100;
    const dayPnl = value - value / (1 + day);
    return { ...h, price: px, value, cost, pnl, roi, dayPnl, change24h: change24For(h.coinId) };
  }), [holdings, markets]);

  // Positions from transactions
  const positions = useMemo(() => aggregatePositions(txs), [txs]);
  const enrichedPositions = useMemo(() => positions.filter((p) => p.amount > 0.0000001).map((p) => {
    const px = priceFor(p.coinId) ?? p.costBasis;
    const value = px * p.amount;
    const unreal = value - p.invested;
    const roi = p.invested ? (unreal / p.invested) * 100 : 0;
    return { ...p, price: px, value, unreal, roi };
  }), [positions, markets]);

  // Asset universe: prefer positions; fall back to holdings
  const assets = enrichedPositions.length ? enrichedPositions.map((p) => ({
    coinId: p.coinId, symbol: p.symbol, name: p.name, image: p.image,
    amount: p.amount, cost: p.invested, value: p.value, pnl: p.unreal, roi: p.roi,
  })) : enrichedHoldings.map((h) => ({
    coinId: h.coinId, symbol: h.symbol, name: h.name, image: h.image,
    amount: h.amount, cost: h.cost, value: h.value, pnl: h.pnl, roi: h.roi,
  }));

  const totals = useMemo(() => {
    const invested = assets.reduce((s, a) => s + a.cost, 0);
    const marketValue = assets.reduce((s, a) => s + a.value, 0);
    const realized = positions.reduce((s, p) => s + p.realizedPnl, 0);
    const unrealized = marketValue - invested;
    const dayPnl = enrichedHoldings.reduce((s, h) => s + h.dayPnl, 0);
    return { invested, marketValue, realized, unrealized, dayPnl, totalPnl: realized + unrealized };
  }, [assets, positions, enrichedHoldings]);

  const best = assets.reduce<(typeof assets)[number] | null>((b, a) => (!b || a.roi > b.roi ? a : b), null);
  const worst = assets.reduce<(typeof assets)[number] | null>((w, a) => (!w || a.roi < w.roi ? a : w), null);

  // Allocation pie
  const allocation = useMemo(() => {
    const sorted = [...assets].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 9);
    const rest = sorted.slice(9);
    const data = top.map((a) => ({ name: a.symbol.toUpperCase(), value: a.value }));
    if (rest.length) data.push({ name: "Other", value: rest.reduce((s, r) => s + r.value, 0) });
    return data.filter((d) => d.value > 0);
  }, [assets]);

  // Performance series (cost basis over time + estimated value using current price)
  const perfSeries = useMemo(() => {
    const cost = buildCostSeries(txs);
    return cost.map((c) => {
      // approximate value at point = invested + realized (cost-basis approx). For richer chart we approximate value = invested + realized.
      return {
        t: new Date(c.date).getTime(),
        date: new Date(c.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        invested: c.invested,
        realized: c.realized,
      };
    });
  }, [txs]);

  // Monthly realized P&L from sells
  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    const sorted = [...txs].sort((a, b) => +new Date(a.executedAt) - +new Date(b.executedAt));
    // recompute per-tx realized using running avg cost
    const pos = new Map<string, { amount: number; cb: number }>();
    for (const t of sorted) {
      const p = pos.get(t.coinId) ?? { amount: 0, cb: 0 };
      const key = new Date(t.executedAt).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      if (t.side === "buy") {
        const newAmt = p.amount + t.amount;
        p.cb = newAmt > 0 ? (p.amount * p.cb + t.amount * t.price + t.fee) / newAmt : 0;
        p.amount = newAmt;
      } else {
        const sellAmt = Math.min(t.amount, p.amount);
        const r = sellAmt * t.price - t.fee - sellAmt * p.cb;
        m.set(key, (m.get(key) ?? 0) + r);
        p.amount -= sellAmt;
      }
      pos.set(t.coinId, p);
    }
    return [...m.entries()].map(([month, pnl]) => ({ month, pnl }));
  }, [txs]);

  const sortedHoldings = useMemo(() => [...assets].sort((a, b) => b.value - a.value), [assets]);

  // Exports
  const buildRows = () => {
    const holdingsRows = sortedHoldings.map((a) => ({
      coin: a.name, symbol: a.symbol.toUpperCase(),
      amount: a.amount, cost_basis_usd: round(a.cost), market_value_usd: round(a.value),
      pnl_usd: round(a.pnl), roi_pct: round(a.roi),
    }));
    const txRows = txs.map((t) => ({
      date: t.executedAt, side: t.side, coin: t.name, symbol: t.symbol.toUpperCase(),
      amount: t.amount, price_usd: t.price, fee_usd: t.fee, total_usd: round(t.amount * t.price),
      notes: t.notes ?? "",
    }));
    return { holdingsRows, txRows };
  };

  const handleCsv = () => {
    const { holdingsRows, txRows } = buildRows();
    exportCsv(`${active?.name ?? "portfolio"}-holdings.csv`, holdingsRows);
    exportCsv(`${active?.name ?? "portfolio"}-transactions.csv`, txRows);
    setExportOpen(false);
  };
  const handleXlsx = () => {
    const { holdingsRows, txRows } = buildRows();
    exportXlsx(`${active?.name ?? "portfolio"}.xlsx`, {
      Summary: [
        { metric: "Invested", value: round(totals.invested) },
        { metric: "Market value", value: round(totals.marketValue) },
        { metric: "Realized P&L", value: round(totals.realized) },
        { metric: "Unrealized P&L", value: round(totals.unrealized) },
        { metric: "Total P&L", value: round(totals.totalPnl) },
      ],
      Holdings: holdingsRows,
      Transactions: txRows,
    });
    setExportOpen(false);
  };
  const handlePdf = () => {
    const { holdingsRows, txRows } = buildRows();
    exportPdf({
      filename: `${active?.name ?? "portfolio"}.pdf`,
      title: `${active?.name ?? "Portfolio"} — Market Nova Pro`,
      subtitle: `Generated ${new Date().toLocaleString()}`,
      summary: [
        { label: "Invested", value: fmtUsd(totals.invested) },
        { label: "Market value", value: fmtUsd(totals.marketValue) },
        { label: "Realized P&L", value: fmtUsd(totals.realized) },
        { label: "Unrealized P&L", value: fmtUsd(totals.unrealized) },
        { label: "Total P&L", value: fmtUsd(totals.totalPnl) },
      ],
      tables: [
        {
          title: "Holdings",
          columns: ["Coin", "Symbol", "Amount", "Cost basis", "Value", "P&L", "ROI %"],
          rows: holdingsRows.map((h) => [h.coin, h.symbol, h.amount, fmtUsd(h.cost_basis_usd), fmtUsd(h.market_value_usd), fmtUsd(h.pnl_usd), `${h.roi_pct.toFixed(2)}%`]),
        },
        {
          title: "Transactions",
          columns: ["Date", "Side", "Coin", "Amount", "Price", "Fee", "Total"],
          rows: txRows.map((t) => [new Date(t.date).toLocaleString(), t.side.toUpperCase(), `${t.coin} (${t.symbol})`, t.amount, fmtUsd(t.price_usd), fmtUsd(t.fee_usd), fmtUsd(t.total_usd)]),
        },
      ],
    });
    setExportOpen(false);
  };

  const goalProgress = active?.goalAmount ? Math.min(100, (totals.marketValue / active.goalAmount) * 100) : null;

  return (
    <AppLayout>
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] neon-glow">
          <Wallet className="h-5 w-5 text-[var(--primary-foreground)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">Investor dashboard with live P&L, allocation and goals.</p>
        </div>
        <PortfolioSwitcher
          portfolios={portfolios}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={() => setShowNewPortfolio(true)}
          onDelete={(id) => removePortfolio(id)}
        />
        <div className="relative">
          <button onClick={() => setExportOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-semibold">
            <Download className="h-4 w-4" /> Export
          </button>
          {exportOpen && (
            <div className="glass absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl">
              <button onClick={handlePdf} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"><FileText className="h-4 w-4" /> PDF report</button>
              <button onClick={handleXlsx} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</button>
              <button onClick={handleCsv} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"><Sheet className="h-4 w-4" /> CSV</button>
            </div>
          )}
        </div>
        <button onClick={() => setShowTrade(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-3 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow">
          <Plus className="h-4 w-4" /> Log trade
        </button>
        <button onClick={() => setShowAddHolding(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add holding
        </button>
      </header>

      {/* Stats */}
      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Market value" value={fmtUsd(totals.marketValue)} accent="neon" />
        <Stat label="Invested" value={fmtUsd(totals.invested)} />
        <Stat label="Unrealized P&L" value={`${signed(totals.unrealized)}${fmtUsd(totals.unrealized)}`} sub={totals.invested ? fmtPct((totals.unrealized / totals.invested) * 100) : "—"} accent={totals.unrealized >= 0 ? "up" : "down"} />
        <Stat label="Realized P&L" value={`${signed(totals.realized)}${fmtUsd(totals.realized)}`} accent={totals.realized >= 0 ? "up" : "down"} />
        <Stat label="24h P&L" value={`${signed(totals.dayPnl)}${fmtUsd(totals.dayPnl)}`} accent={totals.dayPnl >= 0 ? "up" : "down"} />
      </section>

      {/* Goal */}
      <section className="glass mb-4 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary"><Target className="h-4 w-4 text-[var(--neon-cyan)]" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Portfolio goal</div>
            {active?.goalAmount ? (
              <>
                <div className="text-sm font-bold">
                  {fmtUsd(totals.marketValue)} / {fmtUsd(active.goalAmount)} ·{" "}
                  <span className="neon-text">{goalProgress!.toFixed(1)}%</span>
                  {active.goalTargetDate && <span className="text-muted-foreground"> · by {new Date(active.goalTargetDate).toLocaleDateString()}</span>}
                </div>
                {active.goalNote && <div className="text-xs text-muted-foreground">{active.goalNote}</div>}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Set a target value to track progress.</div>
            )}
          </div>
          <button onClick={() => setShowGoal(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold">
            <Pencil className="h-3.5 w-3.5" /> {active?.goalAmount ? "Edit goal" : "Set goal"}
          </button>
        </div>
        {goalProgress != null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${goalProgress}%` }} />
          </div>
        )}
      </section>

      {/* Charts grid */}
      <section className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="glass rounded-2xl p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest">Performance</h2>
            <span className="text-[10px] text-muted-foreground">Invested · Realized (USD)</span>
          </div>
          {perfSeries.length === 0 ? (
            <EmptyChart hint="Log trades to plot performance." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perfSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${shortNum(v)}`} />
                  <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }} formatter={(v: number) => fmtUsd(v)} />
                  <Area type="monotone" dataKey="invested" stroke="#22d3ee" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="realized" stroke="#a78bfa" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest">Allocation</h2>
          {allocation.length === 0 ? (
            <EmptyChart hint="Add holdings to see allocation." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {allocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }} formatter={(v: number) => fmtUsd(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
            {allocation.slice(0, 8).map((a, i) => (
              <div key={a.name} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="font-semibold">{a.name}</span>
                <span className="ml-auto num text-muted-foreground">{totals.marketValue ? `${((a.value / totals.marketValue) * 100).toFixed(1)}%` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best/worst + monthly */}
      <section className="mb-4 grid gap-3 lg:grid-cols-3">
        {best && <Mover label="Best performer" a={best} positive />}
        {worst && best && worst.coinId !== best.coinId && <Mover label="Worst performer" a={worst} positive={false} />}
        <div className="glass rounded-2xl p-4 lg:col-span-1">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest">Monthly realized P&L</h2>
          {monthly.length === 0 ? (
            <EmptyChart hint="Sell to realize gains." />
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${shortNum(v)}`} />
                  <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }} formatter={(v: number) => fmtUsd(v)} />
                  <Bar dataKey="pnl">
                    {monthly.map((m, i) => <Cell key={i} fill={m.pnl >= 0 ? "#34d399" : "#f87171"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Holdings */}
      <section className="glass mb-4 rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest">Asset breakdown</h2>
          <span className="text-[10px] text-muted-foreground">{sortedHoldings.length} assets</span>
        </div>
        {sortedHoldings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet. Add a holding or log a trade.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sortedHoldings.map((a) => {
              const pct = totals.marketValue ? (a.value / totals.marketValue) * 100 : 0;
              const up = a.pnl >= 0;
              const holdingMatch = enrichedHoldings.find((h) => h.coinId === a.coinId);
              return (
                <li key={a.coinId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[auto_1.4fr_1fr_1fr_1fr_auto]">
                  {a.image && <img src={a.image} className="h-9 w-9 rounded-full" alt="" />}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{a.name}</div>
                    <div className="num text-[11px] uppercase text-muted-foreground">{a.amount.toFixed(6)} {a.symbol.toUpperCase()} · {pct.toFixed(1)}%</div>
                  </div>
                  <div className="num hidden text-right text-xs sm:block">
                    Cost<br /><span className="text-sm font-semibold text-foreground">{fmtUsd(a.cost)}</span>
                  </div>
                  <div className="num hidden text-right text-xs sm:block">
                    Value<br /><span className="text-sm font-semibold text-foreground">{fmtUsd(a.value)}</span>
                  </div>
                  <div className={`num text-right text-sm font-bold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                    {signed(a.pnl)}{fmtUsd(a.pnl)}
                    <div className="text-[11px] font-medium">{fmtPct(a.roi)}</div>
                  </div>
                  {holdingMatch && (
                    <button onClick={() => removeHolding(holdingMatch.id)} className="hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive sm:block">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent transactions */}
      <section className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest">Transaction history</h2>
          <span className="text-[10px] text-muted-foreground">{txs.length} trades</span>
        </div>
        {txs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {txs.slice(0, 20).map((t) => {
              const isBuy = t.side === "buy";
              return (
                <li key={t.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2.5">
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold uppercase ${isBuy ? "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]" : "bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)] text-destructive"}`}>
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.name} <span className="text-muted-foreground">{t.symbol.toUpperCase()}</span></div>
                    <div className="text-[11px] text-muted-foreground">{new Date(t.executedAt).toLocaleString()}{t.notes ? ` · ${t.notes}` : ""}</div>
                  </div>
                  <div className="num text-right text-xs">
                    <div className="text-sm font-semibold">{t.amount} @ {fmtUsd(t.price)}</div>
                    <div className="text-muted-foreground">Total {fmtUsd(t.amount * t.price)}</div>
                  </div>
                  <button onClick={() => removeTx(t.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Dialogs */}
      {showAddHolding && markets && (
        <AddHoldingDialog
          coins={markets}
          onClose={() => setShowAddHolding(false)}
          onAdd={async (h) => { await addHolding(h); setShowAddHolding(false); }}
        />
      )}
      {showTrade && markets && (
        <TradeDialog
          coins={markets}
          onClose={() => setShowTrade(false)}
          onAdd={async (t) => { await addTx(t); setShowTrade(false); }}
        />
      )}
      {showNewPortfolio && (
        <NewPortfolioDialog onClose={() => setShowNewPortfolio(false)} onCreate={async (name, color) => { await create(name, color); setShowNewPortfolio(false); }} />
      )}
      {showGoal && active && (
        <GoalDialog portfolio={active} onClose={() => setShowGoal(false)} onSave={async (p) => { await update(active.id, p); setShowGoal(false); }} />
      )}
    </AppLayout>
  );
}

// ---------- UI bits ----------

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "up" | "down" | "neon" }) {
  const color = accent === "up" ? "text-[var(--success)]" : accent === "down" ? "text-destructive" : accent === "neon" ? "neon-text" : "";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="num mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Mover({ label, a, positive }: { label: string; a: { name: string; image: string; roi: number; pnl: number }; positive: boolean }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-4">
      {a.image && <img src={a.image} className="h-10 w-10 rounded-full" alt="" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {positive ? <TrendingUp className="h-3 w-3 text-[var(--success)]" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
          {label}
        </div>
        <div className="truncate text-sm font-semibold">{a.name}</div>
      </div>
      <div className={`num text-right text-base font-bold ${positive ? "text-[var(--success)]" : "text-destructive"}`}>
        {signed(a.roi)}{a.roi.toFixed(2)}%
        <div className="text-xs">{signed(a.pnl)}{fmtUsd(a.pnl)}</div>
      </div>
    </div>
  );
}

function EmptyChart({ hint }: { hint: string }) {
  return <div className="grid h-40 place-items-center text-sm text-muted-foreground"><Goal className="mr-2 inline h-4 w-4" />{hint}</div>;
}

function PortfolioSwitcher({ portfolios, activeId, onSelect, onNew, onDelete }: {
  portfolios: Portfolio[]; activeId: string | null;
  onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = portfolios.find((p) => p.id === activeId);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-bold">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: active?.color ?? "#22d3ee" }} />
        {active?.name ?? "Select"} <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="glass absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl p-1">
          {portfolios.map((p) => (
            <div key={p.id} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${p.id === activeId ? "bg-secondary" : ""}`}>
              <button onClick={() => { onSelect(p.id); setOpen(false); }} className="flex flex-1 items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <span className="font-semibold">{p.name}</span>
                {p.isDefault && <span className="ml-auto text-[10px] uppercase text-muted-foreground">default</span>}
              </button>
              {!p.isDefault && (
                <button onClick={() => onDelete(p.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          ))}
          <button onClick={() => { onNew(); setOpen(false); }} className="mt-1 flex w-full items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-2 py-2 text-sm font-bold text-[var(--primary-foreground)]">
            <Plus className="h-4 w-4" /> New portfolio
          </button>
        </div>
      )}
    </div>
  );
}

function NewPortfolioDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22d3ee");
  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold">New portfolio</h2>
      <FieldLabel label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Long-term holds" /></FieldLabel>
      <FieldLabel label="Color">
        <div className="flex gap-2">
          {["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa"].map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
          ))}
        </div>
      </FieldLabel>
      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold">Cancel</button>
        <button onClick={() => name.trim() && onCreate(name.trim(), color)} className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow">Create</button>
      </div>
    </Modal>
  );
}

function GoalDialog({ portfolio, onClose, onSave }: {
  portfolio: Portfolio; onClose: () => void;
  onSave: (p: { goalAmount: number | null; goalTargetDate: string | null; goalNote: string | null }) => void;
}) {
  const [amount, setAmount] = useState(portfolio.goalAmount?.toString() ?? "");
  const [date, setDate] = useState(portfolio.goalTargetDate ?? "");
  const [note, setNote] = useState(portfolio.goalNote ?? "");
  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold">Portfolio goal</h2>
      <FieldLabel label="Target value (USD)"><input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="100000" /></FieldLabel>
      <FieldLabel label="Target date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></FieldLabel>
      <FieldLabel label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Down-payment fund" /></FieldLabel>
      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold">Cancel</button>
        <button
          onClick={() => onSave({
            goalAmount: amount ? parseFloat(amount) : null,
            goalTargetDate: date || null,
            goalNote: note.trim() || null,
          })}
          className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow"
        >
          Save goal
        </button>
      </div>
    </Modal>
  );
}

function AddHoldingDialog({ coins, onClose, onAdd }: {
  coins: { id: string; symbol: string; name: string; image: string; current_price: number }[];
  onClose: () => void;
  onAdd: (h: { coinId: string; symbol: string; name: string; image: string; amount: number; buyPrice: number }) => void;
}) {
  const [coinId, setCoinId] = useState(coins[0]?.id ?? "bitcoin");
  const [amount, setAmount] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const coin = coins.find((c) => c.id === coinId);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coin) return;
    const a = parseFloat(amount), b = parseFloat(buyPrice);
    if (!a || !b) return;
    onAdd({ coinId: coin.id, symbol: coin.symbol, name: coin.name, image: coin.image, amount: a, buyPrice: b });
  };
  return (
    <Modal onClose={onClose} form onSubmit={submit}>
      <h2 className="text-lg font-bold">Add holding</h2>
      <FieldLabel label="Coin">
        <select value={coinId} onChange={(e) => { setCoinId(e.target.value); const c = coins.find(x => x.id === e.target.value); if (c && !buyPrice) setBuyPrice(c.current_price.toString()); }} className={inputCls}>
          {coins.slice(0, 100).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>)}
        </select>
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className={inputCls} /></FieldLabel>
        <FieldLabel label="Avg buy price"><input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder={coin?.current_price.toString() ?? "0"} inputMode="decimal" className={inputCls} /></FieldLabel>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold">Cancel</button>
        <button type="submit" className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow">Add</button>
      </div>
    </Modal>
  );
}

function TradeDialog({ coins, onClose, onAdd }: {
  coins: { id: string; symbol: string; name: string; image: string; current_price: number }[];
  onClose: () => void;
  onAdd: (t: { coinId: string; symbol: string; name: string; image: string; side: Side; amount: number; price: number; fee: number; notes: string | null; executedAt: string }) => void;
}) {
  const [coinId, setCoinId] = useState(coins[0]?.id ?? "bitcoin");
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().slice(0, 16));
  const coin = coins.find((c) => c.id === coinId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coin) return;
    const a = parseFloat(amount), p = parseFloat(price), f = parseFloat(fee) || 0;
    if (!a || !p) return;
    onAdd({
      coinId: coin.id, symbol: coin.symbol, name: coin.name, image: coin.image,
      side, amount: a, price: p, fee: f,
      notes: notes.trim() || null,
      executedAt: new Date(executedAt).toISOString(),
    });
  };

  return (
    <Modal onClose={onClose} form onSubmit={submit}>
      <h2 className="text-lg font-bold">Log trade</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)} className={`rounded-xl px-3 py-2.5 text-sm font-bold uppercase tracking-wider transition ${
            side === s ? s === "buy"
              ? "bg-[color-mix(in_oklab,var(--success)_22%,transparent)] text-[var(--success)] ring-1 ring-[var(--success)]"
              : "bg-[color-mix(in_oklab,var(--destructive)_22%,transparent)] text-destructive ring-1 ring-destructive"
            : "bg-secondary text-muted-foreground"}`}>{s}</button>
        ))}
      </div>
      <FieldLabel label="Coin">
        <select value={coinId} onChange={(e) => { setCoinId(e.target.value); const c = coins.find((x) => x.id === e.target.value); if (c && !price) setPrice(c.current_price.toString()); }} className={inputCls}>
          {coins.slice(0, 100).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>)}
        </select>
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Amount"><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className={inputCls} /></FieldLabel>
        <FieldLabel label="Price (USD)"><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={coin?.current_price.toString() ?? "0"} inputMode="decimal" className={inputCls} /></FieldLabel>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Fee (USD)"><input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className={inputCls} /></FieldLabel>
        <FieldLabel label="When"><input type="datetime-local" value={executedAt} onChange={(e) => setExecutedAt(e.target.value)} className={inputCls} /></FieldLabel>
      </div>
      <FieldLabel label="Note (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="DCA, swing, etc." /></FieldLabel>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold">Cancel</button>
        <button type="submit" className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow">Save trade</button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, form, onSubmit }: { children: React.ReactNode; onClose: () => void; form?: boolean; onSubmit?: (e: React.FormEvent) => void }) {
  const inner = (
    <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md space-y-3 rounded-t-3xl p-5 sm:rounded-2xl">
      {children}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      {form ? <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md space-y-3 rounded-t-3xl p-5 sm:rounded-2xl">{children}</form> : inner}
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

const inputCls = "num w-full rounded-xl border border-border bg-[oklch(0.18_0.025_265_/_0.6)] px-3 py-3 text-base font-semibold focus:border-[var(--neon-cyan)] focus:outline-none";

function round(n: number) { return Math.round(n * 100) / 100; }
function signed(n: number) { return n > 0 ? "+" : ""; }
function shortNum(n: number) { return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n); }
