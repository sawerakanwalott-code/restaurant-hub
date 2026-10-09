import { createFileRoute } from "@tanstack/react-router";
import { Download, Flame, ShoppingBag, TrendingUp, Wallet, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Bar, ColumnChart, Field, GoldButton, Panel, SegmentedTabs, StatCard, fieldClass } from "@/components/admin/bits";
import { PageHeader } from "@/components/admin/SampleNote";
import { money, PAYMENT_LABEL, useAdmin, type Order } from "@/lib/admin-store";

export const Route = createFileRoute("/admin/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sales Reports — Owner Console" },
      { name: "description", content: "Sales by day, best-selling dishes, busy hours and payment mix, with CSV export." },
      { property: "og:title", content: "Sales Reports — Owner Console" },
      { property: "og:description", content: "Sales, best sellers and busy hours with CSV export." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

type Range = "today" | "7" | "30" | "custom";
const dayMs = 86400_000;
const startOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

function ReportsPage() {
  const { orders } = useAdmin();
  const [range, setRange] = useState<Range>("7");
  const [from, setFrom] = useState(ymd(Date.now() - 7 * dayMs));
  const [to, setTo] = useState(ymd(Date.now()));

  const [a, b] = useMemo(() => {
    const now = Date.now();
    if (range === "today") return [startOf(now), now + 1];
    if (range === "custom") return [new Date(from).getTime(), new Date(to).getTime() + dayMs];
    return [startOf(now - (+range - 1) * dayMs), now + 1];
  }, [range, from, to]);

  const rows = useMemo(() => orders.filter((o) => o.createdAt >= a && o.createdAt < b), [orders, a, b]);
  const sold = rows.filter((o) => o.status !== "cancelled");
  const revenue = sold.reduce((s, o) => s + o.total, 0);
  const cancelled = rows.length - sold.length;
  const discounts = sold.reduce((s, o) => s + o.discount, 0);

  const byDay = useMemo(() => {
    const days = Math.max(1, Math.min(31, Math.ceil((b - a) / dayMs)));
    return Array.from({ length: days }, (_, i) => {
      const s = startOf(a) + i * dayMs;
      const r = sold.filter((o) => o.createdAt >= s && o.createdAt < s + dayMs);
      return { label: new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short" }), value: r.reduce((x, o) => x + o.total, 0) };
    });
  }, [sold, a, b]);

  const top = useMemo(() => {
    const m = new Map<string, { qty: number; sales: number }>();
    sold.forEach((o) => o.items.forEach((it) => {
      const cur = m.get(it.name) ?? { qty: 0, sales: 0 };
      m.set(it.name, { qty: cur.qty + it.qty, sales: cur.sales + it.qty * (it.price ?? 0) });
    }));
    return [...m.entries()].sort((x, y) => y[1].qty - x[1].qty).slice(0, 8);
  }, [sold]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => sold.filter((o) => new Date(o.createdAt).getHours() === h).length), [sold]);
  const peak = hours.indexOf(Math.max(...hours));
  const bySource = groupSum(sold, (o) => o.source);
  const byPay = groupSum(sold, (o) => PAYMENT_LABEL[o.payment.method]);

  const exportCsv = () => {
    const head = ["code", "date", "customer", "phone", "type", "source", "status", "payment", "payment_status", "subtotal", "delivery", "discount", "total"];
    const lines = rows.map((o) => [o.code, new Date(o.createdAt).toISOString(), o.customer.name, o.customer.phone, o.orderType, o.source, o.status, o.payment.method, o.payment.status, o.subtotal, o.delivery, o.discount, o.total]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = `sales-${ymd(a)}-to-${ymd(b - 1)}.csv`; el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Sales reports" sub="How the restaurant is doing — pick a period, then download for your accountant."
        actions={<GoldButton onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Download CSV</GoldButton>} />

      <div className="flex flex-wrap items-end gap-3">
        <SegmentedTabs value={range} onChange={setRange} options={[{ id: "today", label: "Today" }, { id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "custom", label: "Custom" }]} />
        {range === "custom" ? (
          <>
            <Field label="From"><input type="date" className={`${fieldClass} w-40`} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input type="date" className={`${fieldClass} w-40`} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales" value={money(revenue)} tone="gold" icon={<Wallet className="h-4 w-4" />} series={byDay.map((d) => d.value)} />
        <StatCard label="Orders" value={sold.length} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Average order" value={money(sold.length ? revenue / sold.length : 0)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Cancelled" value={cancelled} tone={cancelled ? "bad" : "good"} hint={`Discounts given ${money(discounts)}`} icon={<XCircle className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Sales by day" className="xl:col-span-2">
          <div className="h-64"><ColumnChart data={byDay} /></div>
        </Panel>
        <Panel title="Busy hours" subtitle={sold.length ? `Peak at ${peak}:00` : undefined}>
          <div className="flex h-48 items-end gap-0.5">
            {hours.map((c, h) => (
              <div key={h} title={`${h}:00 — ${c} orders`} className={`flex-1 rounded-t ${h === peak && c ? "bg-lux" : "bg-lux/25"}`} style={{ height: `${Math.max(3, (c / Math.max(...hours, 1)) * 100)}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-dim"><span>12am</span><span>12pm</span><span>11pm</span></div>
        </Panel>

        <Panel title="Best sellers" className="xl:col-span-2">
          {top.length === 0 ? <p className="text-sm text-slate-dim">No sales in this period.</p> : (
            <div className="space-y-3">
              {top.map(([name, v], i) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-center font-black text-lux">{i === 0 ? <Flame className="h-4 w-4" /> : i + 1}</span>
                  <span className="w-44 truncate text-frost">{name}</span>
                  <div className="flex-1"><Bar value={v.qty} max={top[0][1].qty} /></div>
                  <span className="w-12 text-right text-slate-dim">{v.qty}×</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Mix title="Where orders came from" data={bySource} />
          <Mix title="How customers paid" data={byPay} />
        </div>
      </div>
    </div>
  );
}

function groupSum(rows: Order[], key: (o: Order) => string) {
  const m = new Map<string, number>();
  rows.forEach((o) => m.set(key(o), (m.get(key(o)) ?? 0) + o.total));
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
}

function Mix({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <Panel title={title}>
      <div className="space-y-2">
        {data.length === 0 ? <p className="text-sm text-slate-dim">—</p> : data.map(([k, v]) => (
          <div key={k} className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="capitalize text-frost">{k}</span><span className="text-slate-dim">{money(v)}</span></div>
            <Bar value={v} max={max} tone="jade" />
          </div>
        ))}
      </div>
    </Panel>
  );
}
