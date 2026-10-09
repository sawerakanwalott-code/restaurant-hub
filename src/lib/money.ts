/**
 * ============================================================================
 * SLICE 1.4 — MONEY IS PARSED IN EXACTLY ONE PLACE
 * ============================================================================
 *
 * The backend sends decimal *strings* ("450.00"). Components used to call
 * Number() inline, which silently produced NaN for null/undefined and printed
 * "Rs NaN". Everything money-shaped now goes through here.
 *
 * Reminder: the server recalculates prices. A cart total is a preview only —
 * the real bill is whatever the order response says.
 */

export type Money = number;

/** Parse anything the API can hand us into a safe number. */
export function parseMoney(value: unknown, fallback = 0): Money {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** "Rs 1,450" — whole rupees by default, decimals only when they matter. */
export function formatMoney(value: unknown, opts: { decimals?: boolean } = {}): string {
  const n = parseMoney(value);
  const decimals = opts.decimals ?? !Number.isInteger(n);
  return `Rs ${n.toLocaleString("en-PK", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

/** Same as formatMoney but blank instead of "Rs 0" when there is nothing. */
export function formatMoneyOrDash(value: unknown): string {
  const n = parseMoney(value, Number.NaN);
  return Number.isFinite(n) ? formatMoney(n) : "—";
}

/**
 * The authoritative bill, read defensively off an order response.
 * Field names that are still unconfirmed get a fallback chain so a rename
 * shows zero instead of crashing the screen.
 */
export type Bill = {
  subtotal: Money;
  discount: Money;
  deliveryFee: Money;
  total: Money;
};

export function readBill(order: Record<string, unknown> | null | undefined): Bill {
  const o = order ?? {};
  return {
    subtotal: parseMoney(o["subtotal"] ?? o["items_total"]),
    discount: parseMoney(o["discount"] ?? o["discount_amount"]),
    deliveryFee: parseMoney(o["delivery_fee"] ?? o["deliveryFee"] ?? o["shipping_fee"]),
    total: parseMoney(o["total"] ?? o["grand_total"] ?? o["amount"]),
  };
}
