import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarX, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Field, GhostButton, GoldButton, Panel, fieldClass } from "@/components/admin/bits";
import { PageHeader, SampleNote, Switch } from "@/components/admin/SampleNote";
import { api } from "@/lib/api/client";
import { ADMIN_EXTRA, sampleSettings, useAdminResource, type RestaurantSettings } from "@/lib/admin-extras";

export const Route = createFileRoute("/admin/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Restaurant Settings — Owner Console" },
      { name: "description", content: "Opening hours, wallet numbers, taxes and delivery rules for your restaurant." },
      { property: "og:title", content: "Restaurant Settings — Owner Console" },
      { property: "og:description", content: "Opening hours, wallet numbers, taxes and delivery rules." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data, sample, mutate } = useAdminResource<RestaurantSettings>(ADMIN_EXTRA.settings, sampleSettings, false);
  const [f, setF] = useState<RestaurantSettings>(data);
  useEffect(() => setF(data), [data]);
  const dirty = JSON.stringify(f) !== JSON.stringify(data);

  const txt = (k: keyof RestaurantSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === "number" ? +e.target.value : e.target.value });
  const flag = (k: keyof RestaurantSettings) => (v: boolean) => setF({ ...f, [k]: v });

  const save = () => mutate("Settings saved", () => api.patch(ADMIN_EXTRA.settings, f), () => f);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Restaurant"
        title="Settings"
        sub="Everything your customers see at checkout — hours, payments, charges and delivery."
        actions={
          <>
            <GhostButton disabled={!dirty} onClick={() => setF(data)}>Discard</GhostButton>
            <GoldButton disabled={!dirty} onClick={save}><Save className="h-4 w-4" /> Save changes</GoldButton>
          </>
        }
      />
      <SampleNote show={sample} what="Restaurant settings" />

      {f.pause_online_orders ? (
        <div className="panel-lux flex items-center gap-2 border-ruby/40 px-4 py-3 text-sm text-ruby">
          <AlertTriangle className="h-4 w-4" /> Online ordering is paused — customers can browse but not order.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Restaurant profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Restaurant name"><input className={fieldClass} value={f.name} onChange={txt("name")} /></Field>
            <Field label="Contact phone"><input className={fieldClass} value={f.phone} onChange={txt("phone")} /></Field>
            <Field label="Address" className="sm:col-span-2"><input className={fieldClass} value={f.address} onChange={txt("address")} /></Field>
            <Field label="Logo link" className="sm:col-span-2" hint="Shown on receipts and the menu header"><input className={fieldClass} value={f.logo_url} onChange={txt("logo_url")} /></Field>
          </div>
        </Panel>

        <Panel title="Order taking">
          <div className="space-y-4 text-sm">
            <Row label="Pause online orders" hint="Use when the kitchen is overloaded"><Switch label="Pause online orders" on={f.pause_online_orders} onChange={flag("pause_online_orders")} /></Row>
            <Row label="Auto-accept new orders" hint="Skip manual confirmation"><Switch label="Auto-accept" on={f.auto_accept_orders} onChange={flag("auto_accept_orders")} /></Row>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum order (Rs)"><input type="number" className={fieldClass} value={f.min_order} onChange={txt("min_order")} /></Field>
              <Field label="Tax (%)"><input type="number" className={fieldClass} value={f.tax_percent} onChange={txt("tax_percent")} /></Field>
              <Field label="Service charge (%)"><input type="number" className={fieldClass} value={f.service_charge_percent} onChange={txt("service_charge_percent")} /></Field>
            </div>
          </div>
        </Panel>

        <Panel title="Payments at checkout" subtitle="Customers send money here, then upload the receipt">
          <div className="space-y-4 text-sm">
            <Row label="Cash on delivery"><Switch label="Cash on delivery" on={f.accept_cod} onChange={flag("accept_cod")} /></Row>
            <Row label="JazzCash / EasyPaisa"><Switch label="Wallets" on={f.accept_wallets} onChange={flag("accept_wallets")} /></Row>
            <Row label="Require payment receipt" hint="Wallet orders can't be placed without a screenshot"><Switch label="Require receipt" on={f.require_receipt} onChange={flag("require_receipt")} /></Row>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="JazzCash number"><input className={fieldClass} value={f.jazzcash_number} onChange={txt("jazzcash_number")} /></Field>
              <Field label="JazzCash account name"><input className={fieldClass} value={f.jazzcash_title} onChange={txt("jazzcash_title")} /></Field>
              <Field label="EasyPaisa number"><input className={fieldClass} value={f.easypaisa_number} onChange={txt("easypaisa_number")} /></Field>
              <Field label="EasyPaisa account name"><input className={fieldClass} value={f.easypaisa_title} onChange={txt("easypaisa_title")} /></Field>
            </div>
            {!f.accept_cod && !f.accept_wallets ? (
              <p className="flex items-center gap-2 text-xs text-ruby"><AlertTriangle className="h-3.5 w-3.5" /> Turn on at least one payment method.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Delivery">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Delivery fee (Rs)"><input type="number" className={fieldClass} value={f.delivery_fee} onChange={txt("delivery_fee")} /></Field>
            <Field label="Free delivery over (Rs)"><input type="number" className={fieldClass} value={f.free_delivery_over} onChange={txt("free_delivery_over")} /></Field>
            <Field label="Delivery radius (km)"><input type="number" className={fieldClass} value={f.delivery_radius_km} onChange={txt("delivery_radius_km")} /></Field>
          </div>
        </Panel>

        <Panel title="Opening hours" className="xl:col-span-2">
          <div className="grid gap-2 md:grid-cols-2">
            {f.hours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-3 rounded-xl border border-lux/10 px-3 py-2">
                <span className="w-24 text-[11px] font-black uppercase tracking-[0.14em] text-frost">{h.day}</span>
                <input type="time" disabled={h.closed} className={`${fieldClass} w-28`} value={h.open}
                  onChange={(e) => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)) })} />
                <span className="text-slate-dim">–</span>
                <input type="time" disabled={h.closed} className={`${fieldClass} w-28`} value={h.close}
                  onChange={(e) => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)) })} />
                <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-dim">
                  {h.closed ? "Closed" : "Open"}
                  <Switch label={`${h.day} open`} on={!h.closed} onChange={(v) => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, closed: !v } : x)) })} />
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Holidays & closures" className="xl:col-span-2"
          action={<GhostButton onClick={() => setF({ ...f, holidays: [...f.holidays, { date: new Date().toISOString().slice(0, 10), note: "" }] })}><Plus className="h-4 w-4" /> Add day</GhostButton>}>
          {f.holidays.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-dim"><CalendarX className="h-4 w-4" /> No closures planned.</p>
          ) : (
            <div className="space-y-2">
              {f.holidays.map((h, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3">
                  <input type="date" className={`${fieldClass} w-44`} value={h.date}
                    onChange={(e) => setF({ ...f, holidays: f.holidays.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} />
                  <input className={`${fieldClass} flex-1`} placeholder="Reason (shown to customers)" value={h.note}
                    onChange={(e) => setF({ ...f, holidays: f.holidays.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
                  <button aria-label="Remove" className="text-ruby" onClick={() => setF({ ...f, holidays: f.holidays.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-bold text-frost">{label}</p>
        {hint ? <p className="text-[11px] text-slate-dim">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
