import { CloudOff } from "lucide-react";

/** Shown when a section is running on sample data because the server part isn't built yet. */
export function SampleNote({ show, what }: { show: boolean; what: string }) {
  if (!show) return null;
  return (
    <div className="panel-lux flex items-start gap-3 border-amber-lux/30 px-4 py-3 text-xs text-mist">
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-lux" />
      <p>
        <span className="font-black uppercase tracking-[0.16em] text-amber-lux">Preview data · </span>
        {what} isn't connected to the server yet. Changes stay on this screen until it's ready.
      </p>
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-lux/70">{eyebrow}</p>
        <h1 className="mt-1 font-hero num-lux text-4xl tracking-wide">{title}</h1>
        <p className="mt-1 text-sm text-slate-dim">{sub}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${on ? "border-lux/60 bg-lux/30" : "border-lux/15 bg-ink-deep/60"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full transition ${on ? "translate-x-6 bg-lux" : "translate-x-1 bg-slate-dim"}`} />
    </button>
  );
}
