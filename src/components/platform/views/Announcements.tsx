import { useState } from "react";
import { Megaphone, Send } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { Announcement } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { Card, Field, fmtDateTime, PageHead, Pill, SampleBanner } from "../ui";

const AUD: [string, string][] = [["all", "All restaurants"], ["active", "Paying restaurants"], ["trialing", "On free trial"], ["past_due", "Payment overdue"]];
const CH: [Announcement["channels"][number], string][] = [["banner", "Banner in their admin"], ["whatsapp", "WhatsApp"], ["email", "Email"]];

export function Announcements() {
  const { announcements, tenants, sources, mutate, set } = usePlatform();
  const [f, setF] = useState({ title: "", body: "", audience: "all", channels: ["banner"] as Announcement["channels"], when: "" });
  const reach = f.audience === "all" ? tenants.length : tenants.filter((t) => t.subscription_status === f.audience).length;

  const submit = () => {
    const a: Announcement = { id: `A-${Date.now() % 1000}`, title: f.title, body: f.body, audience: f.audience, channels: f.channels, status: f.when ? "scheduled" : "sent", send_at: f.when ? new Date(f.when).toISOString() : new Date().toISOString() };
    void mutate({ label: f.when ? "Announcement scheduled" : `Sent to ${reach} restaurants`, call: () => api.post(PLATFORM.announcements, a), local: () => set("announcements", (p) => [a, ...p]), audit: { action: `Sent announcement "${a.title}"`, target: AUD.find((x) => x[0] === a.audience)?.[1] ?? a.audience, category: "support" } }).then((ok) => ok && setF({ title: "", body: "", audience: "all", channels: ["banner"], when: "" }));
  };

  return (
    <>
      <PageHead title="Announcements" crumb="Announcements" />
      <SampleBanner source={sources.announcements} what="Announcements" />
      <div className="pf-grid-main">
        <Card title={<span className="inline-flex items-center gap-2"><Megaphone className="h-4 w-4" /> New announcement</span>}>
          <div className="space-y-4">
            <Field label="Title"><input className="pf-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="New feature: coupons" /></Field>
            <Field label="Message"><textarea className="pf-textarea" rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
            <div><span className="pf-label">Who gets it</span><div className="pf-chips">{AUD.map(([k, l]) => <button key={k} className={`pf-chip ${f.audience === k ? "on" : ""}`} onClick={() => setF({ ...f, audience: k })}>{l}</button>)}</div></div>
            <div><span className="pf-label">How</span><div className="pf-chips">{CH.map(([k, l]) => <button key={k} className={`pf-chip ${f.channels.includes(k) ? "on" : ""}`} onClick={() => setF({ ...f, channels: f.channels.includes(k) ? f.channels.filter((c) => c !== k) : [...f.channels, k] })}>{l}</button>)}</div></div>
            <Field label="Send later (optional)"><input type="datetime-local" className="pf-input" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></Field>
            <div className="flex items-center justify-between">
              <span className="pf-muted text-sm">Reaches <b>{reach}</b> restaurants</span>
              <button className="pf-btn pf-btn-primary" disabled={!f.title || !f.body || !f.channels.length} onClick={submit}><Send className="h-4 w-4" /> {f.when ? "Schedule" : "Send now"}</button>
            </div>
          </div>
        </Card>
        <Card title="Preview">
          <div className="rounded-xl p-4 tone-blue"><b className="block">{f.title || "Your title"}</b><p className="mt-1 text-sm">{f.body || "Your message shows here as a banner at the top of each restaurant's admin page."}</p></div>
        </Card>
      </div>
      <Card title="Sent & scheduled" className="mt-[22px]">
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl p-3" style={{ background: "var(--pf-bg)" }}>
              <div className="min-w-0 flex-1"><b className="text-sm">{a.title}</b><div className="pf-muted text-xs">{AUD.find((x) => x[0] === a.audience)?.[1] ?? a.audience} · {a.channels.join(", ")} · {fmtDateTime(a.send_at)}</div></div>
              <Pill tone={a.status === "sent" ? "green" : a.status === "scheduled" ? "yellow" : "grey"}>{a.status}</Pill>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
