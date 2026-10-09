import { useMemo, useState } from "react";
import { Send } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { Ticket } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { ago, Avatar, Card, Empty, PageHead, Pill, SampleBanner, type Tone } from "../ui";

const PRIO: Record<Ticket["priority"], Tone> = { urgent: "red", high: "orange", normal: "blue", low: "grey" };
const STAT: Record<Ticket["status"], Tone> = { open: "red", pending: "yellow", resolved: "green" };

export function Support({ openTenant }: { openTenant: (s: string) => void }) {
  const { tickets, team, sources, mutate, set } = usePlatform();
  const [filter, setFilter] = useState<"active" | Ticket["status"]>("active");
  const [sel, setSel] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const list = useMemo(() => tickets.filter((t) => (filter === "active" ? t.status !== "resolved" : t.status === filter)).sort((a, b) => ["urgent", "high", "normal", "low"].indexOf(a.priority) - ["urgent", "high", "normal", "low"].indexOf(b.priority)), [tickets, filter]);
  const cur = tickets.find((t) => t.id === (sel ?? list[0]?.id));
  const upd = (id: string, c: Partial<Ticket>) => set("tickets", (p) => p.map((x) => (x.id === id ? { ...x, ...c } : x)));

  const send = () => {
    if (!cur || !reply.trim()) return;
    const r = { from: "You", body: reply.trim(), at: new Date().toISOString() };
    void mutate({ label: "Reply sent", call: () => api.post(PLATFORM.ticketReply(cur.id), { body: r.body }), local: () => upd(cur.id, { replies: [...cur.replies, r], status: "pending" }), audit: { action: `Replied to ticket ${cur.id}`, target: cur.tenant_name, category: "support" } }).then((ok) => ok && setReply(""));
  };
  const setField = (c: Partial<Ticket>, label: string) => cur && mutate({ label, call: () => api.patch(PLATFORM.ticketDetail(cur.id), c), local: () => upd(cur.id, c), audit: { action: `${label} (${cur.id})`, target: cur.tenant_name, category: "support" } });

  return (
    <>
      <PageHead title="Support" crumb="Support" />
      <SampleBanner source={sources.tickets} what="Support requests" />
      <div className="pf-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr)" }}>
        <Card>
          <div className="pf-chips mb-4">{(["active", "open", "pending", "resolved"] as const).map((k) => <button key={k} className={`pf-chip capitalize ${filter === k ? "on" : ""}`} onClick={() => { setFilter(k); setSel(null); }}>{k === "active" ? "Not resolved" : k}</button>)}</div>
          {list.length === 0 ? <Empty>Nothing here.</Empty> : (
            <ul className="space-y-2">
              {list.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setSel(t.id)} className="w-full rounded-xl p-3 text-left transition" style={{ background: cur?.id === t.id ? "var(--pf-blue-soft)" : "var(--pf-bg)" }}>
                    <div className="flex items-center gap-2"><Pill tone={PRIO[t.priority]}>{t.priority}</Pill><span className="pf-muted text-xs">{t.id} · {ago(t.created_at)}</span></div>
                    <b className="mt-1.5 block text-sm">{t.subject}</b>
                    <span className="pf-muted text-xs">{t.tenant_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {cur ? (
          <Card title={cur.subject} actions={<Pill tone={STAT[cur.status]} solid>{cur.status}</Pill>}>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <button className="font-bold" style={{ color: "var(--pf-blue)" }} onClick={() => openTenant(cur.tenant_slug)}>{cur.tenant_name} →</button>
              <select className="pf-select" style={{ width: 130, height: 32 }} value={cur.priority} onChange={(e) => setField({ priority: e.target.value as Ticket["priority"] }, "Priority changed")}>{Object.keys(PRIO).map((p) => <option key={p}>{p}</option>)}</select>
              <select className="pf-select" style={{ width: 160, height: 32 }} value={cur.assignee ?? ""} onChange={(e) => setField({ assignee: e.target.value }, "Assigned")}><option value="">Unassigned</option>{team.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}</select>
              {cur.status !== "resolved" ? <button className="pf-btn pf-btn-success pf-btn-sm ml-auto" onClick={() => setField({ status: "resolved" }, "Marked resolved")}>Mark resolved</button> : <button className="pf-btn pf-btn-ghost pf-btn-sm ml-auto" onClick={() => setField({ status: "open" }, "Reopened")}>Reopen</button>}
            </div>
            <div className="space-y-3">
              <Msg from={cur.tenant_name} body={cur.body} at={cur.created_at} />
              {cur.replies.map((r, i) => <Msg key={i} from={r.from} body={r.body} at={r.at} mine />)}
            </div>
            <div className="mt-4 flex gap-2">
              <textarea className="pf-textarea" rows={2} placeholder="Write a reply… (sent to the owner on WhatsApp & email)" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
              <button className="pf-btn pf-btn-primary self-end" disabled={!reply.trim()} onClick={send}><Send className="h-4 w-4" /></button>
            </div>
          </Card>
        ) : <Card><Empty>Pick a request.</Empty></Card>}
      </div>
    </>
  );
}

function Msg({ from, body, at, mine }: { from: string; body: string; at: string; mine?: boolean }) {
  return (
    <div className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar name={from} size={32} />
      <div className="max-w-[80%] rounded-2xl p-3 text-sm" style={{ background: mine ? "var(--pf-blue-soft)" : "var(--pf-bg)" }}>
        <div className="mb-1 text-xs"><b>{from}</b> <span className="pf-muted">· {ago(at)}</span></div>{body}
      </div>
    </div>
  );
}
