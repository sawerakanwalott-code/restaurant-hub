/**
 * ============================================================================
 * SLICE 1.1 — TENANT AWARENESS (multi-restaurant SaaS)
 * ============================================================================
 *
 * Every backend request carries `X-Tenant-Slug`. The slug is NEVER hardcoded
 * in a component: it is resolved once, here, from (in priority order)
 *
 *   1. an explicit override saved by the app (tenant switcher / onboarding)
 *   2. the production subdomain  (moon-grill-narowal.kennedy.app -> slug)
 *   3. VITE_DEFAULT_TENANT_SLUG  (local / preview default)
 *
 * `src/lib/api/client.ts` reads `currentTenantSlug()` on every request, so a
 * tenant change instantly applies to all traffic without prop drilling.
 */

const STORAGE_KEY = "kmg.tenant.slug";
export const TENANT_EVENT = "kmg-tenant-change";

/** Hosts that never carry a tenant subdomain. */
const NEUTRAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * KENNEDY MOON GRILL FRONTEND — TENANT LOCK
 * -----------------------------------------
 * This frontend is deployed for a single restaurant.
 * VITE_DEFAULT_TENANT_SLUG = moon-grill-narowal
 *
 * The VITE_ env var wins over everything (including localStorage)
 * so stale values from test sessions never bleed through.
 * The _override mechanism is still available for the platform
 * superuser console which needs to switch tenants.
 */
const LOCKED_SLUG = (
  import.meta.env["VITE_DEFAULT_TENANT_SLUG"] as string | undefined
)?.trim() || "moon-grill-narowal";

export const DEFAULT_TENANT_SLUG: string = LOCKED_SLUG;

function fromSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (NEUTRAL_HOSTS.has(host)) return null;
  // Lovable preview / published hosts are not tenant subdomains.
  if (/\.(lovable\.app|lovableproject\.com)$/.test(host)) return null;
  const parts = host.split(".");
  if (parts.length < 3) return null;
  const first = parts[0];
  if (!first || first === "www" || first === "app" || first === "api") return null;
  return first;
}

let _override: string | null = null;

/** The slug that every request should be scoped to right now. */
export function currentTenantSlug(): string {
  // Explicit override (set by platform superuser console) wins first
  if (_override) return _override;
  // Subdomain wins next (production multi-tenant hosting)
  const subdomain = fromSubdomain();
  if (subdomain) return subdomain;
  // For localhost/dev: return the locked env slug — ignore stale localStorage
  return LOCKED_SLUG;
}

/** Switch the active restaurant (onboarding, tenant switcher, admin tooling). */
export function setTenantSlug(slug: string | null) {
  _override = slug;
  if (typeof window === "undefined") return;
  try {
    if (slug) localStorage.setItem(STORAGE_KEY, slug);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TENANT_EVENT));
}

export type TenantInfo = { id?: number | string; name?: string; slug: string };

const INFO_KEY = "kmg.tenant.info";

/** Remember the tenant object returned by login / onboarding for UI display. */
export function rememberTenant(tenant: TenantInfo | null | undefined) {
  if (!tenant?.slug || typeof window === "undefined") return;
  setTenantSlug(tenant.slug);
  try {
    localStorage.setItem(INFO_KEY, JSON.stringify(tenant));
  } catch {
    /* ignore */
  }
}

export function readTenant(): TenantInfo {
  const slug = currentTenantSlug();
  if (typeof window === "undefined") return { slug };
  try {
    const raw = localStorage.getItem(INFO_KEY);
    const parsed = raw ? (JSON.parse(raw) as TenantInfo) : null;
    return parsed && parsed.slug === slug ? parsed : { slug };
  } catch {
    return { slug };
  }
}
