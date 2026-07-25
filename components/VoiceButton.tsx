"use client";

import { useEffect, useRef, useState } from "react";

// Speech-to-text mic button (Web Speech API). Renders nothing on browsers
// that don't support it (Firefox / iOS Safari) — graceful fallback.
// Stays listening until the user taps stop (auto-restarts on silence).
export default function VoiceButton({ onText, className = "" }: { onText: (t: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const wantRef = useRef(false); // intended state: keep listening until user stops

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.lang = "ar-SA";
    r.continuous = true; // don't stop after the first sentence
    r.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let finalTxt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTxt += e.results[i][0].transcript;
      }
      if (finalTxt.trim()) onText(finalTxt.trim());
    };
    r.onend = () => {
      // Browsers auto-end on silence; restart if the user still wants to record.
      if (wantRef.current) {
        try { r.start(); } catch { /* ignore */ }
      } else {
        setListening(false);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e?.error === "no-speech" || e?.error === "aborted") return; // onend will restart
      wantRef.current = false;
      setListening(false);
    };
    recRef.current = r;
    return () => {
      wantRef.current = false;
      try { recRef.current?.abort(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  function toggle() {
    const r = recRef.current;
    if (!r) return;
    if (listening) {
      wantRef.current = false;
      try { r.stop(); } catch { /* ignore */ }
      setListening(false);
    } else {
      wantRef.current = true;
      try { r.start(); setListening(true); } catch { /* ignore */ }
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "إيقاف التسجيل" : "إدخال صوتي"}
      aria-label={listening ? "إيقاف التسجيل" : "إدخال صوتي"}
      className={`relative shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition ${listening ? "bg-red-500 text-white" : "border border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white hover:border-[var(--oji-primary)]"} ${className}`}
    >
      {listening && <span className="absolute inset-0 rounded-lg bg-red-500/40 animate-ping" />}
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
