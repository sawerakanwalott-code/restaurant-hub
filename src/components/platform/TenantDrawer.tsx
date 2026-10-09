import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, KeyRound, Loader2, LogIn, MessageCircle, PauseCircle, PlayCircle, RefreshCw, Trash2, X } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import { setTenantSlug } from "@/lib/tenant";
import type { PlatformTenant, SubStatus } from "@/lib/platform/types";
import { usePlatform } from "./store";
import { HealthBadge } from "./views/Restaurants";
import { ago, Avatar, Card, daysUntil, Drawer, Field, fmtDate, fmtDateTime, InvPill, Modal, num, pkr, Progress, SubPill, Toggle } from "./ui";

const TABS = ["Overview", "Profile", "Subscription", "Features & limits", "Staff", "Invoices", "WhatsApp", "Activity"] as const;
type Tab = (typeof TABS)[number];

const FEATURES: [string, string, string][] = [
  ["ai_voice", "AI voice ordering", "Customers order by talking to the AI agent"],
  ["whatsapp", "WhatsApp ordering & OTP", "Order updates and login codes on WhatsApp"],
  ["riders", "Delivery riders", "Rider app, live tracking, cash settlement"],
  ["pos", "Counter POS", "Cashier point-of-sale screen"],
  ["multi_branch", "Multiple branches", "More than one location"],
  ["coupons", "Coupons", "Discount codes at checkout"],
];

export function TenantDrawer({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { tenants, invoices, audit, plans, set, mutate } = usePlatform();
  const t = tenants.find((x) => x.slug === slug);
  const [tab, setTab] = useState<Tab>("Overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  if (!t) return null;

  const patch = (changes: Partial<PlatformTenant>) => set("tenants", (p) => p.map((x) => (x.slug === slug ? { ...x, ...changes } : x)));

  const openAs = async () => {
    try { await api.post(PLATFORM.tenantImpersonate(slug), {}); } catch { /* endpoint optional */ }
    setTenantSlug(slug);
    void navigate({ to: "/admin" });
  };

  const toggleLive = () => mutate({
    label: t.is_active ? `${t.name} paused` : `${t.name} is live again`,
    call: () => api.patch(PLATFORM.tenantDetail(slug), { is_active: !t.is_active }),
    local: () => patch({ is_active: !t.is_active }),
    audit: { action: t.is_active ? "Paused restaurant" : "Resumed restaurant", target: t.name, category: "tenant" },
  });

  return (
    <Drawer onClose={onClose}>
      <div className="sticky top-0 z-10 p-5 pb-3" style={{ background: "var(--pf-bg)" }}>
        <div className="flex items-start gap-4">
          <Avatar name={t.name} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-tight">{t.name}</h2>
            <div className="pf-muted mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span>{t.domain ?? `${t.slug}.kennedy.app`}</span><SubPill s={t.subscription_status} />
              {!t.is_active ? <span className="pf-pill tone-red">Paused</span> : null}
            </div>
          </div>
          <button className="pf-icon-btn" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="pf-btn pf-btn-primary pf-btn-sm" onClick={openAs}><LogIn className="h-3.5 w-3.5" /> Open their admin</button>
          <a className="pf-btn pf-btn-ghost pf-btn-sm" href={`https://${t.domain ?? `${t.slug}.kennedy.app`}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Their website</a>
          <button className={`pf-btn pf-btn-sm ${t.is_active ? "pf-btn-danger" : "pf-btn-success"}`} onClick={toggleLive}>{t.is_active ? <><PauseCircle className="h-3.5 w-3.5" /> Pause</> : <><PlayCircle className="h-3.5 w-3.5" /> Resume</>}</button>
          <button className="pf-btn pf-btn-danger pf-btn-sm ml-auto" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
        <div className="pf-tabs mt-4">{TABS.map((x) => <button key={x} className={`pf-tab ${tab === x ? "on" : ""}`} onClick={() => setTab(x)}>{x}</button>)}</div>
      </div>

      <div className="space-y-4 p-5 pt-2">
        {tab === "Overview" && <OverviewTab t={t} />}
        {tab === "Profile" && <ProfileTab t={t} patch={patch} />}
        {tab === "Subscription" && <SubscriptionTab t={t} patch={patch} plans={plans} />}
        {tab === "Features & limits" && <FeaturesTab t={t} patch={patch} />}
        {tab === "Staff" && <StaffTab t={t} />}
        {tab === "Invoices" && (
          <Card title="Invoices">
            {invoices.filter((i) => i.subscription.tenant.slug === slug).map((i) => (
              <div key={i.id} className="flex items-center gap-3 border-b py-3 text-sm" style={{ borderColor: "var(--pf-line)" }}>
                <b>#{i.id}</b><span className="pf-muted">{fmtDate(i.period_start)} – {fmtDate(i.period_end)}</span><span className="ml-auto font-bold">{pkr(i.amount_pkr)}</span><InvPill s={i.status} />
              </div>
            ))}
            {invoices.every((i) => i.subscription.tenant.slug !== slug) ? <p className="pf-muted text-sm">No invoices yet.</p> : null}
          </Card>
        )}
        {tab === "WhatsApp" && <WhatsAppTab slug={slug} />}
        {tab === "Activity" && (
          <Card title="Activity">
            {audit.filter((e) => e.target === t.name).map((e) => (
              <div key={e.id} className="flex gap-3 py-2 text-sm"><b>{e.actor}</b><span>{e.action}</span><span className="pf-muted ml-auto">{ago(e.at)}</span></div>
            ))}
            {audit.every((e) => e.target !== t.name) ? <p className="pf-muted text-sm">Nothing logged for this restaurant yet.</p> : null}
          </Card>
        )}
      </div>

      {confirmDelete ? <DeleteConfirm t={t} onClose={() => setConfirmDelete(false)} onDone={onClose} /> : null}
    </Drawer>
  );
}

function OverviewTab({ t }: { t: PlatformTenant }) {
  const lim = t.limits;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Orders today", num(t.orders_today)], ["Sales today", pkr(t.revenue_today)], ["Orders total", num(t.orders_total)], ["Sales total", pkr(t.revenue_total)]].map(([l, v]) => (
          <div key={l} className="pf-card" style={{ padding: 16 }}><div className="pf-muted text-xs">{l}</div><div className="pf-display mt-1 text-lg font-bold">{v}</div></div>
        ))}
      </div>
      <Card title="Usage against plan" actions={<span className="pf-muted text-xs">Health <HealthBadge v={t.health_score} /></span>}>
        <div className="space-y-4 text-sm">
          {[["Orders today", t.orders_today, lim?.orders_per_day], ["Staff accounts", t.staff_count, lim?.staff_seats], ["Branches", t.branch_count, lim?.branches]].map(([l, v, m]) => (
            <div key={l as string}><div className="mb-1 flex justify-between"><span>{l}</span><b>{v as number} / {(m as number) > 9999 ? "∞" : m ?? "—"}</b></div><Progress value={v as number} max={(m as number) ?? 0} /></div>
          ))}
        </div>
      </Card>
      <Card title="At a glance">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="pf-muted">Owner</dt><dd>{t.owner_name ?? "—"}</dd>
          <dt className="pf-muted">Phone</dt><dd>{t.owner_phone ?? "—"}</dd>
          <dt className="pf-muted">Email</dt><dd>{t.owner_email ?? "—"}</dd>
          <dt className="pf-muted">City</dt><dd>{t.city ?? "—"}</dd>
          <dt className="pf-muted">Joined</dt><dd>{fmtDate(t.created_at)}</dd>
          <dt className="pf-muted">WhatsApp</dt><dd>{t.whatsapp_connected === undefined ? "—" : t.whatsapp_connected ? "Connected" : "Disconnected"}</dd>
        </dl>
      </Card>
    </>
  );
}

function ProfileTab({ t, patch }: { t: PlatformTenant; patch: (c: Partial<PlatformTenant>) => void }) {
  const { mutate } = usePlatform();
  const [f, setF] = useState({ name: t.name, city: t.city ?? "", owner_name: t.owner_name ?? "", owner_email: t.owner_email ?? "", owner_phone: t.owner_phone ?? "", domain: t.domain ?? "" });
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Card title="Restaurant profile">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="pf-input" value={f.name} onChange={upd("name")} /></Field>
        <Field label="City"><input className="pf-input" value={f.city} onChange={upd("city")} /></Field>
        <Field label="Owner name"><input className="pf-input" value={f.owner_name} onChange={upd("owner_name")} /></Field>
        <Field label="Owner phone"><input className="pf-input" value={f.owner_phone} onChange={upd("owner_phone")} /></Field>
        <Field label="Owner email"><input className="pf-input" value={f.owner_email} onChange={upd("owner_email")} /></Field>
        <Field label="Custom domain"><input className="pf-input" value={f.domain} onChange={upd("domain")} placeholder="order.myrestaurant.pk" /></Field>
      </div>
      <div className="mt-5 flex justify-end">
        <button className="pf-btn pf-btn-primary" onClick={() => mutate({ label: "Profile saved", call: () => api.patch(PLATFORM.tenantDetail(t.slug), f), local: () => patch(f), audit: { action: "Edited restaurant profile", target: f.name, category: "tenant" } })}>Save changes</button>
      </div>
    </Card>
  );
}

function SubscriptionTab({ t, patch, plans }: { t: PlatformTenant; patch: (c: Partial<PlatformTenant>) => void; plans: { slug: string; name: string; price_pkr: number }[] }) {
  const { mutate } = usePlatform();
  const [plan, setPlan] = useState(t.plan_slug);
  const [status, setStatus] = useState<SubStatus>(t.subscription_status);
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const end = t.subscription_status === "trialing" ? t.trial_ends_at : t.current_period_end;
  const d = daysUntil(end);

  const save = () => {
    const payload: Record<string, unknown> = {};
    if (plan !== t.plan_slug) payload.plan_slug = plan;
    if (status !== t.subscription_status) payload.status = status;
    if (!Object.keys(payload).length) return;
    const p = plans.find((x) => x.slug === plan);
    return mutate({ label: "Subscription updated", call: () => api.patch(PLATFORM.subscription(t.slug), payload), local: () => patch({ plan_slug: plan, plan_name: p?.name ?? plan, subscription_status: status }), audit: { action: `Changed plan to ${p?.name ?? plan} (${status})`, target: t.name, category: "billing" } });
  };
  const extend = () => {
    const base = end ? new Date(end).getTime() : Date.now();
    const next = new Date(Math.max(base, Date.now()) + days * 86_400_000).toISOString();
    return mutate({ label: `Extended by ${days} days`, call: () => api.patch(PLATFORM.subscription(t.slug), { extend_trial_days: days, reason }), local: () => patch(t.subscription_status === "trialing" ? { trial_ends_at: next } : { current_period_end: next }), audit: { action: `Extended by ${days} days${reason ? ` — ${reason}` : ""}`, target: t.name, category: "billing" } });
  };

  return (
    <>
      <Card title="Current subscription">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div><div className="pf-muted text-xs">Plan</div><b className="text-lg">{t.plan_name}</b></div>
          <div><div className="pf-muted text-xs">Status</div><SubPill s={t.subscription_status} /></div>
          <div><div className="pf-muted text-xs">{t.subscription_status === "trialing" ? "Trial ends" : "Renews"}</div><b>{fmtDate(end)}</b>{d !== null ? <span className="pf-muted"> ({d < 0 ? `${-d}d overdue` : `${d}d left`})</span> : null}</div>
        </div>
      </Card>
      <Card title="Change plan or status">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan"><select className="pf-select" value={plan} onChange={(e) => setPlan(e.target.value)}>{plans.map((p) => <option key={p.slug} value={p.slug}>{p.name} — ₨{p.price_pkr.toLocaleString()}</option>)}</select></Field>
          <Field label="Status"><select className="pf-select" value={status} onChange={(e) => setStatus(e.target.value as SubStatus)}><option value="trialing">Trial</option><option value="active">Active (paid)</option><option value="past_due">Past due</option><option value="cancelled">Cancelled</option></select></Field>
        </div>
        <div className="mt-4 flex justify-end"><button className="pf-btn pf-btn-primary" onClick={save}>Save</button></div>
      </Card>
      <Card title="Give extra days">
        <div className="pf-chips mb-3">{[3, 7, 15, 30].map((n) => <button key={n} className={`pf-chip ${days === n ? "on" : ""}`} onClick={() => setDays(n)}>+{n} days</button>)}</div>
        <Field label="Reason (saved in activity log)"><input className="pf-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Eid closure, onboarding delay" /></Field>
        <div className="mt-4 flex justify-end"><button className="pf-btn pf-btn-success" onClick={extend}>Extend {days} days</button></div>
      </Card>
    </>
  );
}

function FeaturesTab({ t, patch }: { t: PlatformTenant; patch: (c: Partial<PlatformTenant>) => void }) {
  const { mutate } = usePlatform();
  const [lim, setLim] = useState(t.limits ?? { orders_per_day: 100, staff_seats: 5, branches: 1 });
  const feats = t.features ?? {};
  const flip = (k: string, v: boolean) => mutate({ label: `${FEATURES.find((f) => f[0] === k)?.[1]} ${v ? "turned on" : "turned off"}`, call: () => api.patch(PLATFORM.tenantFeatures(t.slug), { [k]: v }), local: () => patch({ features: { ...feats, [k]: v } }), audit: { action: `${v ? "Enabled" : "Disabled"} ${k}`, target: t.name, category: "tenant" } });
  return (
    <>
      <Card title="Features">
        <ul className="space-y-1">
          {FEATURES.map(([k, l, d]) => (
            <li key={k} className="flex items-center gap-4 rounded-xl p-2">
              <div className="flex-1"><b className="text-sm">{l}</b><div className="pf-muted text-xs">{d}</div></div>
              <Toggle label={l} on={!!feats[k]} onChange={(v) => flip(k, v)} />
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Custom limits (override the plan)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Orders per day"><input type="number" className="pf-input" value={lim.orders_per_day} onChange={(e) => setLim({ ...lim, orders_per_day: +e.target.value })} /></Field>
          <Field label="Staff accounts"><input type="number" className="pf-input" value={lim.staff_seats} onChange={(e) => setLim({ ...lim, staff_seats: +e.target.value })} /></Field>
          <Field label="Branches"><input type="number" className="pf-input" value={lim.branches} onChange={(e) => setLim({ ...lim, branches: +e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end"><button className="pf-btn pf-btn-primary" onClick={() => mutate({ label: "Limits saved", call: () => api.patch(PLATFORM.tenantFeatures(t.slug), { limits: lim }), local: () => patch({ limits: lim }), audit: { action: "Changed custom limits", target: t.name, category: "tenant" } })}>Save limits</button></div>
      </Card>
    </>
  );
}

type TUser = { id: string | number; name: string; username?: string; role: string; phone?: string; last_login?: string; is_active: boolean };

function StaffTab({ t }: { t: PlatformTenant }) {
  const { mutate } = usePlatform();
  const [users, setUsers] = useState<TUser[] | null>(null);
  const [sample, setSample] = useState(false);
  useEffect(() => {
    api.get<TUser[]>(PLATFORM.tenantUsers(t.slug)).then((r) => setUsers(Array.isArray(r) ? r : [])).catch(() => {
      setSample(true);
      setUsers([
        { id: 1, name: t.owner_name ?? "Owner", role: "owner", phone: t.owner_phone, last_login: new Date().toISOString(), is_active: true },
        { id: 2, name: "Manager", role: "manager", last_login: new Date(Date.now() - 864e5).toISOString(), is_active: true },
        { id: 3, name: "Kitchen screen", role: "kitchen", is_active: true },
        { id: 4, name: "Rider Imran", role: "rider", is_active: false },
      ]);
    });
  }, [t.slug, t.owner_name, t.owner_phone]);
  if (!users) return <Card><Loader2 className="pf-spin mx-auto h-6 w-6" /></Card>;
  return (
    <Card title={`Staff accounts · ${users.length}`} actions={sample ? <span className="pf-pill tone-yellow">Sample</span> : null}>
      {users.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center gap-3 border-b py-3 text-sm" style={{ borderColor: "var(--pf-line)", opacity: u.is_active ? 1 : 0.55 }}>
          <Avatar name={u.name} size={34} />
          <div className="min-w-0 flex-1"><b>{u.name}</b><div className="pf-muted text-xs capitalize">{u.role}{u.last_login ? ` · last seen ${ago(u.last_login)}` : ""}</div></div>
          <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => mutate({ label: `Temporary password sent to ${u.name}`, call: () => api.post(`${PLATFORM.tenantUsers(t.slug)}${u.id}/reset-password/`, {}), local: () => {}, audit: { action: `Reset password for ${u.name}`, target: t.name, category: "security" } })}><KeyRound className="h-3.5 w-3.5" /> Reset password</button>
          <button className={`pf-btn pf-btn-sm ${u.is_active ? "pf-btn-danger" : "pf-btn-success"}`} onClick={() => mutate({ label: u.is_active ? `${u.name} locked` : `${u.name} unlocked`, call: () => api.patch(`${PLATFORM.tenantUsers(t.slug)}${u.id}/`, { is_active: !u.is_active }), local: () => setUsers((p) => p!.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x))), audit: { action: `${u.is_active ? "Locked" : "Unlocked"} ${u.name}`, target: t.name, category: "security" } })}>{u.is_active ? "Lock" : "Unlock"}</button>
        </div>
      ))}
    </Card>
  );
}

type WA = { is_connected?: boolean; qrcode?: string; pairing_code?: string; phone?: string; state?: string };

function WhatsAppTab({ slug }: { slug: string }) {
  const [wa, setWa] = useState<WA | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get<WA>(`/whatsapp/qr/?tenant=${slug}`).then((r) => { setWa(r); setErr(null); }).catch((e: Error) => setErr(e.message));
  useEffect(() => { void load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [slug]);
  const act = async (path: string) => { setBusy(true); try { await api.post(`${path}?tenant=${slug}`, {}); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <Card title={<span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp connection</span>} actions={wa ? <span className={`pf-pill ${wa.is_connected ? "tone-green" : "tone-red"}`}>{wa.is_connected ? "Connected" : "Not connected"}</span> : null}>
      {err ? <p className="text-sm" style={{ color: "var(--pf-red)" }}>Couldn't reach WhatsApp service: {err}</p> : null}
      {!wa && !err ? <Loader2 className="pf-spin mx-auto h-6 w-6" /> : null}
      {wa && !wa.is_connected && wa.qrcode ? (
        <div className="text-center">
          <img src={wa.qrcode} alt="WhatsApp QR code" className="mx-auto h-52 w-52 rounded-xl bg-[var(--pf-on-color)] p-2" />
          <p className="pf-muted mt-2 text-sm">Ask the restaurant owner to scan this in WhatsApp → Linked devices.</p>
          {wa.pairing_code ? <p className="mt-2 text-sm">Pairing code: <b className="pf-display">{wa.pairing_code}</b></p> : null}
        </div>
      ) : null}
      {wa?.is_connected ? <p className="text-sm">Linked{wa.phone ? ` to ${wa.phone}` : ""}. Messages are flowing.</p> : null}
      <div className="mt-4 flex gap-2">
        <button className="pf-btn pf-btn-ghost pf-btn-sm" disabled={busy} onClick={() => act("/whatsapp/restart/")}><RefreshCw className="h-3.5 w-3.5" /> Restart</button>
        <button className="pf-btn pf-btn-danger pf-btn-sm" disabled={busy} onClick={() => act("/whatsapp/logout/")}>Disconnect</button>
      </div>
      <p className="pf-muted mt-3 text-xs">Checked {fmtDateTime(new Date().toISOString())}</p>
    </Card>
  );
}

function DeleteConfirm({ t, onClose, onDone }: { t: PlatformTenant; onClose: () => void; onDone: () => void }) {
  const { mutate, set } = usePlatform();
  const [typed, setTyped] = useState("");
  return (
    <Modal title={`Delete ${t.name}?`} onClose={onClose} footer={<>
      <button className="pf-btn pf-btn-ghost" onClick={onClose}>Cancel</button>
      <button className="pf-btn pf-btn-danger" disabled={typed !== t.slug} onClick={async () => {
        const ok = await mutate({ label: `${t.name} deleted`, call: () => api.delete(PLATFORM.tenantDetail(t.slug)), local: () => set("tenants", (p) => p.filter((x) => x.slug !== t.slug)), audit: { action: "Deleted restaurant", target: t.name, category: "tenant" } });
        if (ok) { onClose(); onDone(); }
      }}><Trash2 className="h-4 w-4" /> Delete forever</button>
    </>}>
      <p className="text-sm">This removes the restaurant, its menu, orders and staff accounts. <b>It can't be undone.</b> Consider pausing instead.</p>
      <Field label={`Type ${t.slug} to confirm`}><input className="pf-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}
