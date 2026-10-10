/**
 * Counter POS — pure helpers (totals, held orders, shift math).
 * The server recalculates the real bill; these numbers are the till preview.
 */
import type { Dish } from "@/lib/menu";
import { parseMoney } from "@/lib/money";

export type OrderType = "takeaway" | "dine_in" | "delivery";
export type PayMethod = "cash" | "card" | "jazzcash" | "easypaisa";

export type PosLine = {
  key: string;
  dishId?: number;
  slug: string;
  name: string;
  size: string;
  unitPrice: number;
  qty: number;
  note: string;
  sentQty: number; // already printed to kitchen
};

export type Discount = { kind: "flat" | "percent"; value: number; reason: string };

export type PosTotalsInput = {
  lines: Pick<PosLine, "unitPrice" | "qty">[];
  discount: Discount;
  couponDiscount: number;
  taxPercent: number;
  servicePercent: number; // applied to dine-in only by caller
  deliveryFee: number;
};

export type PosTotals = {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  service: number;
  tax: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
};

const r = (n: number) => Math.round(n);

export function computeTotals(i: PosTotalsInput): PosTotals {
  const subtotal = i.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const itemCount = i.lines.reduce((a, l) => a + l.qty, 0);
  const manual =
    i.discount.kind === "percent"
      ? (subtotal * Math.min(100, Math.max(0, i.discount.value))) / 100
      : Math.max(0, i.discount.value);
  const discount = r(Math.min(subtotal, manual + Math.max(0, i.couponDiscount)));
  const afterDiscount = subtotal - discount;
  const service = r((afterDiscount * Math.max(0, i.servicePercent)) / 100);
  const tax = r(((afterDiscount + service) * Math.max(0, i.taxPercent)) / 100);
  const deliveryFee = Math.max(0, i.deliveryFee);
  return { subtotal, discount, afterDiscount, service, tax, deliveryFee, total: afterDiscount + service + tax + deliveryFee, itemCount };
}

/** Cash notes to suggest after the exact amount. */
export function quickCash(total: number): number[] {
  const out = new Set<number>([total]);
  for (const step of [100, 500, 1000, 5000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 5);
}

export function changeDue(total: number, tendered: number) {
  return Math.max(0, tendered - total);
}

export function dishPrice(d: Dish, size?: string) {
  const s = d.sizes?.find((x) => x.size === size);
  return parseMoney(s?.price ?? d.price);
}

export const lineKey = (slug: string, size: string, note: string) => `${slug}|${size}|${note.trim().toLowerCase()}`;

/* ---------- shift ---------- */
export type CashMove = { at: string; kind: "in" | "out"; amount: number; reason: string };
export type Shift = {
  id: string;
  openedAt: string;
  openedBy: string;
  openingFloat: number;
  moves: CashMove[];
  closedAt?: string;
  countedCash?: number;
};

export type PosSale = {
  code: string;
  at: string;
  type: OrderType;
  total: number;
  payments: { method: PayMethod; amount: number }[];
  synced: boolean;
  voided?: boolean;
  payload: unknown;
  receipt: unknown;
};

export function expectedCash(shift: Shift, sales: PosSale[]) {
  const cashSales = sales
    .filter((s) => !s.voided)
    .reduce((a, s) => a + s.payments.filter((p) => p.method === "cash").reduce((b, p) => b + p.amount, 0), 0);
  const moves = shift.moves.reduce((a, m) => a + (m.kind === "in" ? m.amount : -m.amount), 0);
  return shift.openingFloat + cashSales + moves;
}

export function salesByMethod(sales: PosSale[]) {
  const out: Record<PayMethod, number> = { cash: 0, card: 0, jazzcash: 0, easypaisa: 0 };
  for (const s of sales) if (!s.voided) for (const p of s.payments) out[p.method] += p.amount;
  return out;
}

/* ---------- local persistence ---------- */
export const POS_KEYS = { held: "pos.held.v1", shift: "pos.shift.v1", sales: "pos.sales.v1", prefs: "pos.prefs.v1" };

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, v: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full */
  }
}
