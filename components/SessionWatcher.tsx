"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { INACTIVITY_MS } from "@/lib/supabase/config";

// Signs the user out after INACTIVITY_MS of no activity. Re-login then needs OTP.
export default function SessionWatcher() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const KEY = "oji:lastActive";
    const now = () => Date.now();

    async function checkInactive() {
      const { data } = await sb!.auth.getUser();
      if (!data.user) return;
      const last = Number(localStorage.getItem(KEY) || "0");
      if (last && now() - last > INACTIVITY_MS) {
        await sb!.auth.signOut();
        localStorage.removeItem(KEY);
        if (location.pathname.startsWith("/builder") || location.pathname.startsWith("/projects")) {
          location.href = "/login";
        }
      } else {
        localStorage.setItem(KEY, String(now()));
      }
    }

    checkInactive();

    let t: ReturnType<typeof setTimeout> | null = null;
    const touch = () => {
      if (t) return;
      t = setTimeout(() => {
        localStorage.setItem(KEY, String(now()));
        t = null;
      }, 30_000); // throttle writes
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const interval = setInterval(checkInactive, 5 * 60_000); // re-check every 5 min

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(interval);
      if (t) clearTimeout(t);
    };
  }, []);

  return null;
}
