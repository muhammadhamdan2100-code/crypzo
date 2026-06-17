import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Portfolio {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  goalAmount: number | null;
  goalTargetDate: string | null;
  goalNote: string | null;
}

type Row = {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  goal_amount: number | null;
  goal_target_date: string | null;
  goal_note: string | null;
};

const fromRow = (r: Row): Portfolio => ({
  id: r.id,
  name: r.name,
  color: r.color,
  isDefault: r.is_default,
  goalAmount: r.goal_amount == null ? null : Number(r.goal_amount),
  goalTargetDate: r.goal_target_date,
  goalNote: r.goal_note,
});

const STORE_KEY = "mnv:active-portfolio";

export function useActivePortfolioId() {
  const [id, setId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORE_KEY);
  });
  const update = useCallback((next: string | null) => {
    setId(next);
    if (typeof window !== "undefined") {
      if (next) localStorage.setItem(STORE_KEY, next);
      else localStorage.removeItem(STORE_KEY);
    }
  }, []);
  return [id, update] as const;
}

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useActivePortfolioId();

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("portfolios")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    const list = ((data ?? []) as Row[]).map(fromRow);
    setPortfolios(list);
    setLoading(false);
    if (list.length && (!activeId || !list.find((p) => p.id === activeId))) {
      setActiveId((list.find((p) => p.isDefault) ?? list[0]).id);
    }
  }, [activeId, setActiveId]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("portfolios-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolios" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const create = async (name: string, color = "#22d3ee") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("portfolios")
      .insert({ user_id: u.user.id, name, color, is_default: false })
      .select("*")
      .single();
    if (data) setActiveId((data as Row).id);
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("portfolios").delete().eq("id", id);
    if (activeId === id) setActiveId(null);
    refresh();
  };

  const update = async (id: string, patch: Partial<Pick<Portfolio, "name" | "color" | "goalAmount" | "goalTargetDate" | "goalNote">>) => {
    await supabase
      .from("portfolios")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.goalAmount !== undefined ? { goal_amount: patch.goalAmount } : {}),
        ...(patch.goalTargetDate !== undefined ? { goal_target_date: patch.goalTargetDate } : {}),
        ...(patch.goalNote !== undefined ? { goal_note: patch.goalNote } : {}),
      })
      .eq("id", id);
    refresh();
  };

  const active = portfolios.find((p) => p.id === activeId) ?? null;

  return { portfolios, active, activeId, setActiveId, loading, create, remove, update };
}
