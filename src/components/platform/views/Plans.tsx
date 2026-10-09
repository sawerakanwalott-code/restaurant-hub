import { useState } from "react";
import { Check, Edit2, EyeOff, PlusCircle } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { Plan } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { Field, Modal, PageHead, pkr, SampleBanner, Toggle } from "../ui";

const TONES = ["grey", "blue", "violet", "orange"] as const;

export function Plans() {
  const { plans, tenants, sources, mutate, set } = usePlatform();
  const [edit, setEdit] = useState<Plan | "new" | null>(null);
  const countFor = (slug: string) => tenants.filter((t) => t.plan_slug === slug && t.subscription_status !== "cancelled").length;
  const mrrFor = (p: Plan) => tenants.filter((t) => t.plan_slug === p.slug && t.subscription_status === "active").length * p.price_pkr;

  return (
    <>
      <PageHead title="Plans & pricing" crumb="Plans" actions={<button className="pf-btn pf-btn-primary" onClick={() => setEdit("new")}><PlusCircle className="h-4 w-4" /> New plan</button>} />
      <SampleBanner source={sources.plans} what="Plans and prices" />
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {plans.map((p, i) => (
          <article key={p.slug} className="pf-card pf-fade flex flex-col" style={{ borderTop: `5px solid var(--pf-${["muted", "blue", "violet", "orange"][i % 4]})` }}>
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold">{p.name}</h3>
                {!p.is_public ? <span className="pf-pill tone-grey mt-1"><EyeOff className="h-3 w-3" /> Hidden from signup</span> : null}
              </div>
              <button className="pf-icon-btn" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}><Edit2 className="h-4 w-4" /></button>
            </div>
            <div className="pf-display my-4 text-3xl font-bold">{p.price_pkr ? pkr(p.price_pkr) : "Free"}<span className="pf-muted text-sm font-normal"> /{p.interval}</span></div>
            <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
              {[["orders/day", p.orders_per_day], ["staff", p.staff_seats], ["branches", p.branches]].map(([l, v]) => (
                <div key={l as string} className={`rounded-xl p-2 tone-${TONES[i % 4]}`}><b className="block text-base">{(v as number) > 9999 ? "∞" : v}</b>{l}</div>
              ))}
            </div>
            <ul className="mb-4 flex-1 space-y-1.5 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0" style={{ color: "var(--pf-green)" }} />{f}</li>)}</ul>
            <div className="flex justify-between border-t pt-3 text-sm" style={{ borderColor: "var(--pf-line)" }}>
              <span className="pf-muted">{countFor(p.slug)} restaurants</span><b>{pkr(mrrFor(p))}/mo</b>
            </div>
          </article>
        ))}
      </div>
      {edit ? (
        <PlanModal
          plan={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSave={(p, isNew) => mutate({
            label: isNew ? `${p.name} plan created` : `${p.name} plan saved`,
            call: () => (isNew ? api.post(PLATFORM.plans, p) : api.patch(PLATFORM.planDetail(p.slug), p)),
            local: () => set("plans", (prev) => (isNew ? [...prev, p] : prev.map((x) => (x.slug === p.slug ? p : x)))),
            audit: { action: isNew ? "Created plan" : `Edited plan (price ${pkr(p.price_pkr)})`, target: `${p.name} plan`, category: "settings" },
          }).then((ok) => ok && setEdit(null))}
        />
      ) : null}
    </>
  );
}

function PlanModal({ plan, onClose, onSave }: { plan: Plan | null; onClose: () => void; onSave: (p: Plan, isNew: boolean) => void }) {
  const [p, setP] = useState<Plan>(plan ?? { slug: "", name: "", price_pkr: 0, interval: "month", orders_per_day: 100, staff_seats: 5, branches: 1, features: [], is_public: true });
  const [feat, setFeat] = useState(p.features.join("\n"));
  const n = (k: keyof Plan) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: +e.target.value });
  return (
    <Modal title={plan ? `Edit ${plan.name}` : "New plan"} onClose={onClose} footer={<>
      <button className="pf-btn pf-btn-ghost" onClick={onClose}>Cancel</button>
      <button className="pf-btn pf-btn-primary" disabled={!p.name} onClick={() => onSave({ ...p, slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-plan", features: feat.split("\n").map((s) => s.trim()).filter(Boolean) }, !plan)}>Save plan</button>
    </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input className="pf-input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Price (₨)"><input type="number" className="pf-input" value={p.price_pkr} onChange={n("price_pkr")} /></Field>
        <Field label="Billing"><select className="pf-select" value={p.interval} onChange={(e) => setP({ ...p, interval: e.target.value as Plan["interval"] })}><option value="month">Monthly</option><option value="year">Yearly</option></select></Field>
        <Field label="Orders per day"><input type="number" className="pf-input" value={p.orders_per_day} onChange={n("orders_per_day")} /></Field>
        <Field label="Staff accounts"><input type="number" className="pf-input" value={p.staff_seats} onChange={n("staff_seats")} /></Field>
        <Field label="Branches"><input type="number" className="pf-input" value={p.branches} onChange={n("branches")} /></Field>
      </div>
      <Field label="What's included (one per line)"><textarea className="pf-textarea" rows={5} value={feat} onChange={(e) => setFeat(e.target.value)} /></Field>
      <div className="flex items-center gap-3 text-sm"><Toggle label="Show on signup" on={p.is_public} onChange={(v) => setP({ ...p, is_public: v })} /> Show this plan on the signup page</div>
      {plan ? <p className="pf-muted text-xs">Price changes apply from each restaurant's next invoice.</p> : null}
    </Modal>
  );
}
