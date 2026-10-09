/**
 * ============================================================================
 * KENNEDY MOON GRILL — HTTP CLIENT FOR THE DJANGO BACKEND
 * ============================================================================
 *
 * TOKEN REFRESH STRATEGY
 *   Access token lifetime  : 30 minutes (Django SIMPLE_JWT)
 *   Refresh token lifetime : 7 days
 *
 *   On any 401 (access token expired):
 *     1. Silently POST /auth/refresh/ with the stored refresh token.
 *     2. Save the new access token returned by Django.
 *     3. Retry the original request once with the fresh access token.
 *     4. If the refresh itself fails (refresh token expired/invalid):
 *        - Clear both tokens from localStorage.
 *        - Fire "kmg-auth-change" so useAccount() returns null and the
 *          router beforeLoad guard redirects to /login automatically.
 */

/**
 * Backend host root. Accepts the env var with or without a trailing `/api`
 * (and with or without a trailing slash) — the `/api` prefix is added per
 * request by `normalizePath()`, so both spellings resolve to the same URL and
 * never produce `/api/api/...`.
 */
import { currentTenantSlug } from "@/lib/tenant";

export const API_BASE_URL: string = (
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? ""
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const AUTH_MODE: "jwt" | "session" =
  (import.meta.env["VITE_API_AUTH_MODE"] as "jwt" | "session" | undefined) ?? "jwt";

/** True once the backend URL is configured. */
export const isBackendConfigured = () => API_BASE_URL.length > 0;

/**
 * Resolves the WebSocket URL for live real-time feeds (orders, kitchen, rider).
 * Supports ngrok tunnels, production domains, and local development.
 * Hierarchy:
 *   1. VITE_WS_BASE_URL (e.g. "wss://abc.ngrok-free.app" or "ws://127.0.0.1:8000")
 *   2. VITE_WS_HOST (e.g. "abc.ngrok-free.app" or "127.0.0.1:8000")
 *   3. Derived from VITE_API_BASE_URL (http -> ws, https -> wss)
 *   4. Current window.location host in browser
 */
export function getWsUrl(path: string, token?: string | null): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Explicit VITE_WS_BASE_URL
  const envWsBase = (import.meta.env["VITE_WS_BASE_URL"] as string | undefined)?.trim();
  if (envWsBase) {
    const base = envWsBase.replace(/\/+$/, "");
    const url = `${base}${cleanPath}`;
    return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
  }

  // 2. Explicit VITE_WS_HOST
  const envWsHost = (import.meta.env["VITE_WS_HOST"] as string | undefined)?.trim();
  if (envWsHost) {
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const proto = isHttps ? "wss:" : "ws:";
    const cleanHost = envWsHost.replace(/^wss?:\/\//, "").replace(/\/+$/, "");
    const url = `${proto}//${cleanHost}${cleanPath}`;
    return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
  }

  // 3. Derived from API_BASE_URL
  if (API_BASE_URL) {
    const proto = API_BASE_URL.startsWith("https") ? "wss:" : "ws:";
    const host = API_BASE_URL.replace(/^https?:\/\//, "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
    const url = `${proto}//${host}${cleanPath}`;
    return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
  }

  // 4. Browser location fallback
  if (typeof window !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    const proto = isHttps ? "wss:" : "ws:";
    const host = `${window.location.hostname}:8000`;
    const url = `${proto}//${host}${cleanPath}`;
    return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
  }

  return `ws://localhost:8000${cleanPath}`;
}

const ACCESS_KEY = "kmg.api.access";
const REFRESH_KEY = "kmg.api.refresh";

export const tokens = {
  access: () => (typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY)),
  refresh: () => (typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY)),
  set(access: string, refresh?: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

function csrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith("csrftoken="));
  return hit ? decodeURIComponent(hit.slice("csrftoken=".length)) : null;
}

export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  /** True when the request never reached the server (offline, DNS, CORS, cold-start timeout). */
  isNetwork: boolean;
  constructor(
    status: number,
    message: string,
    fields: Record<string, string[]> = {},
    isNetwork = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.isNetwork = isNetwork;
  }
}

/**
 * Friendly copy for DRF field errors so users never read
 * `username: this field is required`.
 */
const FIELD_LABELS: Record<string, string> = {
  username: "Username",
  password: "Password",
  email: "Email",
  phone: "Phone number",
  full_name: "Full name",
  requested_role: "Account type",
  non_field_errors: "",
  detail: "",
};

export function friendlyFieldMessage(fields: Record<string, string[]>): string {
  return Object.entries(fields)
    .map(([key, values]) => {
      const label = FIELD_LABELS[key] ?? key.replace(/_/g, " ");
      const raw = values.join(" ");
      const text = /this field (is required|may not be blank)/i.test(raw)
        ? `is required`
        : /already exists/i.test(raw)
          ? `is already taken`
          : raw.replace(/^This field /i, "");
      return label ? `${label} ${text}`.replace(/\s+/g, " ").trim() : text;
    })
    .join(" ");
}

/** Cold-start hint: Railway free tier sleeps, so the first call can take 10-30s. */
export const API_SLOW_EVENT = "kmg-api-slow";
export const API_SLOW_DONE_EVENT = "kmg-api-slow-done";
/** Server reachability: fired when a request fails at transport level / succeeds again. */
export const API_OFFLINE_EVENT = "kmg-api-offline";
export const API_ONLINE_EVENT = "kmg-api-online";
const SLOW_AFTER_MS = 3500;

function signalReachability(reachable: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(reachable ? API_ONLINE_EVENT : API_OFFLINE_EVENT));
}


type Options = { query?: Record<string, string | number | boolean | undefined>; signal?: AbortSignal };


// ─── Silent refresh helpers ───────────────────────────────────────────────────

let _refreshPromise: Promise<string> | null = null;

/**
 * Canonicalise every request path to the Django URL conf.
 *
 * Django mounts the whole DRF surface under `/api/` (`/api/auth/login/`,
 * `/api/orders/`, `/api/admin/riders/`, ...) and DRF requires the trailing
 * slash. Frontend modules may spell paths either way (`/orders/` or
 * `/api/orders/`); this makes both hit the same URL:
 *   - ensure a leading slash
 *   - add the `/api` prefix exactly once (never `/api/api/...`)
 *   - keep the Django admin panel (`/admin/` HTML) out of the API prefix only
 *     when explicitly spelled `/django-admin/`
 *   - ensure the DRF trailing slash before any query string
 */
export function normalizePath(p: string): string {
  let np = p.startsWith("/") ? p : `/${p}`;

  // Escape hatch for non-API Django routes (admin panel, static, etc.)
  if (np.startsWith("/django-admin/")) return np.replace("/django-admin", "/admin");

  if (!/^\/api(\/|$)/.test(np)) np = `/api${np}`;

  // DRF: append the trailing slash (before ?query) to avoid APPEND_SLASH redirects
  const [pathname, query] = np.split("?");
  const withSlash = pathname!.endsWith("/") ? pathname! : `${pathname}/`;
  return query ? `${withSlash}?${query}` : withSlash;
}


/**
 * SLICE 1.6 — the ONLY way to build a full backend URL outside `request()`.
 * Callers that hand-built `${API_BASE_URL}/api/...` produced `/api/api/...`
 * whenever the base URL already ended in `/api`.
 */
export const apiUrl = (path: string) => `${API_BASE_URL}${normalizePath(path)}`;

async function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const refresh = tokens.refresh();
    if (!refresh) throw new ApiError(401, "no_refresh_token");
    const refreshPath = normalizePath("/auth/refresh/");
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${refreshPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Tenant-Slug": currentTenantSlug(),
        },
        body: JSON.stringify({ refresh }),
      });
    } catch {
      // Server unreachable (offline / cold start) — NOT an invalid session.
      throw new ApiError(0, OFFLINE_MESSAGE, {}, true);
    }
    if (!res.ok) {
      // 5xx = backend hiccup, keep the session. 4xx = refresh token is dead.
      if (res.status >= 500) throw new ApiError(res.status, OFFLINE_MESSAGE, {}, true);
      throw new ApiError(res.status, "refresh_failed");
    }
    const data = (await res.json()) as { access: string; refresh?: string };
    tokens.set(data.access, data.refresh);
    return data.access;
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

export const OFFLINE_MESSAGE =
  "We can't reach the kitchen server right now. Check your connection and try again — your session is still active.";

function forceSignOut() {
  tokens.clear();
  if (typeof localStorage !== "undefined") localStorage.removeItem("kmg.auth.v1");
  if (typeof window !== "undefined") window.dispatchEvent(new Event("kmg-auth-change"));
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: Options = {},
  _isRetry = false,
): Promise<T> {
  if (!isBackendConfigured()) {
    // Fail loudly: a missing API base URL in production must never silently
    // degrade into fake local accounts.
    throw new ApiError(
      0,
      "This app is not connected to its server (VITE_API_BASE_URL is missing). Please contact support.",
    );
  }

  // Normalize path early so all logic below uses the canonical path and so
  // callers can pass either /auth/... or /api/auth/... without 404s.
  path = normalizePath(path);

  const url = new URL(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
  Object.entries(options.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });

  // SLICE 1.1 — every request is scoped to the active restaurant. Resolved from
  // the tenant context, never hardcoded in a caller.
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Tenant-Slug": currentTenantSlug(),
    "ngrok-skip-browser-warning": "1",
  };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (AUTH_MODE === "jwt") {
    const access = tokens.access();
    if (access) headers["Authorization"] = `Bearer ${access}`;
  } else {
    const csrf = csrfToken();
    if (csrf) headers["X-CSRFToken"] = csrf;
  }

  // Cold-start UX: tell the UI when a request is taking suspiciously long so it
  // can show a "waking up the kitchen" state instead of looking frozen.
  const slowTimer =
    typeof window === "undefined"
      ? null
      : setTimeout(() => window.dispatchEvent(new Event(API_SLOW_EVENT)), SLOW_AFTER_MS);
  const clearSlow = () => {
    if (slowTimer) clearTimeout(slowTimer);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(API_SLOW_DONE_EVENT));
  };

  // Structured Developer Console Log
  if (typeof window !== "undefined") {
    console.log(
      `%c[API OUT] ${method} ${url.pathname}${url.search}`,
      "color: #38bdf8; font-weight: bold; background: #0c4a6e; padding: 2px 6px; border-radius: 4px;",
      { tenant: headers["X-Tenant-Slug"], auth: !!headers["Authorization"], body: isForm ? "[FormData]" : body }
    );
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      credentials: AUTH_MODE === "session" ? "include" : "same-origin",
      ...(body === undefined ? {} : { body: isForm ? (body as FormData) : JSON.stringify(body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (err) {
    clearSlow();
    if (typeof window !== "undefined") {
      console.warn(`%c[API NET FAIL] ${method} ${url.pathname}`, "color: #f87171; font-weight: bold;", err);
    }
    if ((err as Error)?.name === "AbortError") throw err;
    // Never sign the user out for a transport failure.
    signalReachability(false);
    throw new ApiError(0, OFFLINE_MESSAGE, {}, true);
  }
  clearSlow();
  signalReachability(true);


  // ── Silent token refresh on 401 ─────────────────────────────────────────
  // Don't attempt a silent refresh for authentication endpoints themselves
  // (both /auth/... and /api/auth/...). Match either form.
  if (res.status === 401 && AUTH_MODE === "jwt" && !_isRetry && !/^\/(api\/)?auth(\/|$)/.test(path)) {
    if (typeof window !== "undefined") {
      console.log(
        "%c[AUTH REFRESH] 401 received — silently refreshing JWT with stored refresh token...",
        "color: #fbbf24; font-weight: bold; background: #451a03; padding: 2px 6px; border-radius: 4px;"
      );
    }
    if (tokens.refresh()) {
      try {
        await refreshAccessToken();
        if (typeof window !== "undefined") {
          console.log("%c[AUTH REFRESH] Token refresh successful. Retrying original request...", "color: #4ade80; font-weight: bold;");
        }
        return request<T>(method, path, body, options, true);
      } catch (err) {
        // Backend unreachable / 5xx during refresh: keep the session, surface a
        // retryable error instead of a silent sign-out.
        if (err instanceof ApiError && err.isNetwork) throw err;
        forceSignOut();
        throw new ApiError(401, "Session expired. Please sign in again.");
      }
    }
    forceSignOut();
    throw new ApiError(401, "Session expired. Please sign in again.");
  }

  if (res.status === 204) {
    if (typeof window !== "undefined") {
      console.log(`%c[API IN 204] ${method} ${url.pathname}`, "color: #4ade80; font-weight: bold;");
    }
    return undefined as T;
  }

  const payload: unknown = await res.json().catch(() => null);

  if (typeof window !== "undefined") {
    console.log(
      `%c[API IN ${res.status}] ${method} ${url.pathname}`,
      `color: ${res.ok ? "#4ade80" : "#f87171"}; font-weight: bold; background: ${res.ok ? "#064e3b" : "#450a0a"}; padding: 2px 6px; border-radius: 4px;`,
      payload
    );
  }

  if (!res.ok) {
    const record = (payload ?? {}) as Record<string, unknown>;
    const detail = typeof record["detail"] === "string" ? (record["detail"] as string) : null;
    const fields: Record<string, string[]> = {};
    Object.entries(record).forEach(([key, value]) => {
      if (key !== "detail") {
        if (Array.isArray(value)) fields[key] = value.map(String);
        else if (typeof value === "string") fields[key] = [value];
      }
    });
    const fieldMsg = friendlyFieldMessage(fields);
    const fallback =
      res.status === 400
        ? "Please check the details you entered and try again."
        : res.status === 403
          ? "You don't have permission to do that."
          : res.status === 404
            ? "We couldn't find what you were looking for."
            : res.status === 429
              ? "Too many attempts. Please wait a minute and try again."
              : res.status >= 500
                ? "The kitchen server had a hiccup. Please try again in a moment."
                : `Request failed (${res.status})`;
    throw new ApiError(
      res.status,
      detail || (fieldMsg.length > 0 ? fieldMsg : fallback),
      fields,
      res.status >= 500,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Options) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: Options) => request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: Options) => request<T>("PATCH", path, body, options),
  put: <T>(path: string, body?: unknown, options?: Options) => request<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: Options) => request<T>("DELETE", path, undefined, options),
};
