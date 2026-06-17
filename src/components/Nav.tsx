import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, Bell, Calculator, LineChart, LogIn, LogOut, Newspaper, ReceiptText, Wallet } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { NotificationBell } from "@/components/NotificationBell";

const items = [
  { to: "/", label: "Market", icon: LineChart },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/portfolio", label: "Portfolio", icon: Wallet },
  { to: "/transactions", label: "Trades", icon: ReceiptText },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/calculators", label: "Tools", icon: Calculator },
] as const;

export function TopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[oklch(0.14_0.02_265_/_0.7)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)] neon-glow">
            <Activity className="h-4 w-4 text-[var(--primary-foreground)]" strokeWidth={3} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight">Market Nova</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest neon-text">
              Pro · Live Intelligence
            </span>
          </div>
        </Link>

        <nav className="hidden gap-1 md:flex">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: to === "/" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <div className="hidden text-right sm:block">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Signed in</div>
                <div className="max-w-[14ch] truncate text-xs font-semibold">{user.email}</div>
              </div>
              <button
                onClick={async () => { await signOut(); navigate({ to: "/" }); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] neon-glow"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[oklch(0.14_0.02_265_/_0.85)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            activeProps={{ className: "text-[var(--neon-cyan)]" }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
