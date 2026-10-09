import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";

import type { AuditEvent } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { ago, Avatar, Card, downloadCsv, Empty, fmtDateTime, PageHead, Pill, SampleBanner, type Tone } from "../ui";

const CAT: Record<AuditEvent["category"], Tone> = { tenant: "blue", billing: "green", team: "violet", security: "red", settings: "orange", support: "yellow" };

export function Audit() {
  const { audit, sources } = usePlatform();
  const [cat, setCat] = useState<"all" | AuditEvent["category"]>("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => audit.filter((e) => (cat === "all" || e.category === cat) && (!q || `${e.actor} ${e.action} ${e.target}`.toLowerCase().includes(q.toLowerCase()))), [audit, cat, q]);
  return (
    <>
      <PageHead title="Activity log" crumb="Activity log" actions={<button className="pf-btn pf-btn-ghost" onClick={() => downloadCsv("activity-log", rows.map(({ id: _id, ...r }) => r))}><Download className="h-4 w-4" /> Export</button>} />
      <SampleBanner source={sources.audit} what="Older activity" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="pf-chips">{(["all", ...Object.keys(CAT)] as const).map((k) => <button key={k} className={`pf-chip capitalize ${cat === k ? "on" : ""}`} onClick={() => setCat(k as typeof cat)}>{k === "tenant" ? "restaurants" : k}</button>)}</div>
          <div className="relative ml-auto"><Search className="pf-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input className="pf-input" style={{ paddingLeft: 36, width: 240 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {rows.length === 0 ? <Empty>No activity.</Empty> : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>On</th><th>Type</th><th>IP</th></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-sm">{fmtDateTime(e.at)}<div className="pf-muted text-xs">{ago(e.at)}</div></td>
                    <td><div className="flex items-center gap-2"><Avatar name={e.actor} size={28} /><span className="text-sm">{e.actor}</span></div></td>
                    <td className="text-sm font-bold">{e.action}</td>
                    <td className="text-sm">{e.target}</td>
                    <td><Pill tone={CAT[e.category]}>{e.category === "tenant" ? "restaurant" : e.category}</Pill></td>
                    <td className="pf-muted pf-display text-xs">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
