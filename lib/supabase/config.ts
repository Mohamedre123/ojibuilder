// Supabase config. Auth is OPTIONAL: if these env vars are missing, the app
// runs exactly as before (guest-only, local/Blob storage). When set, accounts
// + per-user project storage activate.
export const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const authEnabled = Boolean(SUPA_URL && SUPA_ANON);

// Auto sign-out after this much inactivity (ms). Re-login then requires OTP.
export const INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24h
