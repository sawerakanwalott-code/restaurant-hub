import { useEffect, useState } from "react";
import { Bell, Crown, LogOut, Menu, Moon, Search, Sun } from "lucide-react";

import { LockScreen, UNLOCK_KEY } from "./LockScreen";
import { NAV, type View } from "./nav";
import { usePlatform } from "./store";
import { TenantDrawer } from "./TenantDrawer";
import { OnboardModal } from "./OnboardModal";
import { Overview } from "./views/Overview";
import { Restaurants } from "./views/Restaurants";
import { Plans } from "./views/Plans";
import { Billing } from "./views/Billing";
import { Support } from "./views/Support";
import { Announcements } from "./views/Announcements";
import { Team } from "./views/Team";
import { Integrations } from "./views/Integrations";
import { Audit } from "./views/Audit";
import { Settings } from "./views/Settings";
import { Pill } from "./ui";

const AUTOLOCK_KEY = "kmg.platform.autolock";
const getAutoLockMin = () => Number(localStorage.getItem(AUTOLOCK_KEY) ?? 15);
const storeAutoLockMin = (n: number) => localStorage.setItem(AUTOLOCK_KEY, String(n));

export function Shell() {
  const { tickets, sources, loading, tenants, settings } = usePlatform();
  const [locked, setLocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) !== "1");
  const [view, setView] = useState<View>("overview");
  const [dark, setDark] = useState(() => localStorage.getItem("kmg.platform.dark") === "1");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [onboard, setOnboard] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [autoLockMin, setAutoLockState] = useState(15);
  const [lastActive] = useState(() => ({ current: Date.now() }));

  useEffect(() => {
    setAutoLockState(getAutoLockMin());
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("kmg.platform.dark", dark ? "1" : "0");
  }, [dark]);

  // Auto-lock on idle
  useEffect(() => {
    if (locked) return;
    const bump = () => (lastActive.current = Date.now());
    const evts = ["mousemove", "keydown", "click", "scroll"] as const;
    evts.forEach((e) => window.addEventListener(e, bump));
    const t = setInterval(() => {
      const min = getAutoLockMin();
      if (min && Date.now() - lastActive.current > min * 60_000) {
        sessionStorage.removeItem(UNLOCK_KEY);
        setLocked(true);
      }
    }, 30_000);
    return () => { evts.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [locked, lastActive]);

  const unlock = () => { lastActive.current = Date.now(); setLocked(false); };
  const openTenant = (slug: string) => { setDrawer(slug); setOnboard(false); };

  const q = search.trim().toLowerCase();
  const found = q ? tenants.filter((t) => `${t.name} ${t.slug} ${t.city}`.toLowerCase().includes(q)).slice(0, 6) : [];
  const openTickets = tickets.filter((t) => t.status !== "resolved").length;
  const label = NAV.flatMap((g) => g.items).find((i) => i.id === view)?.label ?? "";

  const body =
    loading && !tenants.length ? (
      <div className="pf-empty"><Crown className="pf-spin mx-auto mb-3 h-8 w-8" style={{ color: "var(--pf-blue)" }} />Loading your platform…</div>
    ) : (
      <>
        {view === "overview" && <Overview go={setView} openTenant={openTenant} onboard={() => setOnboard(true)} />}
        {view === "restaurants" && <Restaurants openTenant={openTenant} onboard={() => setOnboard(true)} />}
        {view === "plans" && <Plans />}
        {view === "billing" && <Billing />}
        {view === "support" && <Support openTenant={openTenant} />}
        {view === "announcements" && <Announcements />}
        {view === "team" && <Team />}
        {view === "integrations" && <Integrations openTenant={openTenant} />}
        {view === "audit" && <Audit />}
        {view === "settings" && <Settings autoLockMin={autoLockMin} setAutoLockMin={(n) => { storeAutoLockMin(n); setAutoLockState(n); }} />}
      </>
    );

  return (
    <div className={`pf ${dark ? "pf-dark" : ""}`}>
      {locked ? <LockScreen onUnlock={unlock} /> : null}

      <aside className={`pf-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="pf-brand">
          <span className="pf-brand-icon"><Crown className="h-5 w-5" /></span>
          <span className="truncate">{settings.platform_name}</span>
        </div>
        <nav>
          <ul className="pf-menu">
            {NAV.map((g) => (
              <div key={g.group}>
                <li className="pf-menu-label" aria-hidden>{g.group}</li>
                {g.items.map((it) => (
                  <li key={it.id} className={view === it.id ? "active" : ""}>
                    <button onClick={() => { setView(it.id); setMobileOpen(false); }} aria-current={view === it.id ? "page" : undefined}>
                      <it.icon className="h-5 w-5 shrink-0" />
                      <span className={collapsed ? "sr-only" : ""}>{it.label}</span>
                      {it.id === "support" && openTickets ? <span className="pf-menu-badge">{openTickets}</span> : null}
                    </button>
                  </li>
                ))}
              </div>
            ))}
            <li><button className="pf-logout" onClick={() => { sessionStorage.removeItem(UNLOCK_KEY); setLocked(true); }}>
              <LogOut className="h-5 w-5 shrink-0" /><span className={collapsed ? "sr-only" : ""}>Lock now</span>
            </button></li>
          </ul>
        </nav>
      </aside>

      <div className="pf-content">
        <header className="pf-topbar">
          <button className="pf-icon-btn" aria-label="Toggle menu" onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? setCollapsed(!collapsed) : setMobileOpen(true))}><Menu className="h-5 w-5" /></button>
          <div className="pf-search max-sm:hidden">
            <input aria-label="Search restaurants" placeholder="Search restaurants…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button aria-label="Search"><Search className="h-4 w-4" /></button>
            {found.length ? (
              <div className="pf-dropdown">
                {found.map((t) => (
                  <button key={t.slug} className="pf-dropdown-item" onClick={() => { openTenant(t.slug); setSearch(""); }}>
                    <Crown className="h-4 w-4 shrink-0" style={{ color: "var(--pf-blue)" }} />
                    <span className="truncate">{t.name} <span className="pf-muted">· {t.city ?? t.slug}</span></span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="pf-icon-btn" aria-label={dark ? "Light mode" : "Dark mode"} onClick={() => setDark(!dark)}>{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
            <div className="relative">
              <button className="pf-icon-btn" aria-label="Notifications" onClick={() => setNotifOpen(!notifOpen)}>
                <Bell className="h-5 w-5" /><span className="pf-dot">{openTickets}</span>
              </button>
              {notifOpen ? (
                <div className="pf-dropdown">
                  <p className="pf-muted px-3 py-2 text-xs font-bold uppercase">Notifications</p>
                  <button className="pf-dropdown-item" onClick={() => { setView("support"); setNotifOpen(false); }}>{openTickets} open support requests</button>
                  <button className="pf-dropdown-item" onClick={() => { setView("billing"); setNotifOpen(false); }}>Payment proofs to review</button>
                  <button className="pf-dropdown-item" onClick={() => { setView("integrations"); setNotifOpen(false); }}>Check connections</button>
                </div>
              ) : null}
            </div>
            <span className="pf-avatar tone-blue" aria-hidden>PO</span>
            <div className="max-md:hidden"><div className="text-sm font-bold">Platform Owner</div><Pill tone="grey">{label}</Pill></div>
          </div>
        </header>
        {mobileOpen ? <div className="pf-overlay lg:hidden" onClick={() => setMobileOpen(false)} /> : null}
        <main className="pf-main">{body}</main>
        {sources.tenants === "sample" ? (
          <footer className="pf-muted pb-8 text-center text-xs">Some panels run on sample data until the backend endpoints in do_backend.md exist.</footer>
        ) : null}
      </div>

      {drawer ? <TenantDrawer slug={drawer} onClose={() => setDrawer(null)} /> : null}
      {onboard ? <OnboardModal onClose={() => setOnboard(false)} /> : null}
    </div>
  );
}
