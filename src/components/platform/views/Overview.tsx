import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Building2, Clock, LifeBuoy, MessageCircleOff, PlusCircle, Receipt, ShoppingBag, TrendingUp, Wallet, Zap } from "lucide-react";

import { usePlatform } from "../store";
import { ago, Avatar, Card, daysUntil, Kpi, num, PageHead, pkr, Progress, SampleBanner, SubPill } from "../ui";
import type { View } from "../nav";

export function Overview({ go, openTenant, onboard }: { go: (v: View) => void; openTenant: (slug: string) => void; onboard: () => void }) {
  const { stats, tenants, invoices, tickets, trend, audit, sources, plans } = usePlatform();

  const mrr = useMemo(() => {
    if (stats?.mrr_pkr) return stats.mrr_pkr;
    return tenants
      .filter((t) => t.subscription_status === "active")
      .reduce((a, t) => a + (plans.find((p) => p.slug === t.plan_slug)?.price_pkr ?? 0), 0);
  }, [stats, tenants, plans]);

  const alerts = useMemo(() => {
    const out: { tone: string; icon: typeof Clock; text: string; slug?: string; action?: () => void }[] = [];
    tenants.forEach((t) => {
      const d = daysUntil(t.trial_ends_at);
      if (t.subscription_status === "trialing" && d !== null && d <= 7) out.push({ tone: "yellow", icon: Clock, text: `${t.name}: trial ends in ${d} day${d === 1 ? "" : "s"}`, slug: t.slug });
      if (t.subscription_status === "past_due") out.push({ tone: "orange", icon: Wallet, text: `${t.name}: payment overdue`, slug: t.slug });
      if (t.whatsapp_connected === false && t.is_active) out.push({ tone: "red", icon: MessageCircleOff, text: `${t.name}: WhatsApp disconnected`, slug: t.slug });
      if (t.limits && t.orders_today / t.limits.orders_per_day > 0.85) out.push({ tone: "violet", icon: Zap, text: `${t.name}: near daily order limit`, slug: t.slug });
    });
    const review = invoices.filter((i) => i.status === "under_review").length;
    if (review) out.unshift({ tone: "blue", icon: Receipt, text: `${review} payment proof${review > 1 ? "s" : ""} waiting for review`, action: () => go("billing") });
    const urgent = tickets.filter((t) => t.status !== "resolved" && (t.priority === "urgent" || t.priority === "high")).length;
    if (urgent) out.unshift({ tone: "red", icon: LifeBuoy, text: `${urgent} urgent support request${urgent > 1 ? "s" : ""}`, action: () => go("support") });
    return out;
  }, [tenants, invoices, tickets, go]);

  const mix = stats
    ? [
        { name: "Active", value: stats.subscriptions.active, c: "var(--pf-blue)" },
        { name: "Trial", value: stats.subscriptions.trialing, c: "var(--pf-yellow)" },
        { name: "Past due", value: stats.subscriptions.past_due, c: "var(--pf-orange)" },
        { name: "Cancelled", value: stats.subscriptions.cancelled, c: "var(--pf-red)" },
      ]
    : [];

  const top = [...tenants].sort((a, b) => b.revenue_today - a.revenue_today).slice(0, 6);
  const atRisk = tenants.filter((t) => (t.health_score ?? 100) < 50 || t.subscription_status === "past_due");

  return (
    <>
      <PageHead
        title="Dashboard"
        crumb="Overview"
        actions={<button className="pf-btn pf-btn-primary" onClick={onboard}><PlusCircle className="h-4 w-4" /> Add restaurant</button>}
      />
      <SampleBanner source={sources.tenants} what="Restaurant list and numbers" />

      <div className="pf-kpis">
        <Kpi icon={Building2} tone="blue" value={num(stats?.tenants.total)} label="Restaurants" hint={<span className="pf-muted">{stats?.tenants.active ?? 0} live · {stats?.tenants.paused ?? 0} paused</span>} onClick={() => go("restaurants")} />
        <Kpi icon={TrendingUp} tone="green" value={pkr(mrr)} label="Monthly income" hint={<span style={{ color: "var(--pf-green)" }}>{pkr(mrr * 12)} / year</span>} onClick={() => go("plans")} />
        <Kpi icon={ShoppingBag} tone="yellow" value={num(stats?.orders.today)} label="Orders today" hint={<span className="pf-muted">{num(stats?.orders.total)} all time</span>} />
        <Kpi icon={Wallet} tone="orange" value={pkr(stats?.revenue_pkr.today)} label="Restaurant sales today" hint={<span className="pf-muted">{pkr(stats?.revenue_pkr.total)} all time</span>} />
        <Kpi icon={Receipt} tone="violet" value={num(stats?.pending_invoices_count)} label="Invoices to review" onClick={() => go("billing")} />
        <Kpi icon={LifeBuoy} tone="red" value={num(tickets.filter((t) => t.status !== "resolved").length)} label="Open support requests" onClick={() => go("support")} />
      </div>

      <div className="pf-grid-main">
        <Card title="Monthly income & orders" actions={<SourceTag s={sources.trend} />}>
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="pfMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pf-blue)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--pf-blue)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pfOrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pf-orange)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--pf-orange)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pf-line)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--pf-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="a" tick={{ fill: "var(--pf-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <YAxis yAxisId="b" orientation="right" hide />
                <Tooltip contentStyle={{ background: "var(--pf-surface)", border: "1px solid var(--pf-line)", borderRadius: 12, color: "var(--pf-text)" }} formatter={(v: number, n) => (n === "mrr" ? [pkr(v), "Income"] : [num(v), "Orders"])} />
                <Area yAxisId="a" type="monotone" dataKey="mrr" stroke="var(--pf-blue)" strokeWidth={2.5} fill="url(#pfMrr)" />
                <Area yAxisId="b" type="monotone" dataKey="orders" stroke="var(--pf-orange)" strokeWidth={2} fill="url(#pfOrd)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Needs your attention" actions={<span className="pf-pill tone-red">{alerts.length}</span>}>
          {alerts.length === 0 ? (
            <p className="pf-muted py-6 text-center text-sm">All clear — nothing needs you right now.</p>
          ) : (
            <ul className="space-y-2" style={{ maxHeight: 280, overflowY: "auto" }}>
              {alerts.map((a, i) => (
                <li key={i}>
                  <button
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-sm transition hover:bg-[var(--pf-bg)]"
                    style={{ borderLeft: `4px solid var(--pf-${a.tone})` }}
                    onClick={() => (a.slug ? openTenant(a.slug) : a.action?.())}
                  >
                    <a.icon className="h-4 w-4 shrink-0" style={{ color: `var(--pf-${a.tone})` }} />
                    <span>{a.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="pf-grid-main mt-[22px]">
        <Card title="Top restaurants today" actions={<button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => go("restaurants")}>View all</button>}>
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead><tr><th>Restaurant</th><th>Plan</th><th>Orders today</th><th>Sales today</th><th>Status</th></tr></thead>
              <tbody>
                {top.map((t) => (
                  <tr key={t.slug} className="clickable" onClick={() => openTenant(t.slug)}>
                    <td><div className="flex items-center gap-3"><Avatar name={t.name} /><div><b>{t.name}</b><div className="pf-muted text-xs">{t.city ?? t.slug}</div></div></div></td>
                    <td>{t.plan_name}</td>
                    <td>
                      <div className="w-28">
                        <div className="mb-1 text-xs">{num(t.orders_today)}{t.limits ? <span className="pf-muted"> / {t.limits.orders_per_day > 9999 ? "∞" : t.limits.orders_per_day}</span> : null}</div>
                        {t.limits ? <Progress value={t.orders_today} max={t.limits.orders_per_day} /> : null}
                      </div>
                    </td>
                    <td><b>{pkr(t.revenue_today)}</b></td>
                    <td><SubPill s={t.subscription_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Subscriptions">
          <div className="relative" style={{ height: 190 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={mix} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="none">
                  {mix.map((m) => <Cell key={m.name} fill={m.c} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div><div className="pf-display text-2xl font-bold">{stats?.tenants.total ?? 0}</div><div className="pf-muted text-xs">restaurants</div></div>
            </div>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {mix.map((m) => (
              <li key={m.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: m.c }} />{m.name}<b className="ml-auto">{m.value}</b></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="pf-grid-2 mt-[22px]">
        <Card title={<span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" style={{ color: "var(--pf-orange)" }} /> At risk of leaving</span>}>
          {atRisk.length === 0 ? <p className="pf-muted text-sm">No restaurants at risk.</p> : (
            <ul className="space-y-3">
              {atRisk.map((t) => (
                <li key={t.slug} className="flex cursor-pointer items-center gap-3" onClick={() => openTenant(t.slug)}>
                  <Avatar name={t.name} size={34} />
                  <div className="min-w-0 flex-1"><b className="text-sm">{t.name}</b><div className="pf-muted text-xs">Health {t.health_score ?? "—"} / 100 · {t.orders_today} orders today</div></div>
                  <SubPill s={t.subscription_status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" actions={<button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => go("audit")}>Full log</button>}>
          <ul className="space-y-3">
            {audit.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--pf-blue)" }} />
                <div className="min-w-0 flex-1"><b>{e.actor}</b> {e.action.toLowerCase()} <span className="pf-muted">· {e.target}</span></div>
                <span className="pf-muted shrink-0 text-xs">{ago(e.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export function SourceTag({ s }: { s?: "live" | "sample" }) {
  if (!s) return null;
  return s === "live" ? <span className="pf-pill tone-green">● Live</span> : <span className="pf-pill tone-yellow">Sample</span>;
}
