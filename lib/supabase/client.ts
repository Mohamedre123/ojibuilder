"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPA_URL, SUPA_ANON } from "./config";

let cached: SupabaseClient | null = null;

// Browser Supabase client (singleton). Returns null when auth is not configured.
export function getSupabase(): SupabaseClient | null {
  if (!SUPA_URL || !SUPA_ANON) return null;
  if (!cached) cached = createBrowserClient(SUPA_URL, SUPA_ANON);
  return cached;
}
