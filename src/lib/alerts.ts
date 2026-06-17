import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export type AlertType =
  | "price_above"
  | "price_below"
  | "pct_change"
  | "volume_spike"
  | "volatility"
  | "market_crash"
  | "market_pump"
  | "news_keyword"
  | "watchlist_change";

export type AlertSeverity = "info" | "success" | "warning" | "critical";
export type ChannelKey = "in_app" | "push" | "email" | "telegram";

export interface AlertRule {
  id: string;
  user_id: string;
  type: AlertType;
  coin_id: string | null;
  symbol: string | null;
  name: string | null;
  image: string | null;
  condition: Record<string, unknown>;
  channels: ChannelKey[];
  is_active: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  trigger_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  alert_id: string | null;
  title: string;
  body: string;
  severity: AlertSeverity;
  coin_id: string | null;
  symbol: string | null;
  image: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface ChannelSettings {
  user_id: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  email_address: string | null;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
}

const db = () => supabase as any;

export function useAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["alerts", user?.id];

  const list = useQuery<AlertRule[]>({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db().from("alerts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as AlertRule[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (a: Partial<AlertRule> & { id?: string }) => {
      if (!user) throw new Error("auth");
      const row = { ...a, user_id: user.id };
      const { error } = a.id
        ? await db().from("alerts").update(row).eq("id", a.id)
        : await db().from("alerts").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db().from("alerts").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { alerts: list.data ?? [], isLoading: list.isLoading, upsert, toggle, remove };
}

export function useNotifications(limit = 50) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["notifications", user?.id];

  const q = useQuery<AppNotification[]>({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db()
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as AppNotification[];
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await db()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await db().from("notifications").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return { items, unread, isLoading: q.isLoading, markRead, markAllRead, clearAll };
}

export function useChannelSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["channel-settings", user?.id];

  const q = useQuery<ChannelSettings | null>({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db().from("alert_channel_settings").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data as ChannelSettings | null;
    },
  });

  const save = useMutation({
    mutationFn: async (s: Partial<ChannelSettings>) => {
      if (!user) throw new Error("auth");
      const { error } = await db()
        .from("alert_channel_settings")
        .upsert({ user_id: user.id, ...s }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { settings: q.data ?? null, save };
}

// --- Browser push (subscription only — server dispatch via VAPID is a follow-up) ---
export async function subscribeBrowserPush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, reason: "Push not supported" };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permission denied" };

  // Store the user so the cron can dispatch in-app notifications with the
  // same identifier; native Web Push (VAPID) can be wired later without
  // changing the rest of the alert pipeline.
  const endpoint = `local://${userId}/${navigator.userAgent.slice(0, 32)}`;
  const { error } = await db()
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, p256dh: "browser-local", auth: "browser-local", user_agent: navigator.userAgent },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
