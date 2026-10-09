import { useState } from "react";
import { Check, Minus, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { TeamMember } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { ago, Avatar, Card, Field, Modal, PageHead, Pill, SampleBanner } from "../ui";

export const ROLES: Record<TeamMember["role"], string> = { super_owner: "Owner (full access)", finance: "Finance", support: "Support", sales: "Sales", viewer: "View only" };
const PERMS: [string, TeamMember["role"][]][] = [
  ["See dashboard & reports", ["super_owner", "finance", "support", "sales", "viewer"]],
  ["Add & edit restaurants", ["super_owner", "sales"]],
  ["Pause / delete restaurants", ["super_owner"]],
  ["Open a restaurant's admin", ["super_owner", "support"]],
  ["Change plans & prices", ["super_owner"]],
  ["Approve payments & invoices", ["super_owner", "finance"]],
  ["Answer support requests", ["super_owner", "support"]],
  ["Send announcements", ["super_owner", "support", "sales"]],
  ["Manage team", ["super_owner"]],
  ["Change platform settings", ["super_owner"]],
];

export function Team() {
  const { team, sources, mutate, set } = usePlatform();
  const [invite, setInvite] = useState(false);
  const upd = (id: string, c: Partial<TeamMember>, label: string, who: string) => mutate({ label, call: () => api.patch(PLATFORM.teamMember(id), c), local: () => set("team", (p) => p.map((m) => (m.id === id ? { ...m, ...c } : m))), audit: { action: label, target: who, category: "team" } });

  return (
    <>
      <PageHead title="Team & access" crumb="Team" actions={<button className="pf-btn pf-btn-primary" onClick={() => setInvite(true)}><UserPlus className="h-4 w-4" /> Invite member</button>} />
      <SampleBanner source={sources.team} what="Your platform team" />
      <Card title={`Your team · ${team.length}`}>
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead><tr><th>Member</th><th>Role</th><th>Two-step login</th><th>Last active</th><th>Status</th><th /></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id} style={{ opacity: m.status === "disabled" ? 0.5 : 1 }}>
                  <td><div className="flex items-center gap-3"><Avatar name={m.name} /><div><b>{m.name}</b><div className="pf-muted text-xs">{m.email}</div></div></div></td>
                  <td>
                    {m.role === "super_owner" ? <b className="text-sm">{ROLES[m.role]}</b> : (
                      <select className="pf-select" style={{ height: 32, width: 140 }} value={m.role} onChange={(e) => upd(m.id, { role: e.target.value as TeamMember["role"] }, `Changed role to ${ROLES[e.target.value as TeamMember["role"]]}`, m.name)}>
                        {Object.entries(ROLES).filter(([k]) => k !== "super_owner").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    )}
                  </td>
                  <td>{m.two_factor ? <Pill tone="green"><ShieldCheck className="h-3 w-3" /> On</Pill> : <Pill tone="orange"><ShieldOff className="h-3 w-3" /> Off</Pill>}</td>
                  <td className="pf-muted text-sm">{ago(m.last_active)}</td>
                  <td><Pill tone={m.status === "active" ? "blue" : m.status === "invited" ? "yellow" : "grey"} solid={m.status === "active"}>{m.status}</Pill></td>
                  <td className="text-right">{m.role !== "super_owner" ? <button className={`pf-btn pf-btn-sm ${m.status === "disabled" ? "pf-btn-success" : "pf-btn-danger"}`} onClick={() => upd(m.id, { status: m.status === "disabled" ? "active" : "disabled" }, m.status === "disabled" ? "Re-enabled member" : "Disabled member", m.name)}>{m.status === "disabled" ? "Enable" : "Disable"}</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Who can do what" className="mt-[22px]">
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead><tr><th>Permission</th>{Object.values(ROLES).map((r) => <th key={r} className="text-center">{r.replace(" (full access)", "")}</th>)}</tr></thead>
            <tbody>
              {PERMS.map(([p, roles]) => (
                <tr key={p}><td className="text-sm">{p}</td>{(Object.keys(ROLES) as TeamMember["role"][]).map((r) => <td key={r} className="text-center">{roles.includes(r) ? <Check className="mx-auto h-4 w-4" style={{ color: "var(--pf-green)" }} /> : <Minus className="pf-muted mx-auto h-4 w-4" />}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {invite ? <InviteModal onClose={() => setInvite(false)} /> : null}
    </>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const { mutate, set } = usePlatform();
  const [f, setF] = useState({ name: "", email: "", role: "support" as TeamMember["role"] });
  return (
    <Modal title="Invite a team member" onClose={onClose} footer={<>
      <button className="pf-btn pf-btn-ghost" onClick={onClose}>Cancel</button>
      <button className="pf-btn pf-btn-primary" disabled={!f.name || !f.email.includes("@")} onClick={() => {
        const m: TeamMember = { id: `u${Date.now()}`, ...f, two_factor: false, last_active: new Date().toISOString(), status: "invited" };
        void mutate({ label: `Invite sent to ${f.email}`, call: () => api.post(PLATFORM.team, f), local: () => set("team", (p) => [...p, m]), audit: { action: "Invited team member", target: f.email, category: "team" } }).then((ok) => ok && onClose());
      }}>Send invite</button>
    </>}>
      <Field label="Name"><input className="pf-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Email"><input className="pf-input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Role"><select className="pf-select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as TeamMember["role"] })}>{Object.entries(ROLES).filter(([k]) => k !== "super_owner").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
    </Modal>
  );
}
