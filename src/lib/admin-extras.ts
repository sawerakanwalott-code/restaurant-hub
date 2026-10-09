/**
 * Restaurant-admin sections that the backend hasn't shipped yet.
 * Each loader tries the real endpoint first; on 404/405/501/network it falls
 * back to sample data and flags `sample: true` so the page can say so.
 * Paths are documented at the end of do_backend.md.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api/client";

export const ADMIN_EXTRA = {
  settings: "/admin/settings/",
  coupons: "/admin/coupons/",
  coupon: (id: string) => `/admin/coupons/${id}/`,
  reviews: "/admin/reviews/",
  reviewReply: (id: string) => `/admin/reviews/${id}/reply/`,
  review: (id: string) => `/admin/reviews/${id}/`,
  audit: "/admin/audit/",
  reportsSales: "/admin/reports/sales/",
} as const;

const notBuilt = (e: unknown) =>
  e instanceof ApiError && (e.isNetwork || [404, 405, 501].includes(e.status));

const asList = <T,>(r: unknown): T[] =>
  Array.isArray(r) ? (r as T[]) : Array.isArray((r as { results?: T[] })?.results) ? (r as { results: T[] }).results : [];

export function useAdminResource<T>(path: string, fallback: () => T, list = Array.isArray(fallback())) {
  const [data, setData] = useState<T>(fallback);
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(path);
      setData((list ? asList(r) : r) as T);
      setSample(false);
    } catch (e) {
      setData(fallback());
      setSample(true);
      if (!notBuilt(e)) console.warn("[admin-extras]", path, e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run a mutation; if not built yet, keep the change on screen only. */
  const mutate = useCallback(
    async (label: string, call: () => Promise<unknown>, local: (prev: T) => T) => {
      try {
        await call();
        setData(local);
        toast.success(label);
        return true;
      } catch (e) {
        if (notBuilt(e)) {
          setData(local);
          toast.info(`${label} (on this screen only)`, { description: "The server part isn't ready yet." });
          return true;
        }
        toast.error(e instanceof Error ? e.message : "Something went wrong");
        return false;
      }
    },
    [],
  );

  return { data, setData, sample, loading, reload: load, mutate };
}

/* ---------------- types ---------------- */

export type DayHours = { day: string; open: string; close: string; closed: boolean };
export type RestaurantSettings = {
  name: string;
  phone: string;
  address: string;
  logo_url: string;
  tax_percent: number;
  service_charge_percent: number;
  min_order: number;
  delivery_fee: number;
  free_delivery_over: number;
  delivery_radius_km: number;
  jazzcash_number: string;
  jazzcash_title: string;
  easypaisa_number: string;
  easypaisa_title: string;
  accept_cod: boolean;
  accept_wallets: boolean;
  require_receipt: boolean;
  auto_accept_orders: boolean;
  pause_online_orders: boolean;
  hours: DayHours[];
  holidays: { date: string; note: string }[];
};

export type Coupon = {
  id: string;
  code: string;
  kind: "percent" | "flat" | "free_delivery";
  value: number;
  min_order: number;
  max_discount: number | null;
  uses: number;
  max_uses: number | null;
  per_customer: number;
  starts: string;
  ends: string;
  active: boolean;
};

export type Review = {
  id: string;
  order_code: string;
  customer: string;
  rating: number;
  food: number;
  delivery: number;
  comment: string;
  at: string;
  reply: string | null;
  hidden: boolean;
};

export type AdminAudit = {
  id: string;
  at: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  category: "order" | "payment" | "menu" | "staff" | "settings" | "refund";
};

/* ---------------- samples ---------------- */

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const iso = (hAgo: number) => new Date(Date.now() - hAgo * 3600_000).toISOString();
const isoDay = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

export const sampleSettings = (): RestaurantSettings => ({
  name: "Kennedy Moon Grill",
  phone: "+92 300 0000000",
  address: "Main Bazaar, Narowal",
  logo_url: "",
  tax_percent: 16,
  service_charge_percent: 0,
  min_order: 500,
  delivery_fee: 150,
  free_delivery_over: 3000,
  delivery_radius_km: 6,
  jazzcash_number: "0300 0000000",
  jazzcash_title: "Kennedy Moon Grill",
  easypaisa_number: "0345 0000000",
  easypaisa_title: "Kennedy Moon Grill",
  accept_cod: true,
  accept_wallets: true,
  require_receipt: true,
  auto_accept_orders: false,
  pause_online_orders: false,
  hours: DAYS.map((day) => ({ day, open: "12:00", close: day === "Friday" || day === "Saturday" ? "02:00" : "00:00", closed: false })),
  holidays: [{ date: isoDay(20), note: "Eid — closed" }],
});

export const sampleCoupons = (): Coupon[] => [
  { id: "c1", code: "MOON20", kind: "percent", value: 20, min_order: 1500, max_discount: 600, uses: 142, max_uses: 500, per_customer: 1, starts: isoDay(-10), ends: isoDay(20), active: true },
  { id: "c2", code: "FREEDEL", kind: "free_delivery", value: 0, min_order: 1000, max_discount: null, uses: 61, max_uses: null, per_customer: 3, starts: isoDay(-30), ends: isoDay(5), active: true },
  { id: "c3", code: "FLAT300", kind: "flat", value: 300, min_order: 2500, max_discount: null, uses: 200, max_uses: 200, per_customer: 1, starts: isoDay(-60), ends: isoDay(-2), active: false },
];

export const sampleReviews = (): Review[] => [
  { id: "r1", order_code: "KMG-1042", customer: "Ali Raza", rating: 5, food: 5, delivery: 5, comment: "Malai boti was unreal. Rider came early!", at: iso(3), reply: null, hidden: false },
  { id: "r2", order_code: "KMG-1037", customer: "Sana K.", rating: 3, food: 4, delivery: 2, comment: "Food good but delivery took 70 minutes.", at: iso(9), reply: "Sorry Sana — we've added a rider on weekends.", hidden: false },
  { id: "r3", order_code: "KMG-1029", customer: "Usman", rating: 1, food: 1, delivery: 3, comment: "Karahi was cold.", at: iso(26), reply: null, hidden: false },
  { id: "r4", order_code: "KMG-1018", customer: "Hira", rating: 4, food: 5, delivery: 4, comment: "Biryani portion could be bigger, taste 10/10.", at: iso(50), reply: null, hidden: false },
];

export const sampleAudit = (): AdminAudit[] => [
  { id: "a1", at: iso(0.2), actor: "Hussnain", role: "owner", action: "Verified JazzCash payment", target: "KMG-1042", category: "payment" },
  { id: "a2", at: iso(1), actor: "Bilal", role: "cashier", action: "Created POS order", target: "KMG-1041", category: "order" },
  { id: "a3", at: iso(2), actor: "Hussnain", role: "owner", action: "Changed price 1,200 → 1,350", target: "Chicken Karahi", category: "menu" },
  { id: "a4", at: iso(5), actor: "Ayesha", role: "manager", action: "Refunded Rs 450", target: "KMG-1033", category: "refund" },
  { id: "a5", at: iso(8), actor: "Hussnain", role: "owner", action: "Added staff member", target: "Kamran (rider)", category: "staff" },
  { id: "a6", at: iso(30), actor: "Hussnain", role: "owner", action: "Changed opening hours", target: "Friday", category: "settings" },
];
