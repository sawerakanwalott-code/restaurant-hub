/**
 * ============================================================================
 * SLICE 1.3 — ONE ORDER-STATUS VOCABULARY
 * ============================================================================
 *
 * Backend truth:  pending -> confirmed -> kitchen -> packed -> onway -> delivered
 *                 (cancelled can happen at any point)
 *
 * The old UI invented `cooking` and `picking`. Those are now aliases that map
 * onto the backend words here, so no screen ships its own spelling again.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "kitchen"
  | "packed"
  | "onway"
  | "delivered"
  | "cancelled";

/** The happy path, in order. `cancelled` is deliberately outside it. */
export const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "kitchen",
  "packed",
  "onway",
  "delivered",
];

const ALIASES: Record<string, OrderStatus> = {
  // legacy frontend words
  cooking: "kitchen",
  preparing: "kitchen",
  in_kitchen: "kitchen",
  picking: "onway",
  picked: "onway",
  out_for_delivery: "onway",
  on_way: "onway",
  "on-the-way": "onway",
  dispatched: "onway",
  ready: "packed",
  packing: "packed",
  completed: "delivered",
  complete: "delivered",
  canceled: "cancelled",
  rejected: "cancelled",
  new: "pending",
  placed: "pending",
  accepted: "confirmed",
};

export function normalizeStatus(raw: string | null | undefined): OrderStatus {
  const value = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((STATUS_FLOW as string[]).includes(value) || value === "cancelled") {
    return value as OrderStatus;
  }
  return ALIASES[value] ?? "pending";
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  kitchen: "In the Kitchen",
  packed: "Packed & Sealed",
  onway: "Rider On The Way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_HINT: Record<OrderStatus, string> = {
  pending: "Waiting for the restaurant to accept",
  confirmed: "Payment verified, ticket printed",
  kitchen: "Charcoal fired, your dish is cooking",
  packed: "Boxed hot with free dips",
  onway: "Live tracking is active",
  delivered: "Enjoy your meal!",
  cancelled: "This order was cancelled",
};

/** Tone token for badges — maps to the design system, not raw colours. */
export const STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "warn" | "good" | "bad"> = {
  pending: "neutral",
  confirmed: "info",
  kitchen: "warn",
  packed: "warn",
  onway: "info",
  delivered: "good",
  cancelled: "bad",
};

export const statusIndex = (status: string | null | undefined) =>
  STATUS_FLOW.indexOf(normalizeStatus(status));

/** The next status a staff member would advance this order to, if any. */
export function nextStatus(status: string | null | undefined): OrderStatus | null {
  const current = normalizeStatus(status);
  if (current === "cancelled" || current === "delivered") return null;
  return STATUS_FLOW[STATUS_FLOW.indexOf(current) + 1] ?? null;
}

export const isTerminal = (status: string | null | undefined) => {
  const s = normalizeStatus(status);
  return s === "delivered" || s === "cancelled";
};

export const isLive = (status: string | null | undefined) => !isTerminal(status);

/** 0-100 progress for timelines and bars. */
export function statusProgress(status: string | null | undefined): number {
  const s = normalizeStatus(status);
  if (s === "cancelled") return 0;
  return Math.round((statusIndex(s) / (STATUS_FLOW.length - 1)) * 100);
}
