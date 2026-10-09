/**
 * Route guards for the dashboards (/profile, /admin, /rider).
 *
 * The cached account in localStorage is only used for the *instant* redirect
 * (so nothing flashes). The authoritative role is then read from the backend
 * (`AUTH.me`) via `verifyRole()`, so editing localStorage in DevTools can no
 * longer unlock an admin UI. If the backend is unreachable (Railway cold start)
 * we keep the cached role rather than logging people out.
 */
import { redirect } from "@tanstack/react-router";

import { mustChangePassword, readAccount, verifyRole, type AccountRole } from "@/lib/auth";
import { normalizeRole, roleHome, type AppRole } from "@/lib/roles";

/** Where the user was heading, so login can bounce them straight back. */
export type RedirectSearch = { redirect?: string };

export const validateRedirectSearch = (search: Record<string, unknown>): RedirectSearch => {
  const raw = search["redirect"];
  // Only same-origin, path-style redirects — never an absolute URL.
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? { redirect: raw } : {};
};

export function requireRole(allowed: Array<AppRole | AccountRole>) {
  const allowedRoles = allowed.map(normalizeRole);

  return async ({ location }: { location: { href: string } }) => {
    // These routes render client-side (ssr: false), so localStorage is safe.
    if (typeof window === "undefined") return;

    const account = readAccount();
    if (!account) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    // Server-verified role wins; cached role is the offline fallback.
    let role: AppRole = normalizeRole(account.role);
    try {
      const verified = await verifyRole();
      if (verified) role = normalizeRole(verified);
    } catch {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    // SLICE 1.4 — a temp password locks the whole app until it is replaced.
    if (mustChangePassword() && !location.href.startsWith("/change-password")) {
      throw redirect({ to: "/change-password", search: { redirect: location.href } });
    }

    // Platform Superuser has universal access to all consoles
    if (account.isSuperuser) {
      return;
    }

    if (!allowedRoles.includes(role)) {
      throw redirect({ to: roleHome(role) });
    }
  };
}
