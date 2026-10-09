import { useEffect, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { PlatformSettings } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { Card, Field, PageHead, SampleBanner, Toggle } from "../ui";

export function Settings({ autoLockMin, setAutoLockMin }: { autoLockMin: number; setAutoLockMin: (n: number) => void }) {
  const { settings, plans, sources, mutate, set } = usePlatform();
  const [f, setF] = useState<PlatformSettings>(settings);
  useEffect(() => setF(settings), [settings]);
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);
  const s = (k: keyof PlatformSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === "number" ? +e.target.value : e.target.value });

  const save = () => mutate({ label: "Settings saved", call: () => api.patch(PLATFORM.settings, f), local: () => set("settings", () => f), audit: { action: "Changed platform settings", target: "Platform", category: "settings" } });

  return (
    <>
      <PageHead title="Settings" crumb="Settings" actions={<button className="pf-btn pf-btn-primary" disabled={!dirty} onClick={save}><Save className="h-4 w-4" /> Save changes</button>} />
      <SampleBanner source={sources.settings} what="Platform settings" />
      {f.maintenance_mode ? <div className="pf-banner tone-red"><AlertTriangle className="h-4 w-4" /> Maintenance mode is on — restaurants' customers see a "back soon" page.</div> : null}
      <div className="pf-grid-2">
        <Card title="Brand & contact">
          <div className="space-y-3">
            <Field label="Platform name"><input className="pf-input" value={f.platform_name} onChange={s("platform_name")} /></Field>
            <Field label="Support email"><input className="pf-input" value={f.support_email} onChange={s("support_email")} /></Field>
            <Field label="Support WhatsApp"><input className="pf-input" value={f.support_whatsapp} onChange={s("support_whatsapp")} /></Field>
            <Field label="Terms of service link"><input className="pf-input" value={f.terms_url} onChange={s("terms_url")} /></Field>
          </div>
        </Card>
        <Card title="New restaurants">
          <div className="space-y-3">
            <Field label="Who can sign up"><select className="pf-select" value={f.signup_mode} onChange={s("signup_mode")}><option value="open">Anyone (instant)</option><option value="approval">Anyone, but I approve first</option><option value="closed">Only restaurants I add</option></select></Field>
            <Field label="Starting plan"><select className="pf-select" value={f.default_plan} onChange={s("default_plan")}>{plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></Field>
            <Field label="Free trial length (days)"><input type="number" className="pf-input" value={f.trial_days} onChange={s("trial_days")} /></Field>
          </div>
        </Card>
        <Card title="Late payments">
          <div className="space-y-4">
            <Field label="Grace period after due date (days)"><input type="number" className="pf-input" value={f.grace_days} onChange={s("grace_days")} /></Field>
            <div className="flex items-center gap-3 text-sm"><Toggle label="Auto pause" on={f.auto_pause_unpaid} onChange={(v) => setF({ ...f, auto_pause_unpaid: v })} /> Pause restaurants automatically when the grace period ends</div>
          </div>
        </Card>
        <Card title="Where restaurants pay you">
          <div className="space-y-3">
            <Field label="JazzCash account"><input className="pf-input" value={f.payout_jazzcash} onChange={s("payout_jazzcash")} /></Field>
            <Field label="Bank account"><input className="pf-input" value={f.payout_bank} onChange={s("payout_bank")} /></Field>
          </div>
        </Card>
        <Card title="Console lock">
          <div className="space-y-3 text-sm">
            <p className="pf-muted">This page asks for your lock code when opened and after you've been away. The code is set by your developer in the project settings (currently the default unless changed).</p>
            <Field label="Lock automatically after">
              <select className="pf-select" value={autoLockMin} onChange={(e) => setAutoLockMin(+e.target.value)}>
                {[5, 10, 15, 30, 60, 0].map((m) => <option key={m} value={m}>{m ? `${m} minutes away` : "Never"}</option>)}
              </select>
            </Field>
          </div>
        </Card>
        <Card title="WhatsApp for login codes & orders">
          <div className="space-y-4 text-sm">
            <p className="pf-muted">Every restaurant sends codes and order messages from its own WhatsApp number, linked by scanning a QR in their admin. If it isn't linked, messages go by text (SMS).</p>
            <div className="flex items-center gap-3"><Toggle label="Require own number" on={f.wa_require_own_number ?? true} onChange={(v) => setF({ ...f, wa_require_own_number: v })} /> Each restaurant must link its own WhatsApp number</div>
            <div className="flex items-center gap-3"><Toggle label="SMS fallback" on={f.wa_sms_fallback ?? true} onChange={(v) => setF({ ...f, wa_sms_fallback: v })} /> Send by text (SMS) when WhatsApp isn't linked or fails</div>
            <div className="flex items-center gap-3"><Toggle label="Block until linked" on={f.wa_block_until_linked ?? false} onChange={(v) => setF({ ...f, wa_block_until_linked: v })} /> Lock the restaurant admin until WhatsApp is linked</div>
            <Field label="Days to link before reminders turn strict"><input type="number" className="pf-input" value={f.wa_link_grace_days ?? 3} onChange={s("wa_link_grace_days")} /></Field>
            <Field label="Remind disconnected restaurants every">
              <select className="pf-select" value={f.wa_reminder_hours ?? 24} onChange={s("wa_reminder_hours")}>
                {[6, 12, 24, 48, 0].map((h) => <option key={h} value={h}>{h ? `${h} hours` : "Never"}</option>)}
              </select>
            </Field>
            {!(f.wa_sms_fallback ?? true) ? <div className="pf-banner tone-red"><AlertTriangle className="h-4 w-4" /> With SMS fallback off, customers of unlinked restaurants won't get login codes.</div> : null}
          </div>
        </Card>
        <Card title="Danger zone">
          <div className="flex items-center gap-3 text-sm"><Toggle label="Maintenance mode" on={f.maintenance_mode} onChange={(v) => setF({ ...f, maintenance_mode: v })} /> Maintenance mode (all restaurant sites show "back soon")</div>
        </Card>
      </div>
    </>
  );
}
