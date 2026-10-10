import { describe, expect, it } from "vitest";
import { changeDue, computeTotals, expectedCash, quickCash } from "@/lib/pos";

const base = { discount: { kind: "flat" as const, value: 0, reason: "" }, couponDiscount: 0, taxPercent: 0, servicePercent: 0, deliveryFee: 0 };

describe("POS totals", () => {
  it("adds lines", () => {
    expect(computeTotals({ ...base, lines: [{ unitPrice: 500, qty: 2 }, { unitPrice: 300, qty: 1 }] }).total).toBe(1300);
  });
  it("percent discount then tax on discounted amount", () => {
    const t = computeTotals({ ...base, lines: [{ unitPrice: 1000, qty: 1 }], discount: { kind: "percent", value: 10, reason: "" }, taxPercent: 16 });
    expect(t.discount).toBe(100);
    expect(t.tax).toBe(144);
    expect(t.total).toBe(1044);
  });
  it("discount never exceeds subtotal", () => {
    expect(computeTotals({ ...base, lines: [{ unitPrice: 200, qty: 1 }], discount: { kind: "flat", value: 500, reason: "" } }).total).toBe(0);
  });
  it("delivery fee added after tax", () => {
    expect(computeTotals({ ...base, lines: [{ unitPrice: 1000, qty: 1 }], taxPercent: 10, deliveryFee: 150 }).total).toBe(1250);
  });
  it("change due", () => {
    expect(changeDue(1250, 2000)).toBe(750);
    expect(changeDue(1250, 1000)).toBe(0);
  });
  it("quick cash suggests rounded notes", () => {
    expect(quickCash(1250)).toEqual([1250, 1300, 1500, 2000, 5000]);
  });
  it("expected drawer cash = float + cash sales + moves", () => {
    const shift = { id: "s", openedAt: "", openedBy: "", openingFloat: 5000, moves: [{ at: "", kind: "out" as const, amount: 1000, reason: "" }] };
    const sales = [
      { code: "a", at: "", type: "takeaway" as const, total: 2000, payments: [{ method: "cash" as const, amount: 1500 }, { method: "card" as const, amount: 500 }], synced: true, payload: null, receipt: null },
      { code: "b", at: "", type: "takeaway" as const, total: 900, payments: [{ method: "cash" as const, amount: 900 }], synced: true, voided: true, payload: null, receipt: null },
    ];
    expect(expectedCash(shift, sales)).toBe(5500);
  });
});
