import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Side = "buy" | "sell";

export interface Tx {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  side: Side;
  amount: number;
  price: number;
  fee: number;
  notes: string | null;
  executedAt: string;
  portfolioId: string | null;
}

type Row = {
  id: string;
  coin_id: string;
  symbol: string;
  name: string;
  image: string | null;
  side: Side;
  amount: number;
  price: number;
  fee: number;
  notes: string | null;
  executed_at: string;
  portfolio_id: string | null;
};

const fromRow = (r: Row): Tx => ({
  id: r.id,
  coinId: r.coin_id,
  symbol: r.symbol,
  name: r.name,
  image: r.image ?? "",
  side: r.side,
  amount: Number(r.amount),
  price: Number(r.price),
  fee: Number(r.fee),
  notes: r.notes,
  executedAt: r.executed_at,
  portfolioId: r.portfolio_id,
});

export function useTransactions(portfolioId?: string | null) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let q = supabase.from("transactions").select("*").order("executed_at", { ascending: false });
    if (portfolioId) q = q.eq("portfolio_id", portfolioId);
    const { data } = await q;
    setTxs(((data ?? []) as Row[]).map(fromRow));
    setLoading(false);
  }, [portfolioId]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`transactions-rt-${portfolioId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh, portfolioId]);

  const add = async (t: Omit<Tx, "id" | "portfolioId">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("transactions").insert({
      user_id: u.user.id,
      coin_id: t.coinId,
      symbol: t.symbol,
      name: t.name,
      image: t.image,
      side: t.side,
      amount: t.amount,
      price: t.price,
      fee: t.fee,
      notes: t.notes,
      executed_at: t.executedAt,
      portfolio_id: portfolioId ?? null,
    });
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    refresh();
  };

  return { txs, loading, add, remove };
}

export interface CoinPosition {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  amount: number;
  costBasis: number;
  invested: number;
  realizedPnl: number;
  feesPaid: number;
}

export function aggregatePositions(txs: Tx[]): CoinPosition[] {
  const map = new Map<string, CoinPosition>();
  const ordered = [...txs].sort((a, b) => +new Date(a.executedAt) - +new Date(b.executedAt));

  for (const t of ordered) {
    const key = t.coinId;
    const pos =
      map.get(key) ??
      {
        coinId: t.coinId,
        symbol: t.symbol,
        name: t.name,
        image: t.image,
        amount: 0,
        costBasis: 0,
        invested: 0,
        realizedPnl: 0,
        feesPaid: 0,
      };
    pos.feesPaid += t.fee;

    if (t.side === "buy") {
      const newAmount = pos.amount + t.amount;
      const newCost = pos.invested + t.amount * t.price + t.fee;
      pos.invested = newCost;
      pos.amount = newAmount;
      pos.costBasis = newAmount > 0 ? newCost / newAmount : 0;
    } else {
      const sellAmount = Math.min(t.amount, pos.amount);
      const proceeds = sellAmount * t.price - t.fee;
      const cost = sellAmount * pos.costBasis;
      pos.realizedPnl += proceeds - cost;
      pos.amount -= sellAmount;
      pos.invested = pos.amount * pos.costBasis;
    }
    pos.symbol = t.symbol;
    pos.name = t.name;
    pos.image = t.image || pos.image;
    map.set(key, pos);
  }

  return [...map.values()];
}

/** Performance series: portfolio cost basis over time from transactions (cumulative invested - realized). */
export function buildCostSeries(txs: Tx[]): { date: string; invested: number; realized: number }[] {
  const ordered = [...txs].sort((a, b) => +new Date(a.executedAt) - +new Date(b.executedAt));
  let invested = 0;
  let realized = 0;
  const positions = new Map<string, { amount: number; costBasis: number; invested: number }>();
  const out: { date: string; invested: number; realized: number }[] = [];
  for (const t of ordered) {
    const p = positions.get(t.coinId) ?? { amount: 0, costBasis: 0, invested: 0 };
    if (t.side === "buy") {
      const newAmt = p.amount + t.amount;
      const newInv = p.invested + t.amount * t.price + t.fee;
      p.costBasis = newAmt > 0 ? newInv / newAmt : 0;
      p.amount = newAmt;
      p.invested = newInv;
      invested += t.amount * t.price + t.fee;
    } else {
      const sellAmt = Math.min(t.amount, p.amount);
      const cost = sellAmt * p.costBasis;
      realized += sellAmt * t.price - t.fee - cost;
      p.amount -= sellAmt;
      p.invested = p.amount * p.costBasis;
      invested -= cost;
    }
    positions.set(t.coinId, p);
    out.push({ date: t.executedAt, invested, realized });
  }
  return out;
}
