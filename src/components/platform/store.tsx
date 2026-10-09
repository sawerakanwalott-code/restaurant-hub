import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import * as S from "@/lib/platform/sample";
import type {
  Announcement,
  AuditEvent,
  DataSource,
  Integration,
  Invoice,
  Plan,
  PlatformSettings,
  PlatformStats,
  PlatformTenant,
  TeamMember,
  Ticket,
} from "@/lib/platform/types";

type Trend = ReturnType<typeof S.sampleTrend>;

type State = {
  stats: PlatformStats | null;
  tenants: PlatformTenant[];
  invoices: Invoice[];
  plans: Plan[];
  tickets: Ticket[];
  announcements: Announcement[];
  team: TeamMember[];
  audit: AuditEvent[];
  integrations: Integration[];
  settings: PlatformSettings;
  trend: Trend;
};

type Sources = Partial<Record<keyof State, DataSource>>;

type Ctx = State & {
  loading: boolean;
  sources: Sources;
  reload: () => Promise<void>;
  set: <K extends keyof State>(key: K, updater: (prev: State[K]) => State[K]) => void;
  /**
   * Run a backend mutation. If the endpoint isn't built yet (404/405/network),
   * the change is kept on screen only and the user is told so.
   */
  mutate: (opts: { label: string; call: () => Promise<unknown>; local: () => void; audit?: Omit<AuditEvent, "id" | "at" | "actor"> }) => Promise<boolean>;
};

const PlatformCtx = createContext<Ctx | null>(null);

const asList = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : Array.isArray((r as { results?: T[] })?.results) ? (r as { results: T[] }).results : []);

const notBuilt = (e: unknown) => e instanceof ApiError && (e.isNetwork || [404, 405, 501].includes(e.status));

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => ({
    stats: null,
    tenants: [],
    invoices: [],
    plans: S.samplePlans(),
    tickets: S.sampleTickets(),
    announcements: S.sampleAnnouncements(),
    team: S.sampleTeam(),
    audit: S.sampleAudit(),
    integrations: S.sampleIntegrations(),
    settings: S.sampleSettings(),
    trend: S.sampleTrend(),
  }));
  const [sources, setSources] = useState<Sources>({});
  const [loading, setLoading] = useState(true);

  const set: Ctx["set"] = useCallback((key, updater) => {
    setState((s) => ({ ...s, [key]: updater(s[key]) }));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const load = async <K extends keyof State>(key: K, path: string, fallback: () => State[K], list = true) => {
      try {
        const res = await api.get<unknown>(path);
        const value = (list ? asList(res) : res) as State[K];
        if (list && (value as unknown[]).length === 0 && key !== "tenants" && key !== "invoices") throw new Error("empty");
        setState((s) => ({ ...s, [key]: value }));
        setSources((p) => ({ ...p, [key]: "live" }));
        return value;
      } catch {
        const value = fallback();
        setState((s) => ({ ...s, [key]: value }));
        setSources((p) => ({ ...p, [key]: "sample" }));
        return value;
      }
    };
    const tenants = await load("tenants", PLATFORM.tenants, S.sampleTenants);
    await Promise.all([
      load("stats", PLATFORM.stats, () => S.sampleStats(tenants), false),
      load("invoices", PLATFORM.invoices, S.sampleInvoices),
      load("plans", PLATFORM.plans, S.samplePlans),
      load("tickets", PLATFORM.tickets, S.sampleTickets),
      load("announcements", PLATFORM.announcements, S.sampleAnnouncements),
      load("team", PLATFORM.team, S.sampleTeam),
      load("audit", PLATFORM.audit, S.sampleAudit),
      load("integrations", PLATFORM.integrations, S.sampleIntegrations),
      load("settings", PLATFORM.settings, S.sampleSettings, false),
      load("trend", PLATFORM.trend, S.sampleTrend),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate: Ctx["mutate"] = useCallback(async ({ label, call, local, audit }) => {
    const log = () => {
      if (!audit) return;
      setState((s) => ({
        ...s,
        audit: [{ ...audit, id: `l${Date.now()}`, at: new Date().toISOString(), actor: "You" }, ...s.audit],
      }));
    };
    try {
      await call();
      local();
      log();
      toast.success(label);
      return true;
    } catch (e) {
      if (notBuilt(e)) {
        local();
        log();
        toast.message(label, { description: "Shown on this screen only — the backend for this isn't ready yet." });
        return true;
      }
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      return false;
    }
  }, []);

  const value = useMemo<Ctx>(() => ({ ...state, loading, sources, reload, set, mutate }), [state, loading, sources, reload, set, mutate]);
  return <PlatformCtx.Provider value={value}>{children}</PlatformCtx.Provider>;
}

export function usePlatform() {
  const ctx = useContext(PlatformCtx);
  if (!ctx) throw new Error("usePlatform outside PlatformProvider");
  return ctx;
}
