import { useEffect, useState } from "react";
import { ApiError, api, isBackendConfigured, tokens } from "@/lib/api/client";
import { AUTH } from "@/lib/api/endpoints";
import { ROLE_HOME as ROLE_HOME_BY_ROLE, type AppRole } from "@/lib/roles";
import { rememberTenant, type TenantInfo } from "@/lib/tenant";

/**
 * Roles live in `src/lib/roles.ts` (slice 1.2). `AccountRole` stays exported
 * here for the screens that already import it, but it now covers all seven
 * backend roles plus the legacy `staff` spelling.
 */
export type AccountRole = AppRole | "staff";

export type AuthAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AccountRole;
  isSuperuser?: boolean;
  status?: "active" | "pending_approval" | "inactive";
  /** Staff created by an owner get a temp password they must replace. */
  mustChangePassword?: boolean;
  createdAt: string;
};

const KEY = "kmg.auth.v1";
export const AUTH_EVENT = "kmg-auth-change";

export { normalizeRole, roleHome, ROLE_LABEL } from "@/lib/roles";
export type { AppRole } from "@/lib/roles";

/** Kept as a plain map for existing callers; the source of truth is roles.ts. */
export const ROLE_HOME: Record<string, string> = { ...ROLE_HOME_BY_ROLE, staff: "/admin/orders" };

export const ROLE_COPY: Record<
  AccountRole,
  { label: string; tagline: string; destination: string }
> = {
  customer: {
    label: "Customer",
    tagline: "Order, track your rider live and keep your favourites",
    destination: "Customer profile",
  },
  rider: {
    label: "Delivery Rider",
    tagline: "Apply to join our fleet — deliver hot meals & earn per drop",
    destination: "Rider console",
  },
  staff: {
    label: "Kitchen Staff",
    tagline: "Kitchen console: tickets, cooking and packing",
    destination: "Kitchen screen",
  },
  kitchen: {
    label: "Kitchen Staff",
    tagline: "Kitchen console: tickets, cooking and packing",
    destination: "Kitchen screen",
  },
  cashier: {
    label: "Cashier",
    tagline: "Take orders, confirm payments and print receipts",
    destination: "Orders desk",
  },
  manager: {
    label: "Manager",
    tagline: "Run the branch: orders, menu, riders and stock",
    destination: "Manager console",
  },
  admin: {
    label: "Admin",
    tagline: "Full console: orders, payments, riders and revenue graphs",
    destination: "Admin console",
  },
  owner: {
    label: "Owner",
    tagline: "Everything, plus staff, branches and billing",
    destination: "Owner console",
  },
};

export function readAccount(): AuthAccount | null {
  if (typeof window === "undefined") return null;
  const token = tokens.access();
  if (!token) return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthAccount) : null;
  } catch {
    return null;
  }
}

export function publish(next: AuthAccount | null) {
  if (typeof window === "undefined") return;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else {
      localStorage.removeItem(KEY);
      tokens.clear();
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

type BackendLoginResponse = {
  access: string;
  refresh: string;
  /** Owner-created staff log in with a temp password and must replace it. */
  must_change_password?: boolean;
  user?: {
    id: number;
    username: string;
    email: string;
    phone?: string;
    role: AccountRole;
    full_name?: string;
    must_change_password?: boolean;
    tenant?: TenantInfo;
  };
};

type BackendSignupResponse = {
  detail: string;
  username: string;
  role?: string;
  status?: string;
};

export async function signIn(usernameOrEmail: string, pass: string): Promise<AuthAccount> {
  assertBackend();

  const res = await api.post<BackendLoginResponse>(AUTH.login, {
    username: usernameOrEmail.trim(),
    password: pass,
  });

  tokens.set(res.access, res.refresh);

  const u = res.user;
  // Login tells us which restaurant this user belongs to — every later request
  // is scoped to it (slice 1.1).
  if (u?.tenant) rememberTenant(u.tenant);

  const isSuperuser = Boolean((u as { is_superuser?: boolean } | undefined)?.is_superuser);

  // The role ALWAYS comes from the backend — never from a UI toggle.
  const account: AuthAccount = {
    id: u?.id ? String(u.id) : `user-${Date.now()}`,
    name: u?.full_name || u?.username || usernameOrEmail.split("@")[0] || "User",
    email: u?.email || (usernameOrEmail.includes("@") ? usernameOrEmail : ""),
    phone: u?.phone || (/^\d[\d\s+-]{6,}$/.test(usernameOrEmail.trim()) ? usernameOrEmail.trim() : ""),
    role: (u?.role || (isSuperuser ? "owner" : "customer")) as AccountRole,
    isSuperuser,
    status: "active",
    mustChangePassword: Boolean(res.must_change_password ?? u?.must_change_password),
    createdAt: new Date().toISOString(),
  };

  publish(account);

  if (typeof window !== "undefined") {
    console.log(
      `%c[AUTH LOGIN SUCCESS] Signed in as "${account.name}" (%c${account.role}%c)`,
      "color: #4ade80; font-weight: bold;",
      "color: #fbbf24; font-weight: bold; text-transform: uppercase;",
      "color: #4ade80; font-weight: bold;",
      { id: account.id, phone: account.phone, tenant: u?.tenant?.name ?? "default" }
    );
  }

  _verifiedRole = account.role;
  return account;
}

/* ===========================================================================
 * SLICE 2.1 — phone + code sign-in, with invisible registration.
 * A customer types a phone number, gets a 6-digit code, and is signed in.
 * A phone we've never seen becomes an account on the server — no password step.
 * ========================================================================= */

export type PhoneSignInResult = { account: AuthAccount; isNewCustomer: boolean };

type PhoneVerifyResponse = BackendLoginResponse & {
  is_new_customer?: boolean;
  /** UNCONFIRMED spelling — read both. */
  new_customer?: boolean;
};

/** Digits only, so "0300 123 4567" and "+92 300 123 4567" both work. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

export function phoneProblem(raw: string): string | null {
  const digits = normalizePhone(raw).replace(/\D/g, "");
  if (digits.length < 10) return "Enter your full mobile number.";
  if (digits.length > 15) return "That number looks too long.";
  return null;
}

export type PhoneOtpConfig = {
  whatsapp_connected: boolean;
  default_channel: "whatsapp" | "sms";
  channels: ("whatsapp" | "sms")[];
};

/**
 * GET /auth/phone-otp/ — queries whether WhatsApp gateway is currently connected.
 * If WhatsApp is offline, returns default_channel="sms" and channels=["sms"].
 */
export async function fetchPhoneOtpConfig(): Promise<PhoneOtpConfig> {
  if (!isBackendConfigured()) {
    return { whatsapp_connected: false, default_channel: "sms", channels: ["sms"] };
  }
  try {
    const res = await api.get<PhoneOtpConfig>(AUTH.phoneOtp);
    return res;
  } catch {
    return { whatsapp_connected: false, default_channel: "sms", channels: ["sms"] };
  }
}

/**
 * POST /auth/phone-otp/ — asks the server to send a login code.
 * Default is delivered over WhatsApp if connected, otherwise automatically falls back to SMS.
 */
export async function requestPhoneCode(
  phone: string,
  channel: "whatsapp" | "sms" = "whatsapp"
): Promise<{ channel?: string; message?: string; sent_via_whatsapp?: boolean; whatsapp_connected?: boolean }> {
  assertBackend();
  return await api.post<{ channel?: string; message?: string; sent_via_whatsapp?: boolean; whatsapp_connected?: boolean }>(
    AUTH.phoneOtp,
    { phone: normalizePhone(phone), channel }
  );
}

/** POST /auth/phone-verify/ — trades the WhatsApp/SMS code for a session. */
export async function verifyPhoneCode(phone: string, code: string, name?: string): Promise<PhoneSignInResult> {
  assertBackend();

  const cleanPhone = normalizePhone(phone);
  // SLICE 2.1b — send code, otp, and name for automatic customer profile
  const clean = code.trim();
  const body = { phone: cleanPhone, code: clean, otp: clean, name: name?.trim() || "" };

  let res: PhoneVerifyResponse;
  try {
    res = await api.post<PhoneVerifyResponse>(AUTH.phoneVerify, body);
  } catch (err) {
    const missing = err instanceof ApiError && (err.status === 404 || err.status === 405);
    if (!missing) throw err;
    res = await api.post<PhoneVerifyResponse>(AUTH.phoneVerifyAlt, body);
  }

  tokens.set(res.access, res.refresh);

  const u = res.user;
  if (u?.tenant) rememberTenant(u.tenant);

  const role = (u?.role || "customer") as AccountRole;
  _verifiedRole = role;

  const account: AuthAccount = {
    id: u?.id ? String(u.id) : `user-${Date.now()}`,
    name: u?.full_name || u?.username || "Customer",
    email: u?.email || "",
    phone: u?.phone || cleanPhone,
    role,
    status: "active",
    mustChangePassword: Boolean(res.must_change_password ?? u?.must_change_password),
    createdAt: new Date().toISOString(),
  };

  publish(account);

  if (typeof window !== "undefined") {
    console.log(
      `%c[AUTH OTP SUCCESS] Customer verified: "${account.name}" (%c${account.role}%c)`,
      "color: #4ade80; font-weight: bold;",
      "color: #fbbf24; font-weight: bold;",
      "color: #4ade80; font-weight: bold;",
      { phone: account.phone, isNewCustomer: Boolean(res.is_new_customer ?? res.new_customer) }
    );
  }

  return {
    account,
    isNewCustomer: Boolean(res.is_new_customer ?? res.new_customer),
  };
}

export async function signUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: AccountRole;
}): Promise<AuthAccount> {
  assertBackend();

  const rawName = input.name.trim();
  const cleanUsername = rawName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_@.+-]/g, "") || input.email.split("@")[0];

  const requestedRole = input.role === "staff" ? "kitchen" : input.role;

  const res = await api.post<BackendSignupResponse>(AUTH.register, {
    username: cleanUsername,
    email: input.email.trim().toLowerCase(),
    password: input.password,
    full_name: rawName,
    phone: input.phone.trim(),
    requested_role: requestedRole,
  });

  if (res && res.status === "pending_approval") {
    const pendingAccount: AuthAccount = {
      id: cleanUsername,
      name: rawName,
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      role: (res.role as AccountRole) || input.role,
      status: "pending_approval",
      createdAt: new Date().toISOString(),
    };
    return pendingAccount;
  }

  return signIn(cleanUsername, input.password);
}


/**
 * Sign out: blacklist the refresh token server-side (SimpleJWT) *before*
 * clearing local state, so a stolen token can't be replayed for 7 days.
 * Fire-and-forget — local state is cleared either way.
 */
export function signOut() {
  const refresh = tokens.refresh();
  if (isBackendConfigured() && refresh) {
    void api.post(AUTH.logout, { refresh }).catch(() => {
      /* endpoint missing or offline — local purge still happens */
    });
  }
  clearVerifiedRole();
  publish(null);
}

/**
 * Server-verified role, cached in memory for the tab session.
 * Route guards use this instead of trusting localStorage.
 */
let _verifiedRole: AccountRole | null = null;
let _verifyPromise: Promise<AccountRole | null> | null = null;

export function clearVerifiedRole() {
  _verifiedRole = null;
  _verifyPromise = null;
  _emailVerified = null;
}

/** Mirrors Django's validators: 8+ chars, at least one letter and one digit. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    return "Password needs at least one letter and one number.";
  return null;
}


type MeResponse = {
  role?: AccountRole;
  user?: { role?: AccountRole; must_change_password?: boolean; tenant?: TenantInfo };
  is_superuser?: boolean;
  is_staff?: boolean;
  is_email_verified?: boolean;
  must_change_password?: boolean;
  tenant?: TenantInfo;
};

/** Last profile flags seen from `/api/profile/` (server truth, never localStorage). */
let _emailVerified: boolean | null = null;
export const isEmailVerified = () => _emailVerified;

/**
 * SLICE 1.4 — forced password change.
 * Server truth for `must_change_password`; the guard blocks every other page
 * while this is true.
 */
let _mustChangePassword: boolean | null = null;
export const mustChangePassword = () => _mustChangePassword ?? readAccount()?.mustChangePassword ?? false;
export function clearMustChangePassword() {
  _mustChangePassword = false;
  const cached = readAccount();
  if (cached) publish({ ...cached, mustChangePassword: false });
}

export async function verifyRole(opts: { force?: boolean } = {}): Promise<AccountRole | null> {
  if (!isBackendConfigured() || !tokens.access()) return null;
  if (_verifiedRole && !opts.force) return _verifiedRole;
  if (_verifyPromise && !opts.force) return _verifyPromise;
  _verifyPromise = (async () => {
    try {
      const me = await api.get<MeResponse>(AUTH.me);
      if (typeof me.is_email_verified === "boolean") _emailVerified = me.is_email_verified;
      const flag = me.must_change_password ?? me.user?.must_change_password;
      if (typeof flag === "boolean") _mustChangePassword = flag;
      if (me.tenant ?? me.user?.tenant) rememberTenant(me.tenant ?? me.user?.tenant);
      const isSuperuser = Boolean(me.is_superuser);
      const role = (me.role ||
        me.user?.role ||
        (isSuperuser ? "owner" : me.is_staff ? "staff" : undefined)) as AccountRole | undefined;

      if (role) {
        _verifiedRole = role;
        const cached = readAccount();
        if (cached && (cached.role !== role || cached.isSuperuser !== isSuperuser)) {
          publish({ ...cached, role, isSuperuser });
        }
      }
      return role ?? null;
    } catch (err) {
      // Offline / cold start: don't invalidate anything, fall back to cache.
      if (err instanceof ApiError && err.isNetwork) return null;
      throw err;
    } finally {
      _verifyPromise = null;
    }
  })();
  return _verifyPromise;
}

function assertBackend() {
  if (!isBackendConfigured()) {
    throw new ApiError(
      0,
      "This app isn't connected to its server, so sign in is unavailable. Please contact support.",
    );
  }
}

export function useAccount() {
  const [account, setAccount] = useState<AuthAccount | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setAccount(readAccount());
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { account: account ?? null, isLoading: account === undefined };
}
