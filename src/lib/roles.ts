/**
 * ============================================================================
 * SLICE 1.2 — THE SEVEN ROLES AND WHAT EACH ONE MAY OPEN
 * ============================================================================
 *
 * Backend roles: customer, kitchen, rider, admin, owner, manager, cashier.
 * `staff` is a legacy alias the old build issued — it is normalised to
 * `kitchen` so nothing in the UI has to know about it.
 *
 * This module is the single source of truth: guards, redirects and nav
 * visibility all read from here. No route file invents its own role list.
 */

export type AppRole =
  | "customer"
  | "kitchen"
  | "rider"
  | "cashier"
  | "manager"
  | "admin"
  | "owner";

/** What the backend may send today, including the legacy spelling. */
export type RawRole = AppRole | "staff" | (string & {});

export const ALL_ROLES: AppRole[] = [
  "customer",
  "kitchen",
  "rider",
  "cashier",
  "manager",
  "admin",
  "owner",
];

export function normalizeRole(raw: RawRole | null | undefined): AppRole {
  const value = String(raw ?? "").toLowerCase();
  if (value === "staff") return "kitchen";
  return (ALL_ROLES as string[]).includes(value) ? (value as AppRole) : "customer";
}

/** Role groups used by the guards. */
export const KITCHEN_ROLES: AppRole[] = ["kitchen", "manager", "admin", "owner"];
export const ADMIN_ROLES: AppRole[] = ["kitchen", "cashier", "manager", "admin", "owner"];
export const OWNER_ROLES: AppRole[] = ["admin", "owner"];
export const RIDER_ROLES: AppRole[] = ["rider"];

/** Where each role lands after sign-in or when it hits a forbidden page. */
export const ROLE_HOME: Record<AppRole, string> = {
  customer: "/profile",
  kitchen: "/kitchen",
  rider: "/rider",
  cashier: "/admin/pos",
  manager: "/admin",
  admin: "/admin",
  owner: "/admin",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  customer: "Customer",
  kitchen: "Kitchen",
  rider: "Delivery Rider",
  cashier: "Cashier",
  manager: "Manager",
  admin: "Admin",
  owner: "Owner",
};

export const roleHome = (role: RawRole | null | undefined) => ROLE_HOME[normalizeRole(role)];

export const hasRole = (role: RawRole | null | undefined, allowed: AppRole[]) =>
  allowed.includes(normalizeRole(role));

/** Convenience predicates for nav/menu visibility. */
export const canOpenAdmin = (role: RawRole | null | undefined) => hasRole(role, ADMIN_ROLES);
export const canOpenKitchen = (role: RawRole | null | undefined) => hasRole(role, KITCHEN_ROLES);
export const canManageStaff = (role: RawRole | null | undefined) => hasRole(role, OWNER_ROLES);
export const canOpenBilling = (role: RawRole | null | undefined) => hasRole(role, OWNER_ROLES);
