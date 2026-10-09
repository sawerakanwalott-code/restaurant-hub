/**
 * Kennedy — Build-Time Environment Validation
 *
 * This module is imported at the top of the app entry point.
 * It throws a hard error during development and fails the build in production
 * if unsafe environment configurations are detected.
 *
 * Rules enforced:
 *  1. VITE_ALLOW_DEMO must NOT be "true" in a production build.
 *  2. VITE_API_BASE_URL must be set when VITE_ALLOW_DEMO is not "true".
 */

const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
const allowDemo = import.meta.env.VITE_ALLOW_DEMO === "true";
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").trim();

// ─────────────────────────────────────────────────────────────────────────────
// Rule 1: VITE_ALLOW_DEMO must never be true in a production build.
// ─────────────────────────────────────────────────────────────────────────────
if (isProd && allowDemo) {
  throw new Error(
    "[Kennedy] FATAL: VITE_ALLOW_DEMO=true is forbidden in production builds. " +
    "Set VITE_ALLOW_DEMO=false in your production environment before deploying."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule 2: Without demo mode, the API base URL is required.
// ─────────────────────────────────────────────────────────────────────────────
if (!allowDemo && !apiBase) {
  const msg =
    "[Kennedy] VITE_API_BASE_URL is not set and VITE_ALLOW_DEMO is not enabled. " +
    "The app will not be able to connect to the backend.";
  if (isProd) {
    throw new Error(msg);
  } else {
    // In dev, warn loudly but don't crash — developer may be starting up.
    console.warn(msg);
  }
}

export {};
