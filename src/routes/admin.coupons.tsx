import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent, Plus, Ticket, Trash2, Truck, X } from "lucide-react";
import { useState } from "react";

import { Bar, DangerButton, Field, GhostButton, GoldButton, Panel, StatCard, fieldClass } from "@/components/admin/bits";
import { PageHeader, SampleNote, Switch } from "@/components/admin/SampleNote";
import { api } from "@/lib/api/client";
import { ADMIN_EXTRA, sampleCoupons, useAdminResource, type Coupon } from "@/lib/admin-extras";

export const Route = createFileRoute("/admin/coupons")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Coupons & Offers — Owner Console" },
      { name: "description", content: "Create discount codes, free-delivery offers and usage limits." },
      { property: "og:title", content: "Coupons & Offers — Owner Console" },
      { property: "og:description", content: "Create discount codes and track how often they're used." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CouponsPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): Coupon => ({
  id: `new-${Date.now()}`, code: "", kind: "percent", value: 10, min_order: 0, max_discount: null,
  uses: 0, max_uses: null, per_customer: 1, starts: today(), ends: today(), active: true,
});

const describe = (c: Coupon) =>
  c.kind === "percent" ? `${c.value}% off${c.max_discount ? ` (max Rs ${c.max_discount})` : ""}` : c.kind === "flat" ? `Rs ${c.value} off` : "Free delivery";

const isLive = (c: Coupon) => c.active && c.ends >= today() && (c.max_uses === null || c.uses < c.max_uses);

function CouponsPage() {
  const { data, sample, mutate } = useAdminResource<Coupon[]>(ADMIN_EXTRA.coupons, sampleCoupons);
  const [edit, setEdit] = useState<Coupon | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const live = data.filter(isLive).length;
  const totalUses = data.reduce((s, c) => s + c.uses, 0);

  const save = async (c: Coupon) => {
    const isNew = c.id.startsWith("new-");
    const ok = await mutate(
      isNew ? `Coupon ${c.code} created` : `Coupon ${c.code} updated`,
      () => (isNew ? api.post(ADMIN_EXTRA.coupons, c) : api.patch(ADMIN_EXTRA.coupon(c.id), c)),
      (prev) => (isNew ? [c, ...prev] : prev.map((x) => (x.id === c.id ? c : x))),
    );
    if (ok) setEdit(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Marketing" title="Coupons & offers" sub="Codes customers type at checkout. Limits are checked automatically."
        actions={<GoldButton onClick={() => setEdit(blank())}><Plus className="h-4 w-4" /> New coupon</GoldButton>} />
      <SampleNote show={sample} what="Coupons" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Live coupons" value={live} tone="gold" icon={<Ticket className="h-4 w-4" />} />
        <StatCard label="Times used" value={totalUses} icon={<BadgePercent className="h-4 w-4" />} />
        <StatCard label="Expired / used up" value={data.length - live} tone={data.length - live ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((c) => (
          <Panel key={c.id} bodyClassName="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-hero num-lux text-2xl tracking-widest text-lux">{c.code}</p>
                <p className="flex items-center gap-1.5 text-sm text-frost">{c.kind === "free_delivery" ? <Truck className="h-3.5 w-3.5" /> : null}{describe(c)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${isLive(c) ? "bg-jade/12 text-jade" : "bg-ruby/12 text-ruby"}`}>
                {isLive(c) ? "Live" : "Off"}
              </span>
            </div>
            <p className="text-[11px] text-slate-dim">Min order Rs {c.min_order} · {c.per_customer}× per customer · {c.starts} → {c.ends}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-dim"><span>Used</span><span>{c.uses}{c.max_uses ? ` / ${c.max_uses}` : " (no limit)"}</span></div>
              <Bar value={c.uses} max={c.max_uses ?? Math.max(c.uses, 1)} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch label="Active" on={c.active} onChange={(v) => mutate(v ? "Coupon turned on" : "Coupon turned off", () => api.patch(ADMIN_EXTRA.coupon(c.id), { active: v }), (p) => p.map((x) => (x.id === c.id ? { ...x, active: v } : x)))} />
              <GhostButton className="ml-auto" onClick={() => setEdit(c)}>Edit</GhostButton>
              {confirm === c.id ? (
                <DangerButton onClick={() => mutate(`${c.code} deleted`, () => api.delete(ADMIN_EXTRA.coupon(c.id)), (p) => p.filter((x) => x.id !== c.id)).then(() => setConfirm(null))}>Confirm</DangerButton>
              ) : (
                <button aria-label="Delete coupon" className="text-ruby" onClick={() => setConfirm(c.id)}><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          </Panel>
        ))}
      </div>

      {edit ? <CouponEditor initial={edit} onClose={() => setEdit(null)} onSave={save} /> : null}
    </div>
  );
}

function CouponEditor({ initial, onClose, onSave }: { initial: Coupon; onClose: () => void; onSave: (c: Coupon) => void }) {
  const [c, setC] = useState(initial);
  const num = (k: keyof Coupon) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value === "" ? null : +e.target.value });
  const valid = c.code.trim().length >= 3 && c.ends >= c.starts;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-ink-deep/80 backdrop-blur-sm" onClick={onClose} />
      <div className="panel-lux lux-rise relative w-full max-w-lg space-y-4 p-6">
        <button aria-label="Close" className="absolute right-4 top-4 text-slate-dim" onClick={onClose}><X className="h-4 w-4" /></button>
        <h2 className="font-hero num-lux text-2xl">{initial.code ? `Edit ${initial.code}` : "New coupon"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code"><input className={fieldClass} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="MOON20" /></Field>
          <Field label="Type">
            <select className={fieldClass} value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as Coupon["kind"] })}>
              <option value="percent">Percent off</option><option value="flat">Fixed amount off</option><option value="free_delivery">Free delivery</option>
            </select>
          </Field>
          {c.kind !== "free_delivery" ? <Field label={c.kind === "percent" ? "Percent" : "Amount (Rs)"}><input type="number" className={fieldClass} value={c.value} onChange={num("value")} /></Field> : null}
          {c.kind === "percent" ? <Field label="Max discount (Rs)" hint="Empty = no cap"><input type="number" className={fieldClass} value={c.max_discount ?? ""} onChange={num("max_discount")} /></Field> : null}
          <Field label="Minimum order (Rs)"><input type="number" className={fieldClass} value={c.min_order} onChange={num("min_order")} /></Field>
          <Field label="Total uses" hint="Empty = unlimited"><input type="number" className={fieldClass} value={c.max_uses ?? ""} onChange={num("max_uses")} /></Field>
          <Field label="Uses per customer"><input type="number" className={fieldClass} value={c.per_customer} onChange={num("per_customer")} /></Field>
          <Field label="Starts"><input type="date" className={fieldClass} value={c.starts} onChange={(e) => setC({ ...c, starts: e.target.value })} /></Field>
          <Field label="Ends"><input type="date" className={fieldClass} value={c.ends} onChange={(e) => setC({ ...c, ends: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <GoldButton disabled={!valid} onClick={() => onSave(c)}>Save coupon</GoldButton>
        </div>
      </div>
    </div>
  );
}
