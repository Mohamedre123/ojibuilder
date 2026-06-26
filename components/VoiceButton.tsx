"use client";

import { useEffect, useRef, useState } from "react";

// Speech-to-text mic button (Web Speech API). Renders nothing on browsers
// that don't support it (Firefox / iOS Safari) — graceful fallback.
export default function VoiceButton({ onText, className = "" }: { onText: (t: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.lang = "ar-SA";
    r.interimResults = false;
    r.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript;
      if (t) onText(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  function toggle() {
    const r = recRef.current;
    if (!r) return;
    if (listening) {
      try { r.stop(); } catch { /* ignore */ }
      setListening(false);
    } else {
      try { r.start(); setListening(true); } catch { /* ignore */ }
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="إدخال صوتي"
      aria-label="إدخال صوتي"
      className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition ${listening ? "bg-red-500/20 text-red-300 animate-pulse" : "border border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white hover:border-[var(--oji-primary)]"} ${className}`}
    >
      🎤
    </button>
  );
}
