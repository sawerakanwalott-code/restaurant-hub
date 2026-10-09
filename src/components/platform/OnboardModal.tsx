import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { PlatformTenant } from "@/lib/platform/types";
import { usePlatform } from "./store";
import { Field, Modal } from "./ui";

export function OnboardModal({ onClose }: { onClose: () => void }) {
  const { plans, set, mutate, settings } = usePlatform();
  const [f, setF] = useState({ name: "", slug: "", city: "", owner_name: "", owner_email: "", owner_phone: "", owner_username: "", owner_password: "", plan_slug: settings.default_plan || "free-trial" });
  const [saving, setSaving] = useState(false);
  const touched = useRef(false);
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    if (k === "slug") touched.current = true;
    setF((p) => ({ ...p, [k]: k === "slug" ? slugify(v) : v, ...(k === "name" && !touched.current ? { slug: slugify(v) } : {}) }));
  };

  const ok = f.name && f.slug && f.owner_username && f.owner_password.length >= 6;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setSaving(true);
    const plan = plans.find((p) => p.slug === f.plan_slug);
    let created: PlatformTenant | null = null;
    const done = await mutate({
      label: `${f.name} added`,
      call: async () => { created = await api.post<PlatformTenant>(PLATFORM.tenants, f); },
      local: () => {
        const t: PlatformTenant = created ?? {
          id: String(Date.now()), name: f.name, slug: f.slug, city: f.city, is_active: true, created_at: new Date().toISOString(),
          subscription_status: f.plan_slug === "free-trial" ? "trialing" : "active", plan_slug: f.plan_slug, plan_name: plan?.name ?? f.plan_slug,
          trial_ends_at: f.plan_slug === "free-trial" ? new Date(Date.now() + settings.trial_days * 86_400_000).toISOString() : null,
          current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(), orders_today: 0, orders_total: 0, revenue_today: 0, revenue_total: 0,
          staff_count: 1, branch_count: 1, owner_name: f.owner_name, owner_email: f.owner_email, owner_phone: f.owner_phone, health_score: 70,
          limits: plan ? { orders_per_day: plan.orders_per_day, staff_seats: plan.staff_seats, branches: plan.branches } : undefined,
        };
        set("tenants", (p) => [t, ...p]);
      },
      audit: { action: "Added restaurant", target: f.name, category: "tenant" },
    });
    setSaving(false);
    if (done) onClose();
  }

  return (
    <Modal title="Add a restaurant" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Restaurant name *"><input className="pf-input" value={f.name} onChange={upd("name")} placeholder="Kennedy Moon Grill" autoFocus /></Field>
          <Field label="City"><input className="pf-input" value={f.city} onChange={upd("city")} placeholder="Narowal" /></Field>
        </div>
        <Field label="Web address *">
          <div className="flex items-center gap-2"><input className="pf-input" value={f.slug} onChange={upd("slug")} /><span className="pf-muted whitespace-nowrap text-xs">.kennedy.app</span></div>
        </Field>
        <p className="pf-label" style={{ marginTop: 18 }}>Owner</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name"><input className="pf-input" value={f.owner_name} onChange={upd("owner_name")} /></Field>
          <Field label="Phone (WhatsApp)"><input className="pf-input" value={f.owner_phone} onChange={upd("owner_phone")} placeholder="+92 3xx xxxxxxx" /></Field>
          <Field label="Email"><input className="pf-input" type="email" value={f.owner_email} onChange={upd("owner_email")} /></Field>
          <Field label="Login username *"><input className="pf-input" value={f.owner_username} onChange={upd("owner_username")} /></Field>
        </div>
        <Field label="Temporary password * (min 6 — they must change it on first login)"><input className="pf-input" type="text" value={f.owner_password} onChange={upd("owner_password")} /></Field>
        <Field label="Plan">
          <select className="pf-select" value={f.plan_slug} onChange={upd("plan_slug")}>
            {plans.map((p) => <option key={p.slug} value={p.slug}>{p.name} — {p.price_pkr ? `₨${p.price_pkr.toLocaleString()}/mo` : "free"} · {p.orders_per_day > 9999 ? "unlimited" : p.orders_per_day} orders/day</option>)}
          </select>
        </Field>
        <div className="pf-modal-actions flex justify-end gap-2">
          <button type="button" className="pf-btn pf-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pf-btn pf-btn-primary" disabled={!ok || saving}>{saving ? <Loader2 className="pf-spin h-4 w-4" /> : null} Add restaurant</button>
        </div>
      </form>
    </Modal>
  );
}
