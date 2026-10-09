import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Loader2, RefreshCw, TriangleAlert } from "lucide-react";

import { api, API_BASE_URL } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { Integration } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { ago, Avatar, Card, PageHead, Pill, SampleBanner } from "../ui";

const ICON = { connected: CircleCheck, degraded: TriangleAlert, disconnected: CircleX };
const TONE = { connected: "green", degraded: "orange", disconnected: "red" } as const;

export function Integrations({ openTenant }: { openTenant: (s: string) => void }) {
  const { integrations, tenants, sources, set, settings } = usePlatform();
  const [ping, setPing] = useState<{ ms: number; ok: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    const t0 = performance.now();
    let ok = true;
    try { await api.get(PLATFORM.stats); } catch { ok = false; }
    const ms = Math.round(performance.now() - t0);
    setPing({ ms, ok });
    set("integrations", (p) => p.map((i): Integration => (i.key === "api" ? { ...i, status: ok ? (ms > 2500 ? "degraded" : "connected") : "disconnected", detail: ok ? `Responded in ${ms} ms` : "Not reachable", last_check: new Date().toISOString() } : i)));
    setChecking(false);
  };
  useEffect(() => { void check(); }, []);

  const wa = tenants.filter((t) => t.whatsapp_connected !== undefined);
  return (
    <>
      <PageHead title="Connections" crumb="Connections" actions={<button className="pf-btn pf-btn-ghost" onClick={check} disabled={checking}>{checking ? <Loader2 className="pf-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />} Check now</button>} />
      <SampleBanner source={sources.integrations} what="Service status (except the API check)" />
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {integrations.map((i) => {
          const Icon = ICON[i.status];
          return (
            <article key={i.key} className="pf-card pf-fade">
              <div className="flex items-start gap-3">
                <span className={`pf-kpi-icon tone-${TONE[i.status]}`} style={{ width: 48, height: 48 }}><Icon className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1"><h3 className="font-bold">{i.name}</h3><p className="pf-muted text-xs">{i.description}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm"><span>{i.detail}</span><Pill tone={TONE[i.status]} solid>{i.status}</Pill></div>
              <p className="pf-muted mt-2 text-xs">Checked {ago(i.last_check)}{i.key === "api" ? ` · ${API_BASE_URL || "not set"}` : ""}</p>
            </article>
          );
        })}
      </div>
      {ping && !ping.ok ? <p className="mt-3 text-sm" style={{ color: "var(--pf-red)" }}>Your API didn't answer. If you use ngrok, make sure the tunnel is running.</p> : null}

      <Card title="WhatsApp per restaurant" className="mt-[22px]">
        <div className="mb-4 grid gap-3 text-sm" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div><div className="pf-muted text-xs">Linked own number</div><b className="text-lg">{wa.filter((t) => t.whatsapp_connected).length} / {wa.length}</b></div>
          <div><div className="pf-muted text-xs">Sending by SMS instead</div><b className="text-lg">{settings.wa_sms_fallback ?? true ? wa.filter((t) => !t.whatsapp_connected).length : 0}</b></div>
          <div><div className="pf-muted text-xs">Rule</div><b>{settings.wa_require_own_number ?? true ? "Own number required" : "Optional"}</b></div>
          <div><div className="pf-muted text-xs">Backup</div><b>{settings.wa_sms_fallback ?? true ? "SMS fallback on" : "No fallback"}</b></div>
        </div>
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead><tr><th>Restaurant</th><th>WhatsApp</th><th>Codes go by</th><th /></tr></thead>
            <tbody>
              {wa.map((t) => (
                <tr key={t.slug} className="clickable" onClick={() => openTenant(t.slug)}>
                  <td><div className="flex items-center gap-3"><Avatar name={t.name} size={32} /><b className="text-sm">{t.name}</b></div></td>
                  <td>{t.whatsapp_connected ? <Pill tone="green">Own number linked</Pill> : <Pill tone="red">Not linked</Pill>}</td>
                  <td>{t.whatsapp_connected ? <Pill tone="green">WhatsApp</Pill> : settings.wa_sms_fallback ?? true ? <Pill tone="orange">SMS (fallback)</Pill> : <Pill tone="red">Nothing sent</Pill>}</td>
                  <td className="text-right"><span className="pf-muted text-xs">{t.whatsapp_connected ? "Open to manage" : "Open → WhatsApp tab to show QR"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
