import { useEffect, type ReactNode } from "react";
import { Database, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DataSource, InvoiceStatus, SubStatus } from "@/lib/platform/types";

export const pkr = (n: number | string | undefined) => "₨ " + Math.round(Number(n) || 0).toLocaleString("en-PK");
export const num = (n: number | undefined) => (Number(n) || 0).toLocaleString("en-PK");
export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-PK", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const daysUntil = (d?: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : null);
export const ago = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export type Tone = "blue" | "yellow" | "orange" | "red" | "green" | "violet" | "grey";

const AVATAR_TONES: Tone[] = ["blue", "orange", "violet", "green", "yellow", "red"];
export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const tone = AVATAR_TONES[name.length % AVATAR_TONES.length];
  return <span className={`pf-avatar tone-${tone}`} style={{ width: size, height: size }}>{initials}</span>;
}

export function Pill({ tone, solid, children }: { tone: Tone; solid?: boolean; children: ReactNode }) {
  return <span className={`pf-pill ${solid ? `solid-${tone}` : `tone-${tone}`}`}>{children}</span>;
}

export const SUB_TONE: Record<SubStatus, [Tone, string]> = {
  active: ["blue", "Active"],
  trialing: ["yellow", "Trial"],
  past_due: ["orange", "Past due"],
  cancelled: ["red", "Cancelled"],
  none: ["grey", "No plan"],
};
export const SubPill = ({ s }: { s: SubStatus }) => {
  const [t, l] = SUB_TONE[s] ?? SUB_TONE.none;
  return <Pill tone={t} solid>{l}</Pill>;
};

export const INV_TONE: Record<InvoiceStatus, [Tone, string]> = {
  pending: ["grey", "Pending"],
  under_review: ["yellow", "Needs review"],
  paid: ["green", "Paid"],
  rejected: ["red", "Rejected"],
};
export const InvPill = ({ s }: { s: InvoiceStatus }) => {
  const [t, l] = INV_TONE[s] ?? INV_TONE.pending;
  return <Pill tone={t} solid={s !== "pending"}>{l}</Pill>;
};

export function Kpi({ icon: Icon, tone, value, label, hint, onClick }: { icon: LucideIcon; tone: Tone; value: ReactNode; label: string; hint?: ReactNode; onClick?: () => void }) {
  return (
    <div className="pf-kpi" onClick={onClick} style={{ cursor: onClick ? "pointer" : undefined }}>
      <span className={`pf-kpi-icon tone-${tone}`}><Icon className="h-8 w-8" /></span>
      <div className="min-w-0">
        <h3 className="pf-display">{value}</h3>
        <p>{label}</p>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

export function PageHead({ title, crumb, actions }: { title: string; crumb: string; actions?: ReactNode }) {
  return (
    <div className="pf-head pf-fade">
      <div>
        <h1>{title}</h1>
        <div className="pf-crumbs"><span>Platform</span><span>›</span><b>{crumb}</b></div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`pf-card pf-fade ${className}`}>
      {title ? <div className="pf-card-head"><h3>{title}</h3>{actions}</div> : null}
      {children}
    </section>
  );
}

export function SampleBanner({ source, what }: { source?: DataSource; what: string }) {
  if (source !== "sample") return null;
  return (
    <div className="pf-banner tone-yellow pf-fade">
      <Database className="h-4 w-4 shrink-0" />
      <span><b>Sample data.</b> {what} isn't coming from your backend yet — changes stay on this screen until it's built (see do_backend.md).</span>
    </div>
  );
}

function useEsc(onClose: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEsc(onClose);
  return (
    <>
      <div className="pf-overlay" onClick={onClose} />
      <div className="pf-modal pf-fade" role="dialog" aria-label={title}>
        <div className="mb-4 flex items-center gap-3">
          <h3 className="mr-auto text-lg font-bold">{title}</h3>
          <button className="pf-icon-btn" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer ? <div className="pf-modal-actions mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </>
  );
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEsc(onClose);
  return (
    <>
      <div className="pf-overlay" onClick={onClose} />
      <aside className="pf-drawer" role="dialog">{children}</aside>
    </>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="pf-label">{label}</span>{children}</label>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" aria-label={label} aria-pressed={on} className={`pf-switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} />;
}

export function Progress({ value, max, tone = "blue" }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const t = pct > 90 ? "red" : pct > 70 ? "orange" : tone;
  return <div className="pf-progress"><span style={{ width: `${pct}%`, background: `var(--pf-${t === "grey" ? "muted" : t})` }} /></div>;
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="pf-empty">{children}</div>;
}
