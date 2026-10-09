import { useMemo, useState } from "react";
import { ArrowDownUp, Download, PauseCircle, PlayCircle, PlusCircle, Search } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { PlatformTenant } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { Avatar, Card, daysUntil, downloadCsv, Empty, fmtDate, num, PageHead, pkr, Progress, SampleBanner, SubPill } from "../ui";

type Sort = "name" | "revenue" | "orders" | "created" | "health";

export function Restaurants({ openTenant, onboard }: { openTenant: (slug: string) => void; onboard: () => void }) {
  const { tenants, sources, mutate, set } = usePlatform();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("revenue");
  const [page, setPage] = useState(0);
  const PER = 10;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tenants.length, paused: tenants.filter((t) => !t.is_active).length };
    tenants.forEach((t) => (c[t.subscription_status] = (c[t.subscription_status] ?? 0) + 1));
    return c;
  }, [tenants]);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    const list = tenants.filter((t) => {
      const mq = !s || [t.name, t.slug, t.city, t.owner_name, t.owner_email].some((v) => v?.toLowerCase().includes(s));
      const ms = status === "all" || (status === "paused" ? !t.is_active : t.subscription_status === status);
      return mq && ms;
    });
    const by: Record<Sort, (a: PlatformTenant, b: PlatformTenant) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      revenue: (a, b) => b.revenue_total - a.revenue_total,
      orders: (a, b) => b.orders_today - a.orders_today,
      created: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      health: (a, b) => (a.health_score ?? 100) - (b.health_score ?? 100),
    };
    return list.sort(by[sort]);
  }, [tenants, q, status, sort]);

  const paged = rows.slice(page * PER, page * PER + PER);
  const pages = Math.max(1, Math.ceil(rows.length / PER));

  const toggle = (t: PlatformTenant) =>
    mutate({
      label: `${t.name} ${t.is_active ? "paused" : "is live again"}`,
      call: () => api.patch(PLATFORM.tenantDetail(t.slug), { is_active: !t.is_active }),
      local: () => set("tenants", (p) => p.map((x) => (x.slug === t.slug ? { ...x, is_active: !x.is_active } : x))),
      audit: { action: t.is_active ? "Paused restaurant" : "Resumed restaurant", target: t.name, category: "tenant" },
    });

  const chips: [string, string][] = [["all", "All"], ["active", "Active"], ["trialing", "Trial"], ["past_due", "Past due"], ["cancelled", "Cancelled"], ["paused", "Paused"]];

  return (
    <>
      <PageHead
        title="Restaurants"
        crumb="Restaurants"
        actions={<>
          <button className="pf-btn pf-btn-ghost" onClick={() => downloadCsv("restaurants", rows.map((t) => ({ name: t.name, slug: t.slug, city: t.city, owner: t.owner_name, email: t.owner_email, plan: t.plan_name, status: t.subscription_status, live: t.is_active, orders_total: t.orders_total, revenue_total: t.revenue_total, joined: t.created_at })))}><Download className="h-4 w-4" /> Export</button>
          <button className="pf-btn pf-btn-primary" onClick={onboard}><PlusCircle className="h-4 w-4" /> Add restaurant</button>
        </>}
      />
      <SampleBanner source={sources.tenants} what="The restaurant list" />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="pf-chips">
            {chips.map(([k, l]) => (
              <button key={k} className={`pf-chip ${status === k ? "on" : ""}`} onClick={() => { setStatus(k); setPage(0); }}>{l} · {counts[k] ?? 0}</button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pf-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input className="pf-input" style={{ paddingLeft: 36, width: 240 }} placeholder="Name, city, owner…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            </div>
            <div className="relative">
              <ArrowDownUp className="pf-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <select className="pf-select" style={{ paddingLeft: 36, width: 190 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="revenue">Highest sales</option>
                <option value="orders">Most orders today</option>
                <option value="health">Lowest health first</option>
                <option value="created">Newest</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>
        </div>

        {rows.length === 0 ? <Empty>No restaurants match.</Empty> : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead><tr><th>Restaurant</th><th>Owner</th><th>Plan</th><th>Renews / trial</th><th>Usage today</th><th>Sales (all time)</th><th>Health</th><th /></tr></thead>
              <tbody>
                {paged.map((t) => {
                  const end = t.subscription_status === "trialing" ? t.trial_ends_at : t.current_period_end;
                  const d = daysUntil(end);
                  return (
                    <tr key={t.slug} className="clickable" onClick={() => openTenant(t.slug)} style={{ opacity: t.is_active ? 1 : 0.6 }}>
                      <td><div className="flex items-center gap-3"><Avatar name={t.name} /><div><b>{t.name}</b><div className="pf-muted text-xs">{t.slug}{t.is_active ? "" : " · paused"}</div></div></div></td>
                      <td><div className="text-sm">{t.owner_name ?? "—"}</div><div className="pf-muted text-xs">{t.owner_phone ?? t.owner_email ?? ""}</div></td>
                      <td><div className="mb-1 text-sm font-bold">{t.plan_name}</div><SubPill s={t.subscription_status} /></td>
                      <td className="text-sm">{fmtDate(end)}{d !== null ? <div className="text-xs" style={{ color: d < 0 ? "var(--pf-red)" : d <= 5 ? "var(--pf-orange)" : "var(--pf-muted)" }}>{d < 0 ? `${-d}d overdue` : `in ${d}d`}</div> : null}</td>
                      <td><div className="w-28"><div className="mb-1 text-xs">{num(t.orders_today)} orders</div>{t.limits ? <Progress value={t.orders_today} max={t.limits.orders_per_day} /> : null}</div></td>
                      <td><b>{pkr(t.revenue_total)}</b></td>
                      <td><HealthBadge v={t.health_score} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className={`pf-btn pf-btn-sm ${t.is_active ? "pf-btn-danger" : "pf-btn-success"}`} onClick={() => toggle(t)}>
                          {t.is_active ? <><PauseCircle className="h-3.5 w-3.5" /> Pause</> : <><PlayCircle className="h-3.5 w-3.5" /> Resume</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm">
            <span className="pf-muted mr-2">Page {page + 1} of {pages}</span>
            <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        ) : null}
      </Card>
    </>
  );
}

export function HealthBadge({ v }: { v?: number }) {
  if (v == null) return <span className="pf-muted">—</span>;
  const tone = v >= 75 ? "green" : v >= 50 ? "yellow" : "red";
  return <span className={`pf-pill tone-${tone}`}>{v}</span>;
}
