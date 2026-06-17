import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Plus, ReceiptText, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/Layout";
import { fetchMarkets, fmtPct, fmtUsd } from "@/lib/coingecko";
import { aggregatePositions, useTransactions, type Side } from "@/lib/transactions";
import { usePortfolios } from "@/lib/portfolios";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions & Realized P&L — Market Nova Pro" },
      { name: "description", content: "Log every crypto buy and sell, track realized profit & loss and cost basis." },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { data: markets } = useQuery({ queryKey: ["markets"], queryFn: () => fetchMarkets(100, 1), staleTime: 30_000, refetchInterval: 60_000 });
  const { activeId } = usePortfolios();
  const { txs, add, remove } = useTransactions(activeId);
  const [open, setOpen] = useState(false);

  const positions = useMemo(() => aggregatePositions(txs), [txs]);
  const totals = useMemo(() => {
    let invested = 0, marketValue = 0, realized = 0;
    for (const p of positions) {
      const px = markets?.find((m) => m.id === p.coinId)?.current_price ?? p.costBasis;
      invested += p.invested;
      marketValue += p.amount * px;
      realized += p.realizedPnl;
    }
    const unrealized = marketValue - invested;
    return { invested, marketValue, realized, unrealized, total: realized + unrealized };
  }, [positions, markets]);

  return (
    <AppLayout>
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] neon-glow">
          <ReceiptText className="h-5 w-5 text-[var(--primary-foreground)]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Buy/sell log with realized & unrealized P&L.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow"
        >
          <Plus className="h-4 w-4" /> Log trade
        </button>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Invested" value={fmtUsd(totals.invested)} />
        <Stat label="Market value" value={fmtUsd(totals.marketValue)} accent="neon" />
        <Stat
          label="Realized P&L"
          value={`${totals.realized >= 0 ? "+" : ""}${fmtUsd(totals.realized)}`}
          accent={totals.realized >= 0 ? "up" : "down"}
        />
        <Stat
          label="Unrealized P&L"
          value={`${totals.unrealized >= 0 ? "+" : ""}${fmtUsd(totals.unrealized)}`}
          sub={totals.invested ? fmtPct((totals.unrealized / totals.invested) * 100) : "—"}
          accent={totals.unrealized >= 0 ? "up" : "down"}
        />
      </section>

      <section className="glass mb-5 rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Open positions</h2>
        {positions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No positions yet. Log your first trade above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {positions.map((p) => {
              const px = markets?.find((m) => m.id === p.coinId)?.current_price ?? p.costBasis;
              const value = p.amount * px;
              const unreal = value - p.invested;
              const up = unreal >= 0;
              return (
                <li key={p.coinId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[auto_1.4fr_1fr_1fr_1fr]">
                  {p.image && <img src={p.image} alt="" className="h-9 w-9 rounded-full" />}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="num text-[11px] uppercase text-muted-foreground">
                      {p.amount.toFixed(6)} {p.symbol.toUpperCase()}
                    </div>
                  </div>
                  <div className="num hidden text-right text-xs text-muted-foreground sm:block">
                    Avg cost<br />
                    <span className="text-sm font-semibold text-foreground">{fmtUsd(p.costBasis)}</span>
                  </div>
                  <div className="num hidden text-right text-xs text-muted-foreground sm:block">
                    Value<br />
                    <span className="text-sm font-semibold text-foreground">{fmtUsd(value)}</span>
                  </div>
                  <div className={`num text-right text-sm font-bold ${up ? "text-[var(--success)]" : "text-destructive"}`}>
                    {up ? "+" : ""}{fmtUsd(unreal)}
                    <div className="text-[11px] font-medium">
                      Realized {p.realizedPnl >= 0 ? "+" : ""}{fmtUsd(p.realizedPnl)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">History</h2>
        {txs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {txs.map((t) => {
              const isBuy = t.side === "buy";
              return (
                <li key={t.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${isBuy ? "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]" : "bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)] text-destructive"}`}>
                    {isBuy ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {isBuy ? "Buy" : "Sell"} {t.symbol.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(t.executedAt).toLocaleString()}{t.notes ? ` · ${t.notes}` : ""}
                    </div>
                  </div>
                  <div className="num text-right text-xs">
                    <div className="text-sm font-semibold">{t.amount} @ {fmtUsd(t.price)}</div>
                    <div className="text-muted-foreground">Total {fmtUsd(t.amount * t.price)}</div>
                  </div>
                  <button onClick={() => remove(t.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {open && markets && (
        <TradeDialog coins={markets} onClose={() => setOpen(false)} onAdd={async (t) => { await add(t); setOpen(false); }} />
      )}
    </AppLayout>
  );
}

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

function TradeDialog({
  coins, onClose, onAdd,
}: {
  coins: { id: string; symbol: string; name: string; image: string; current_price: number }[];
  onClose: () => void;
  onAdd: (t: {
    coinId: string; symbol: string; name: string; image: string;
    side: Side; amount: number; price: number; fee: number;
    notes: string | null; executedAt: string;
  }) => void;
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
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md space-y-3 rounded-t-3xl p-5 sm:rounded-2xl">
        <h2 className="text-lg font-bold">Log trade</h2>

        <div className="grid grid-cols-2 gap-2">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-xl px-3 py-2.5 text-sm font-bold uppercase tracking-wider transition ${
                side === s
                  ? s === "buy"
                    ? "bg-[color-mix(in_oklab,var(--success)_22%,transparent)] text-[var(--success)] ring-1 ring-[var(--success)]"
                    : "bg-[color-mix(in_oklab,var(--destructive)_22%,transparent)] text-destructive ring-1 ring-destructive"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <Field label="Coin">
          <select
            value={coinId}
            onChange={(e) => {
              setCoinId(e.target.value);
              const c = coins.find((x) => x.id === e.target.value);
              if (c && !price) setPrice(c.current_price.toString());
            }}
            className="w-full rounded-xl border border-border bg-[oklch(0.18_0.025_265_/_0.6)] px-3 py-3 text-base font-semibold focus:border-[var(--neon-cyan)] focus:outline-none"
          >
            {coins.slice(0, 80).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Price (USD)">
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={coin?.current_price.toString() ?? "0.00"} inputMode="decimal" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fee (USD)">
            <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="When">
            <input type="datetime-local" value={executedAt} onChange={(e) => setExecutedAt(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Note (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="DCA, swing, etc." className={inputCls} />
        </Field>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold">Cancel</button>
          <button type="submit" className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow">
            Save trade
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "num w-full rounded-xl border border-border bg-[oklch(0.18_0.025_265_/_0.6)] px-3 py-3 text-base font-semibold focus:border-[var(--neon-cyan)] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
