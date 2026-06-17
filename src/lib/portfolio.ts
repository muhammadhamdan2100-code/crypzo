import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Holding {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  amount: number;
  buyPrice: number;
  portfolioId: string | null;
}

type Row = {
  id: string;
  coin_id: string;
  symbol: string;
  name: string;
  image: string | null;
  amount: number;
  buy_price: number;
  portfolio_id: string | null;
};

const fromRow = (r: Row): Holding => ({
  id: r.id,
  coinId: r.coin_id,
  symbol: r.symbol,
  name: r.name,
  image: r.image ?? "",
  amount: Number(r.amount),
  buyPrice: Number(r.buy_price),
  portfolioId: r.portfolio_id,
});

export function useHoldings(portfolioId?: string | null) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let q = supabase.from("holdings").select("*").order("created_at", { ascending: false });
    if (portfolioId) q = q.eq("portfolio_id", portfolioId);
    const { data } = await q;
    setHoldings(((data ?? []) as Row[]).map(fromRow));
    setLoading(false);
  }, [portfolioId]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`holdings-rt-${portfolioId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "holdings" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh, portfolioId]);

  const add = async (h: Omit<Holding, "id" | "portfolioId">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("holdings").insert({
      user_id: u.user.id,
      coin_id: h.coinId,
      symbol: h.symbol,
      name: h.name,
      image: h.image,
      amount: h.amount,
      buy_price: h.buyPrice,
      portfolio_id: portfolioId ?? null,
    });
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("holdings").delete().eq("id", id);
    refresh();
  };

  return { holdings, loading, add, remove };
}
