/**
 * SLICE 2.4 groundwork — branches.
 *
 * Every v2.4 order body carries `branch_id`. Until the branch picker screen
 * lands, we resolve one branch: the remembered choice, else the first branch
 * the backend returns, else the env default. Nothing here ever throws — a
 * missing branch simply means `branch_id` is left out of the order body and
 * the backend falls back to the tenant's default branch.
 */
import { api, isBackendConfigured } from "@/lib/api/client";
import { BRANCHES } from "@/lib/api/endpoints";

export type Branch = {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  is_active?: boolean;
  opens_at?: string;
  closes_at?: string;
  delivery_radius_km?: number;
  lat?: number;
  lng?: number;
};

const KEY = "kennedy.branch.id";

const envDefault = (): number | null => {
  const raw = import.meta.env["VITE_DEFAULT_BRANCH_ID"] as string | undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function rememberedBranchId(): number | null {
  if (typeof window === "undefined") return envDefault();
  const raw = localStorage.getItem(KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : envDefault();
}

export function rememberBranchId(id: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, String(id));
}

export async function fetchBranches(): Promise<Branch[]> {
  if (!isBackendConfigured()) return [];
  try {
    const list = await api.get<Branch[]>(BRANCHES.list);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const toMinutes = (t?: string): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hh = Number(h);
  const mm = Number(m ?? 0);
  return Number.isFinite(hh) ? hh * 60 + (Number.isFinite(mm) ? mm : 0) : null;
};

/** "11:00 – 23:30" when the branch publishes hours, else null. */
export function branchHours(b: Branch): string | null {
  if (!b.opens_at || !b.closes_at) return null;
  return `${b.opens_at.slice(0, 5)} – ${b.closes_at.slice(0, 5)}`;
}

/**
 * Open right now? Unknown hours count as open — we never hide a branch the
 * backend did not describe. Handles past-midnight closing times.
 */
export function isOpenNow(b: Branch, now = new Date()): boolean {
  const open = toMinutes(b.opens_at);
  const close = toMinutes(b.closes_at);
  if (open == null || close == null) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  return close > open ? mins >= open && mins < close : mins >= open || mins < close;
}

/** The branch id to send with the next order, or null when we can't tell. */
export async function resolveBranchId(): Promise<number | null> {
  const remembered = rememberedBranchId();
  if (remembered) return remembered;
  const list = await fetchBranches();
  const first = list.find((b) => b.is_active !== false) ?? list[0];
  if (first?.id) {
    rememberBranchId(first.id);
    return first.id;
  }
  return null;
}
