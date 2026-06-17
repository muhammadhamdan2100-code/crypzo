import { useState, useRef, useEffect } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { useNotifications, type AlertSeverity } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";

const severityClass: Record<AlertSeverity, string> = {
  info: "bg-[color-mix(in_oklab,var(--neon-cyan)_18%,transparent)] text-[var(--neon-cyan)]",
  success: "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]",
  warning: "bg-[color-mix(in_oklab,#f59e0b_22%,transparent)] text-[#f59e0b]",
  critical: "bg-[color-mix(in_oklab,var(--destructive)_22%,transparent)] text-destructive",
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { items, unread, markRead, markAllRead, clearAll } = useNotifications(25);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center rounded-lg border border-border bg-secondary p-2 text-muted-foreground transition hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--destructive)] px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-bold">Notifications</div>
            <div className="flex gap-1">
              <button
                onClick={() => markAllRead.mutate()}
                disabled={!unread}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                aria-label="Mark all read"
                title="Mark all read"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => clearAll.mutate()}
                disabled={!items.length}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-30"
                aria-label="Clear all"
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                You're all caught up. Create an alert to start receiving notifications.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 transition ${n.read_at ? "opacity-60" : "bg-[oklch(0.18_0.025_265_/_0.35)]"}`}
                    onClick={() => !n.read_at && markRead.mutate(n.id)}
                  >
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${severityClass[n.severity]}`}>
                      {n.image ? (
                        <img src={n.image} alt="" className="h-7 w-7 rounded-full" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{n.title}</div>
                        <div className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{timeAgo(n.created_at)}</div>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
