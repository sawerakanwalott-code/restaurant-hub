import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bike,
  Clock,
  CreditCard,
  Flame,
  MessageCircle,
  QrCode,
  Star,
  TrendingUp,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  Bar as MiniBar,
  CHART,
  CHART_PALETTE,
  ColumnChart,
  DonutChart,
  EmptyRow,
  GaugeChart,
  GhostButton,
  GoldButton,
  Legendette,
  Money,
  Panel,
  PriorityTag,
  RevenueChart,
  SectionTitle,
  StatCard,
  StatusBadge,
  TrendLines,
} from "@/components/admin/bits";
import {
  hourlySeries,
  money,
  orderStats,
  paymentBreakdown,
  revenueSeries,
  riderLoad,
  statusBreakdown,
  timeAgo,
  topDishes,
  useAdmin,
} from "@/lib/admin-store";

import { readAccount } from "@/lib/auth";
import { readTenant, currentTenantSlug } from "@/lib/tenant";
import { redirect } from "@tanstack/react-router";
import { api, tokens } from "@/lib/api/client";
import { toast } from "sonner";

import { fetchWhatsAppStatus } from "@/lib/whatsapp";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  component: Dashboard,
});

// ── tiny hook: shared cached WA status ─────────────────────────────────────────
function useWaStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const tenantSlug = currentTenantSlug() || "moon-grill-narowal";
  useEffect(() => {
    let alive = true;
    let timer: any = null;

    const scheduleNext = (delayMs: number) => {
      if (!alive) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, delayMs);
    };

    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) {
        scheduleNext(30000);
        return;
      }
      if (!tokens.access()) return;

      try {
        const res = await fetchWhatsAppStatus(tenantSlug);
        if (alive) {
          setConnected(res.is_connected);
          setPhone(res.phone ?? null);
          scheduleNext(res.is_connected ? 120000 : 30000);
        }
      } catch {
        if (alive) {
          setConnected(false);
          scheduleNext(60000);
        }
      }
    };

    poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [tenantSlug]);
  return { connected, phone };
}

function Dashboard() {
  const tenant = readTenant();
  const currentRestaurant = tenant?.name || "Kennedy Moon Grill";
  const state = useAdmin();
  const stats = orderStats(state.orders);
  const series = revenueSeries(state.orders);
  const hours = hourlySeries(state.orders);
  const statuses = statusBreakdown(state.orders).filter((s) => s.count > 0);
  const payments = paymentBreakdown(state.orders);
  const dishes = topDishes(state.orders).slice(0, 5);
  const loads = riderLoad(state).sort((a, b) => b.active - a.active);
  const queue = state.orders
    .filter((o) => !["delivered", "cancelled"].includes(o.status))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);
  const maxDishRevenue = dishes[0]?.revenue ?? 1;
  const totalOrders = stats.delivered + stats.live;
  const fulfilment = totalOrders ? Math.round((stats.delivered / totalOrders) * 100) : 0;

  const { connected: waConnected, phone: waPhone } = useWaStatus();

  return (
    <div className="admin-dash-caddy space-y-6">
      <SectionTitle
        eyebrow={`${currentRestaurant} · Live Operations`}
        title="Dashboard"
        subtitle={`Every order, rupee and rider for ${currentRestaurant} in one calm, gold-trimmed view.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/orders">
              <GoldButton>Open order desk</GoldButton>
            </Link>
            <Link to="/admin/payments">
              <GhostButton>Verify payments</GhostButton>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Revenue verified"
          value={money(stats.revenue)}
          hint={`${money(stats.pending)} still to collect`}
          tone="gold"
          icon={<Wallet className="h-4 w-4" />}
          series={series.map((s) => s.revenue)}
        />
        <StatCard
          label="Live orders"
          value={stats.live}
          hint={`${stats.unassigned} waiting for a rider`}
          tone="flame"
          icon={<Flame className="h-4 w-4" />}
          series={series.map((s) => s.orders)}
        />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          hint={`${stats.cancelled} cancelled all-time`}
          tone="good"
          icon={<BadgeCheck className="h-4 w-4" />}
          series={series.map((s) => s.delivered ?? 0)}
        />
        <StatCard
          label="Average ticket"
          value={money(stats.avgOrder)}
          hint={`${stats.todayOrders} orders today · ${money(stats.todayRevenue)}`}
          tone="info"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* ── WhatsApp Gateway Status Banner ─────────────────────────────── */}
      <Link
        to="/admin/whatsapp"
        onClick={() => {
          if (waConnected === false) {
            toast.warning("WhatsApp not connected!", {
              description: "Click here to scan your QR code and connect your restaurant's WhatsApp.",
              duration: 5000,
            });
          }
        }}
        className={`group flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 shadow-lg transition-all hover:scale-[1.01] ${
          waConnected
            ? "border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50 hover:bg-emerald-950/30"
            : waConnected === null
            ? "border-[#2e2a24] bg-[#161413] hover:border-amber-500/30"
            : "border-amber-500/30 bg-amber-950/20 hover:border-amber-500/50 hover:bg-amber-950/30"
        }`}
      >
        {/* Left: icon + status */}
        <div className="flex items-center gap-3.5">
          <div
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border ${
              waConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            }`}
          >
            <MessageCircle className="h-5 w-5" />
            {waConnected === true && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#0e0d0b]">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            )}
            {waConnected === false && (
              <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-amber-400 opacity-75" />
            )}
          </div>
          <div>
            <p className={`text-sm font-bold ${waConnected ? "text-emerald-300" : "text-amber-300"}`}>
              {waConnected === null
                ? "Checking WhatsApp Gateway…"
                : waConnected
                ? "WhatsApp Gateway — Live & Connected"
                : "WhatsApp Gateway — Not Connected"}
            </p>
            <p className="text-[11px] text-[#7a6e5e]">
              {waConnected && waPhone
                ? `Linked: +${waPhone} · OTPs transmitting in real-time`
                : waConnected
                ? "OTPs transmitting in real-time"
                : "Scan QR code to enable WhatsApp OTPs for customers"}
            </p>
          </div>
        </div>

        {/* Right: pill button */}
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
            waConnected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 group-hover:bg-emerald-500/20"
              : "border-amber-500/40 bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25"
          }`}
        >
          <QrCode className="h-3.5 w-3.5" />
          {waConnected ? "Manage Gateway" : "Connect Now"}
        </div>
      </Link>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Revenue · last 14 days"
          subtitle="Champagne area is money, blue is order count"
          className="xl:col-span-2"
        >
          <RevenueChart data={series} height={300} />
        </Panel>

        <Panel title="Order pipeline" subtitle="Where every ticket sits right now">
          <DonutChart
            data={statuses.map((s, i) => ({
              name: s.label,
              value: s.count,
              color: CHART_PALETTE[i % CHART_PALETTE.length]!,
            }))}
            centerLabel="Tickets"
            centerValue={String(statuses.reduce((n, s) => n + s.count, 0))}
            height={210}
          />
          <div className="mt-3">
            <Legendette
              items={statuses.map((s, i) => ({
                name: s.label,
                value: String(s.count),
                color: CHART_PALETTE[i % CHART_PALETTE.length]!,
              }))}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Busy hours" subtitle="Orders by kitchen slot">
          <ColumnChart
            data={hours}
            xKey="hour"
            height={230}
            bars={[{ key: "orders", name: "Orders", color: CHART.amber }]}
          />
        </Panel>

        <Panel title="Payment mix" subtitle="Value collected per method">
          <ColumnChart
            data={payments}
            xKey="label"
            height={230}
            moneyFormat
            bars={[{ key: "amount", name: "Collected", color: CHART.jade }]}
          />
        </Panel>

        <Panel title="Delivery pace" subtitle="Orders placed vs delivered">
          <TrendLines
            data={series}
            xKey="day"
            height={230}
            lines={[
              { key: "orders", name: "Placed", color: CHART.lux },
              { key: "delivered", name: "Delivered", color: CHART.jade },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Live queue"
          subtitle="Newest tickets first"
          className="xl:col-span-2"
          action={
            <Link
              to="/admin/orders"
              className="eyebrow text-lux underline-offset-4 hover:underline"
            >
              See all
            </Link>
          }
          bodyClassName="p-2"
        >
          <div className="divide-y divide-line/50">
            {queue.map((o) => {
              const rider = state.riders.find((r) => r.id === o.riderId);
              return (
                <Link
                  key={o.id}
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="row-lux flex flex-wrap items-center gap-3 rounded-xl px-3 py-3"
                >
                  <div className="min-w-32">
                    <p className="num-lux text-sm text-lux">{o.code}</p>
                    <p className="text-[11px] text-slate-dim">{timeAgo(o.createdAt)}</p>
                  </div>
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-bold text-frost">{o.customer.name}</p>
                    <p className="text-[11px] text-slate-dim">
                      {o.items.length} item{o.items.length > 1 ? "s" : ""} · {o.address.area}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                  <PriorityTag priority={o.priority} />
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-mist">
                    <Bike className="h-3.5 w-3.5" />
                    {rider?.name ?? "Unassigned"}
                  </span>
                  <Money value={o.total} className="ml-auto text-lux" />
                </Link>
              );
            })}
            {queue.length === 0 ? <EmptyRow>Kitchen is clear.</EmptyRow> : null}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Fulfilment rate" subtitle="Delivered share of all tickets">
            <GaugeChart value={fulfilment} max={100} label="Delivered" />
          </Panel>

          <Panel title="Best sellers" subtitle="By revenue">
            <ul className="space-y-3">
              {dishes.map((d) => (
                <li key={d.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs font-bold">
                    <span className="text-frost">{d.name}</span>
                    <Money value={d.revenue} className="text-lux" />
                  </div>
                  <MiniBar value={d.revenue} max={maxDishRevenue} />
                  <p className="text-[11px] text-slate-dim">{d.qty} sold</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Rider load"
            subtitle="Active jobs per rider"
            action={
              <Link to="/admin/riders" className="eyebrow text-lux hover:underline">
                Manage
              </Link>
            }
          >
            <ul className="space-y-3">
              {loads.map(({ rider, active, delivered }) => (
                <li key={rider.id} className="flex items-center gap-3">
                  <span
                    className={
                      rider.status === "online"
                        ? "h-2 w-2 rounded-full bg-jade"
                        : rider.status === "busy"
                          ? "h-2 w-2 rounded-full bg-lux"
                          : "h-2 w-2 rounded-full bg-slate-dim/50"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-frost">{rider.name}</p>
                    <p className="text-[11px] text-slate-dim">
                      {rider.zone} · {delivered} delivered
                    </p>
                  </div>
                  <span className="num-lux text-base text-lux">{active}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Avg rating"
              value={stats.avgRating ? stats.avgRating.toFixed(1) : "—"}
              tone="info"
              icon={<Star className="h-4 w-4" />}
            />
            <StatCard
              label="To verify"
              value={stats.unverified}
              tone={stats.unverified ? "bad" : "good"}
              icon={<CreditCard className="h-4 w-4" />}
            />
          </div>
          <StatCard
            label="Promised ETA"
            value="35 min"
            hint="Average across live orders"
            icon={<Clock className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}
