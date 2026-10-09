/**
 * ============================================================================
 * COUPONS — SLICE 2.5
 * ============================================================================
 * The v2.4 system guide does NOT document a preview endpoint, so this module
 * is written defensively:
 *   - It tries the two plausible spellings of the preview path.
 *   - A 404 (endpoint absent) is NOT an error: the code is accepted as
 *     "pending" and sent with the order, where the backend has the final say.
 *   - A 400/422 with a message IS an error: the code is rejected inline.
 * The real discount always comes back on the order response (`getLastOrderBill`).
 */
import { ApiError, api, isBackendConfigured } from "@/lib/api/client";
import { ORDERS } from "@/lib/api/endpoints";

export type CouponState =
  | { status: "none" }
  | { status: "checking"; code: string }
  /** Verified by the backend — we know the discount up front. */
  | { status: "applied"; code: string; discount: number; label?: string }
  /** No preview endpoint on this deployment — the code rides along with the order. */
  | { status: "pending"; code: string }
  | { status: "invalid"; code: string; message: string };

type PreviewResponse = {
  discount?: number | string;
  discount_amount?: number | string;
  amount?: number | string;
  label?: string;
  description?: string;
  detail?: string;
  valid?: boolean;
};

const toNumber = (v: unknown): number => {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

export const normalizeCoupon = (code: string) => code.trim().toUpperCase();

/**
 * Ask the backend what a coupon is worth. Never throws.
 * Returns "pending" whenever the deployment has no preview endpoint.
 */
export async function previewCoupon(rawCode: string, subtotal: number): Promise<CouponState> {
  const code = normalizeCoupon(rawCode);
  if (!code) return { status: "none" };
  if (!isBackendConfigured()) return { status: "pending", code };

  const body = { code, coupon_code: code, subtotal };
  const paths = [ORDERS.applyCoupon, ORDERS.applyCouponAlt];

  for (const path of paths) {
    try {
      const res = await api.post<PreviewResponse>(path, body);
      if (res && res.valid === false) {
        return {
          status: "invalid",
          code,
          message: res.detail ?? "That code isn't valid for this order.",
        };
      }
      const discount = toNumber(res?.discount ?? res?.discount_amount ?? res?.amount);
      const label = res?.label ?? res?.description;
      if (discount > 0) return { status: "applied", code, discount, ...(label ? { label } : {}) };
      return { status: "pending", code };
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      // Endpoint missing on this build — try the next spelling, then ride along.
      if (status === 404 || status === 405) continue;
      // Network/offline — don't punish the customer, let the order decide.
      if (err instanceof ApiError && err.isNetwork) return { status: "pending", code };
      if (status === 400 || status === 404 || status === 422) {
        return {
          status: "invalid",
          code,
          message: err instanceof Error ? err.message : "That code isn't valid.",
        };
      }
      return { status: "pending", code };
    }
  }
  return { status: "pending", code };
}
