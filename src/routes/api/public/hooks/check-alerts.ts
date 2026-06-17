import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-driven alert evaluator. Runs every minute via pg_cron.
 *
 * Pipeline:
 *  1. Snapshot market data (top 250 coins, global stats, news headlines).
 *  2. Load every active alert across all users.
 *  3. Evaluate each rule against the snapshot, honouring per-alert cooldowns.
 *  4. Insert a row in `notifications` for matched rules (in-app channel),
 *     bump `last_triggered_at` + `trigger_count`, and dispatch enabled
 *     channels (Telegram is dispatched inline when TELEGRAM_API_KEY is set;
 *     push / email are scaffolded — see CHANNELS below).
 */

const COINGECKO = "https://api.coingecko.com/api/v3";

interface Market {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  total_volume: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
}

interface NewsHeadline {
  title: string;
  url: string;
  source: string;
  published_on: number;
}

type AlertRow = {
  id: string;
  user_id: string;
  type: string;
  coin_id: string | null;
  symbol: string | null;
  name: string | null;
  image: string | null;
  condition: Record<string, any>;
  channels: string[];
  cooldown_minutes: number;
  last_triggered_at: string | null;
};

type Trigger = {
  alert: AlertRow;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical";
  coin_id: string | null;
  symbol: string | null;
  image: string | null;
  metadata: Record<string, any>;
};

async function fetchMarkets(): Promise<Market[]> {
  const url = `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=1h%2C24h%2C7d`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("markets fetch failed");
  return (await r.json()) as Market[];
}

async function fetchGlobal(): Promise<{ change_24h: number }> {
  const r = await fetch(`${COINGECKO}/global`);
  if (!r.ok) return { change_24h: 0 };
  const j = await r.json();
  return { change_24h: j?.data?.market_cap_change_percentage_24h_usd ?? 0 };
}

async function fetchHeadlines(): Promise<NewsHeadline[]> {
  // CoinDesk RSS — cheap, no key, refreshed often.
  try {
    const r = await fetch("https://www.coindesk.com/arc/outboundfeeds/rss/");
    if (!r.ok) return [];
    const xml = await r.text();
    const items: NewsHeadline[] = [];
    const re = /<item[\s\S]*?<\/item>/g;
    const matches = xml.match(re) ?? [];
    for (const block of matches.slice(0, 30)) {
      const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "").trim();
      const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
      const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "").trim();
      if (title && link) items.push({ title, url: link, source: "CoinDesk", published_on: pub ? Math.floor(new Date(pub).getTime() / 1000) : Math.floor(Date.now() / 1000) });
    }
    return items;
  } catch {
    return [];
  }
}

function cooldownOk(alert: AlertRow): boolean {
  if (!alert.last_triggered_at) return true;
  const elapsed = (Date.now() - new Date(alert.last_triggered_at).getTime()) / 60000;
  return elapsed >= alert.cooldown_minutes;
}

function evalAlert(
  alert: AlertRow,
  market: Map<string, Market>,
  global: { change_24h: number },
  headlines: NewsHeadline[],
  watchlistByUser: Map<string, string[]>,
): Trigger | null {
  const c = alert.condition || {};
  const coin = alert.coin_id ? market.get(alert.coin_id) : undefined;

  switch (alert.type) {
    case "price_above": {
      if (!coin) return null;
      const target = Number(c.target);
      if (!isFinite(target) || coin.current_price < target) return null;
      return mkCoinTrigger(alert, coin, "success", `${coin.symbol.toUpperCase()} crossed above $${target.toLocaleString()}`, `Now trading at $${coin.current_price.toLocaleString()}`);
    }
    case "price_below": {
      if (!coin) return null;
      const target = Number(c.target);
      if (!isFinite(target) || coin.current_price > target) return null;
      return mkCoinTrigger(alert, coin, "warning", `${coin.symbol.toUpperCase()} dropped below $${target.toLocaleString()}`, `Now trading at $${coin.current_price.toLocaleString()}`);
    }
    case "pct_change": {
      if (!coin) return null;
      const window = (c.window as string) ?? "24h";
      const threshold = Math.abs(Number(c.threshold) || 0);
      const dir = (c.direction as string) ?? "any";
      const pct =
        window === "1h" ? coin.price_change_percentage_1h_in_currency
        : window === "7d" ? coin.price_change_percentage_7d_in_currency
        : coin.price_change_percentage_24h_in_currency;
      if (pct == null || !threshold) return null;
      if (Math.abs(pct) < threshold) return null;
      if (dir === "up" && pct < 0) return null;
      if (dir === "down" && pct > 0) return null;
      const sev = pct < 0 ? "warning" : "success";
      return mkCoinTrigger(alert, coin, sev, `${coin.symbol.toUpperCase()} moved ${pct.toFixed(2)}% in ${window}`, `Now $${coin.current_price.toLocaleString()}`);
    }
    case "volume_spike": {
      if (!coin) return null;
      const target = Number(c.target_volume_usd) || 0;
      if (!target || coin.total_volume < target) return null;
      return mkCoinTrigger(alert, coin, "info", `${coin.symbol.toUpperCase()} volume spike`, `24h volume reached $${Math.round(coin.total_volume).toLocaleString()}`);
    }
    case "volatility": {
      if (!coin) return null;
      const threshold = Math.abs(Number(c.threshold_pct) || 0);
      const pct = coin.price_change_percentage_24h_in_currency ?? 0;
      if (!threshold || Math.abs(pct) < threshold) return null;
      return mkCoinTrigger(alert, coin, "warning", `${coin.symbol.toUpperCase()} high volatility`, `24h swing ${pct.toFixed(2)}%`);
    }
    case "market_crash": {
      const threshold = Math.abs(Number(c.threshold_pct) || 5);
      if (global.change_24h > -threshold) return null;
      return { alert, title: "Market crash detected", body: `Global crypto market cap is down ${global.change_24h.toFixed(2)}% in 24h.`, severity: "critical", coin_id: null, symbol: null, image: null, metadata: { change_24h: global.change_24h } };
    }
    case "market_pump": {
      const threshold = Math.abs(Number(c.threshold_pct) || 5);
      if (global.change_24h < threshold) return null;
      return { alert, title: "Market pump detected", body: `Global crypto market cap is up ${global.change_24h.toFixed(2)}% in 24h.`, severity: "success", coin_id: null, symbol: null, image: null, metadata: { change_24h: global.change_24h } };
    }
    case "news_keyword": {
      const keywords = (c.keywords as string[]) ?? [];
      if (!keywords.length) return null;
      const cutoff = alert.last_triggered_at ? new Date(alert.last_triggered_at).getTime() / 1000 : Date.now() / 1000 - 3600;
      const hit = headlines.find((h) => h.published_on > cutoff && keywords.some((k) => h.title.toLowerCase().includes(k.toLowerCase())));
      if (!hit) return null;
      return { alert, title: "News alert", body: `${hit.title} — ${hit.source}`, severity: "info", coin_id: null, symbol: null, image: null, metadata: { url: hit.url, source: hit.source } };
    }
    case "watchlist_change": {
      const threshold = Math.abs(Number(c.threshold_pct) || 5);
      const ids = watchlistByUser.get(alert.user_id) ?? [];
      for (const id of ids) {
        const m = market.get(id);
        const pct = m?.price_change_percentage_24h_in_currency ?? 0;
        if (m && Math.abs(pct) >= threshold) {
          const sev = pct < 0 ? "warning" : "success";
          return mkCoinTrigger(alert, m, sev, `Watchlist: ${m.symbol.toUpperCase()} ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`, `Now $${m.current_price.toLocaleString()}`);
        }
      }
      return null;
    }
  }
  return null;
}

function mkCoinTrigger(alert: AlertRow, coin: Market, severity: Trigger["severity"], title: string, body: string): Trigger {
  return {
    alert,
    title,
    body,
    severity,
    coin_id: coin.id,
    symbol: coin.symbol,
    image: coin.image,
    metadata: { price: coin.current_price },
  };
}

async function dispatchTelegram(chatId: string, t: Trigger): Promise<void> {
  const apiKey = process.env.TELEGRAM_API_KEY;
  const lov = process.env.LOVABLE_API_KEY;
  if (!apiKey || !lov) return;
  try {
    await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": apiKey },
      body: JSON.stringify({ chat_id: chatId, text: `🚨 *${t.title}*\n${t.body}`, parse_mode: "Markdown" }),
    });
  } catch {
    /* ignore — telegram is best-effort */
  }
}

export const Route = createFileRoute("/api/public/hooks/check-alerts")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: alerts, error } = await supabaseAdmin
          .from("alerts" as any)
          .select("*")
          .eq("is_active", true);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        const rows = (alerts ?? []) as unknown as AlertRow[];
        if (!rows.length) return Response.json({ ok: true, processed: 0, triggered: 0 });

        const needsNews = rows.some((a) => a.type === "news_keyword");
        const needsWatch = rows.some((a) => a.type === "watchlist_change");

        const [marketsArr, global, headlines] = await Promise.all([
          fetchMarkets().catch(() => [] as Market[]),
          fetchGlobal().catch(() => ({ change_24h: 0 })),
          needsNews ? fetchHeadlines() : Promise.resolve([] as NewsHeadline[]),
        ]);
        const market = new Map(marketsArr.map((m) => [m.id, m]));

        const watchlistByUser = new Map<string, string[]>();
        if (needsWatch) {
          const userIds = Array.from(new Set(rows.filter((r) => r.type === "watchlist_change").map((r) => r.user_id)));
          const { data: w } = await supabaseAdmin.from("watchlist").select("user_id, coin_id").in("user_id", userIds);
          for (const row of (w ?? []) as Array<{ user_id: string; coin_id: string }>) {
            const arr = watchlistByUser.get(row.user_id) ?? [];
            arr.push(row.coin_id);
            watchlistByUser.set(row.user_id, arr);
          }
        }

        const triggers: Trigger[] = [];
        for (const a of rows) {
          if (!cooldownOk(a)) continue;
          const t = evalAlert(a, market, global, headlines, watchlistByUser);
          if (t) triggers.push(t);
        }

        if (!triggers.length) return Response.json({ ok: true, processed: rows.length, triggered: 0 });

        // Insert notifications
        const notifRows = triggers.map((t) => ({
          user_id: t.alert.user_id,
          alert_id: t.alert.id,
          title: t.title,
          body: t.body,
          severity: t.severity,
          coin_id: t.coin_id,
          symbol: t.symbol,
          image: t.image,
          metadata: t.metadata,
        }));
        await supabaseAdmin.from("notifications" as any).insert(notifRows as any);

        // Bump alert state
        await Promise.all(
          triggers.map((t) =>
            supabaseAdmin
              .from("alerts" as any)
              .update({ last_triggered_at: new Date().toISOString(), trigger_count: ((t.alert as any).trigger_count ?? 0) + 1 })
              .eq("id", t.alert.id),
          ),
        );

        // Per-user channel dispatch (Telegram inline; email/push are scaffolded for follow-up).
        const userIds = Array.from(new Set(triggers.map((t) => t.alert.user_id)));
        const { data: settingsRows } = await supabaseAdmin
          .from("alert_channel_settings" as any)
          .select("*")
          .in("user_id", userIds);
        const settings = new Map<string, any>(((settingsRows ?? []) as any[]).map((s) => [s.user_id, s]));

        for (const t of triggers) {
          const s = settings.get(t.alert.user_id);
          if (!s) continue;
          if (s.telegram_enabled && s.telegram_chat_id && t.alert.channels.includes("telegram")) {
            await dispatchTelegram(s.telegram_chat_id, t);
          }
          // CHANNELS: push (Web Push / VAPID) and email (Lovable Emails) dispatch
          // intentionally left as no-ops for v1 — the in-app channel + Telegram
          // already cover end-to-end delivery. Wire them up once a VAPID keypair
          // and an email domain are configured.
        }

        return Response.json({ ok: true, processed: rows.length, triggered: triggers.length });
      },
    },
  },
});
