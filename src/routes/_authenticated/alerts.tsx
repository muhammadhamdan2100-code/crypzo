import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Plus, Trash2, Zap, MessageSquare, Mail, Smartphone, Inbox, Settings } from "lucide-react";
import { AppLayout } from "@/components/Layout";
import { fetchMarkets, fmtUsd } from "@/lib/coingecko";
import {
  useAlerts, useNotifications, useChannelSettings, subscribeBrowserPush,
  type AlertType, type ChannelKey, type AlertRule,
} from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Crypto Alerts & Notifications — Market Nova Pro" },
      { name: "description", content: "Price, volume, volatility, market and news alerts delivered in-app, by push, email and Telegram." },
    ],
  }),
  component: AlertsPage,
});

const TYPE_LABEL: Record<AlertType, string> = {
  price_above: "Price above",
  price_below: "Price below",
  pct_change: "% change",
  volume_spike: "Volume spike",
  volatility: "Volatility",
  market_crash: "Market crash",
  market_pump: "Market pump",
  news_keyword: "News keyword",
  watchlist_change: "Watchlist change",
};

const TYPE_NEEDS_COIN: Record<AlertType, boolean> = {
  price_above: true, price_below: true, pct_change: true,
  volume_spike: true, volatility: true,
  market_crash: false, market_pump: false,
  news_keyword: false, watchlist_change: false,
};

function AlertsPage() {
  const { alerts, isLoading, upsert, toggle, remove } = useAlerts();
  const { items: history } = useNotifications(100);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [tab, setTab] = useState<"rules" | "history" | "channels">("rules");

  const active = alerts.filter((a) => a.is_active).length;
  const triggered = alerts.reduce((s, a) => s + (a.trigger_count || 0), 0);

  return (
    <AppLayout>
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] neon-glow">
          <Bell className="h-5 w-5 text-[var(--primary-foreground)]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">Real-time price, market, and news alerts.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setOpenCreate(true); }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow"
        >
          <Plus className="h-4 w-4" /> New alert
        </button>
      </header>

      <section className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Total" value={alerts.length.toString()} />
        <Stat label="Active" value={active.toString()} accent="neon" />
        <Stat label="Triggered" value={triggered.toString()} accent="up" />
      </section>

      <div className="mb-4 flex gap-1 rounded-xl bg-secondary p-1 text-sm font-semibold">
        {(["rules", "history", "channels"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 capitalize transition ${tab === t ? "bg-[image:var(--gradient-primary)] text-[var(--primary-foreground)]" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <section className="glass rounded-2xl p-4">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No alerts yet. Create your first one above.</p>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${a.is_active ? "bg-[color-mix(in_oklab,var(--neon-cyan)_22%,transparent)] text-[var(--neon-cyan)]" : "bg-secondary text-muted-foreground"}`}>
                    {a.image ? <img src={a.image} alt="" className="h-7 w-7 rounded-full" /> : <Zap className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {a.symbol ? a.symbol.toUpperCase() : "Market"} · {TYPE_LABEL[a.type]}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {describeCondition(a)} · {a.channels.join(", ")} · cooldown {a.cooldown_minutes}m
                    </div>
                  </div>
                  <button
                    onClick={() => toggle.mutate({ id: a.id, is_active: !a.is_active })}
                    className="rounded-lg border border-border bg-secondary p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Toggle"
                  >
                    {a.is_active ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this alert?")) remove.mutate(a.id); }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="glass rounded-2xl p-4">
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No alerts have fired yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((n) => (
                <li key={n.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
                    {n.image ? <img src={n.image} alt="" className="h-7 w-7 rounded-full" /> : <Inbox className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{n.title}</div>
                    <div className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "channels" && <ChannelsPanel />}

      {openCreate || editing ? (
        <CreateAlertDialog
          editing={editing}
          onClose={() => { setOpenCreate(false); setEditing(null); }}
          onSave={async (rule) => { await upsert.mutateAsync(rule); setOpenCreate(false); setEditing(null); }}
        />
      ) : null}
    </AppLayout>
  );
}

function describeCondition(a: AlertRule): string {
  const c = a.condition || {};
  switch (a.type) {
    case "price_above": return `≥ ${fmtUsd(Number(c.target))}`;
    case "price_below": return `≤ ${fmtUsd(Number(c.target))}`;
    case "pct_change": return `${c.direction ?? "any"} ${c.threshold ?? 0}% in ${c.window ?? "24h"}`;
    case "volume_spike": return `24h vol ≥ ${fmtUsd(Number(c.target_volume_usd))}`;
    case "volatility": return `|24h change| ≥ ${c.threshold_pct ?? 0}%`;
    case "market_crash": return `global cap drop ≥ ${c.threshold_pct ?? 5}%`;
    case "market_pump": return `global cap rise ≥ ${c.threshold_pct ?? 5}%`;
    case "news_keyword": return `keywords: ${((c.keywords as string[]) ?? []).join(", ") || "—"}`;
    case "watchlist_change": return `watchlist move ≥ ${c.threshold_pct ?? 5}%`;
  }
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "neon" | "up" }) {
  const color = accent === "neon" ? "neon-text" : accent === "up" ? "text-[var(--success)]" : "";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

// ---------- Create / edit dialog ----------

function CreateAlertDialog({ editing, onClose, onSave }: { editing: AlertRule | null; onClose: () => void; onSave: (r: Partial<AlertRule>) => void; }) {
  const { data: markets } = useQuery({ queryKey: ["markets"], queryFn: () => fetchMarkets(100, 1), staleTime: 60_000 });
  const [type, setType] = useState<AlertType>(editing?.type ?? "price_above");
  const [coinId, setCoinId] = useState<string>(editing?.coin_id ?? "bitcoin");
  const [target, setTarget] = useState<string>(String((editing?.condition as any)?.target ?? ""));
  const [thresholdPct, setThresholdPct] = useState<string>(String((editing?.condition as any)?.threshold ?? (editing?.condition as any)?.threshold_pct ?? "5"));
  const [window, setWindow] = useState<"1h" | "24h" | "7d">(((editing?.condition as any)?.window as any) ?? "24h");
  const [direction, setDirection] = useState<"up" | "down" | "any">(((editing?.condition as any)?.direction as any) ?? "any");
  const [volumeUsd, setVolumeUsd] = useState<string>(String((editing?.condition as any)?.target_volume_usd ?? ""));
  const [keywords, setKeywords] = useState<string>((((editing?.condition as any)?.keywords as string[]) ?? []).join(", "));
  const [channels, setChannels] = useState<ChannelKey[]>(editing?.channels ?? ["in_app"]);
  const [cooldown, setCooldown] = useState<string>(String(editing?.cooldown_minutes ?? 60));

  const coin = useMemo(() => markets?.find((m) => m.id === coinId), [markets, coinId]);
  const needsCoin = TYPE_NEEDS_COIN[type];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const condition: Record<string, any> = {};
    switch (type) {
      case "price_above":
      case "price_below":
        condition.target = parseFloat(target); break;
      case "pct_change":
        condition.threshold = parseFloat(thresholdPct); condition.window = window; condition.direction = direction; break;
      case "volume_spike":
        condition.target_volume_usd = parseFloat(volumeUsd); break;
      case "volatility":
      case "market_crash":
      case "market_pump":
      case "watchlist_change":
        condition.threshold_pct = parseFloat(thresholdPct); break;
      case "news_keyword":
        condition.keywords = keywords.split(",").map((k) => k.trim()).filter(Boolean); break;
    }
    onSave({
      id: editing?.id,
      type,
      coin_id: needsCoin ? coin?.id ?? null : null,
      symbol: needsCoin ? coin?.symbol ?? null : null,
      name: needsCoin ? coin?.name ?? null : null,
      image: needsCoin ? coin?.image ?? null : null,
      condition,
      channels: channels.length ? channels : ["in_app"],
      cooldown_minutes: Math.max(1, parseInt(cooldown) || 60),
      is_active: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md space-y-3 rounded-t-3xl p-5 sm:rounded-2xl">
        <h2 className="text-lg font-bold">{editing ? "Edit alert" : "New alert"}</h2>

        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as AlertType)} className={inputCls}>
            {(Object.keys(TYPE_LABEL) as AlertType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>

        {needsCoin && (
          <Field label="Coin">
            <select value={coinId} onChange={(e) => setCoinId(e.target.value)} className={inputCls}>
              {(markets ?? []).slice(0, 80).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()}) — {fmtUsd(c.current_price)}</option>
              ))}
            </select>
          </Field>
        )}

        {(type === "price_above" || type === "price_below") && (
          <Field label="Target price (USD)">
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={coin ? String(coin.current_price) : "0.00"} inputMode="decimal" className={inputCls} />
          </Field>
        )}

        {type === "pct_change" && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Window">
              <select value={window} onChange={(e) => setWindow(e.target.value as any)} className={inputCls}>
                <option value="1h">1h</option><option value="24h">24h</option><option value="7d">7d</option>
              </select>
            </Field>
            <Field label="Direction">
              <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className={inputCls}>
                <option value="any">Any</option><option value="up">Up</option><option value="down">Down</option>
              </select>
            </Field>
            <Field label="Threshold %">
              <input value={thresholdPct} onChange={(e) => setThresholdPct(e.target.value)} inputMode="decimal" className={inputCls} />
            </Field>
          </div>
        )}

        {type === "volume_spike" && (
          <Field label="24h volume threshold (USD)">
            <input value={volumeUsd} onChange={(e) => setVolumeUsd(e.target.value)} placeholder="1000000000" inputMode="decimal" className={inputCls} />
          </Field>
        )}

        {(type === "volatility" || type === "market_crash" || type === "market_pump" || type === "watchlist_change") && (
          <Field label="Threshold %">
            <input value={thresholdPct} onChange={(e) => setThresholdPct(e.target.value)} inputMode="decimal" className={inputCls} />
          </Field>
        )}

        {type === "news_keyword" && (
          <Field label="Keywords (comma-separated)">
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="hack, sec, etf" className={inputCls} />
          </Field>
        )}

        <Field label="Channels">
          <div className="grid grid-cols-4 gap-2">
            {(["in_app", "push", "email", "telegram"] as ChannelKey[]).map((c) => {
              const on = channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannels((cur) => on ? cur.filter((x) => x !== c) : [...cur, c])}
                  className={`rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${on ? "bg-[image:var(--gradient-primary)] text-[var(--primary-foreground)]" : "bg-secondary text-muted-foreground"}`}
                >
                  {c.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Cooldown (minutes)">
          <input value={cooldown} onChange={(e) => setCooldown(e.target.value)} inputMode="numeric" className={inputCls} />
        </Field>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-bold">Cancel</button>
          <button type="submit" className="flex-1 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-bold text-[var(--primary-foreground)] neon-glow">
            {editing ? "Save" : "Create alert"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- Channels panel ----------

function ChannelsPanel() {
  const { user } = useAuth();
  const { settings, save } = useChannelSettings();
  const [email, setEmail] = useState(settings?.email_address ?? user?.email ?? "");
  const [tg, setTg] = useState(settings?.telegram_chat_id ?? "");
  const [push, setPush] = useState(settings?.push_enabled ?? false);
  const [emailEnabled, setEmailEnabled] = useState(settings?.email_enabled ?? false);
  const [tgEnabled, setTgEnabled] = useState(settings?.telegram_enabled ?? false);
  const [msg, setMsg] = useState<string | null>(null);

  const enablePush = async () => {
    if (!user) return;
    const r = await subscribeBrowserPush(user.id);
    if (r.ok) { setPush(true); setMsg("Browser notifications enabled."); }
    else setMsg(r.reason ?? "Push not enabled.");
  };

  const handleSave = async () => {
    await save.mutateAsync({
      push_enabled: push,
      email_enabled: emailEnabled,
      email_address: email || null,
      telegram_enabled: tgEnabled,
      telegram_chat_id: tg || null,
    });
    setMsg("Saved.");
  };

  return (
    <section className="glass space-y-4 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        <Settings className="h-4 w-4" /> Notification channels
      </div>

      <ChannelRow icon={<Inbox className="h-4 w-4" />} title="In-app notifications" desc="Always on. Bell icon + alert history.">
        <span className="rounded-md bg-[color-mix(in_oklab,var(--success)_22%,transparent)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--success)]">Active</span>
      </ChannelRow>

      <ChannelRow icon={<Smartphone className="h-4 w-4" />} title="Browser push" desc="Get notified when this tab is open. Native web push (background) is being wired up — for now this enables the in-tab toast.">
        <button onClick={enablePush} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold">{push ? "Re-enable" : "Enable"}</button>
      </ChannelRow>

      <ChannelRow icon={<Mail className="h-4 w-4" />} title="Email" desc="Deliver alerts to your inbox.">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-44 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs" />
        <label className="flex items-center gap-1 text-[10px] font-bold uppercase">
          <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} /> on
        </label>
      </ChannelRow>

      <ChannelRow icon={<MessageSquare className="h-4 w-4" />} title="Telegram" desc="DM @BotFather → /newbot → message your bot → grab your chat_id from getUpdates.">
        <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="chat id" className="w-32 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs" />
        <label className="flex items-center gap-1 text-[10px] font-bold uppercase">
          <input type="checkbox" checked={tgEnabled} onChange={(e) => setTgEnabled(e.target.checked)} /> on
        </label>
      </ChannelRow>

      <div className="flex items-center justify-between pt-2">
        <p className="text-[11px] text-muted-foreground">{msg ?? "Channel-specific delivery requires connector setup; in-app + Telegram (with bot) work out of the box."}</p>
        <button onClick={handleSave} className="rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-bold text-[var(--primary-foreground)] neon-glow">Save</button>
      </div>
    </section>
  );
}

function ChannelRow({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_oklab,var(--neon-cyan)_22%,transparent)] text-[var(--neon-cyan)]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

const inputCls = "num w-full rounded-xl border border-border bg-[oklch(0.18_0.025_265_/_0.6)] px-3 py-2.5 text-sm font-semibold focus:border-[var(--neon-cyan)] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
