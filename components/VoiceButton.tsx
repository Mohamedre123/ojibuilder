"use client";

import { useEffect, useRef, useState } from "react";

// Speech-to-text mic button (Web Speech API). Renders nothing on browsers
// that don't support it. Browsers end recognition on silence (and Chrome caps
// a session at ~60s), so we keep a "wanted" flag and restart until the user
// taps stop — with a delay (immediate restart throws InvalidStateError) plus a
// watchdog for restarts the browser swallows.
export default function VoiceButton({ onText, className = "" }: { onText: (t: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const wantRef = useRef(false); // user intent: keep recording
  const runRef = useRef(false); // engine actually running
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);

    const r = new SR();
    r.lang = "ar-SA";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      runRef.current = true;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let finalTxt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTxt += e.results[i][0].transcript;
      }
      if (finalTxt.trim()) onTextRef.current(finalTxt.trim());
    };
    r.onend = () => {
      runRef.current = false;
      if (wantRef.current) restart();
      else setListening(false);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      const err = e?.error;
      runRef.current = false;
      // Fatal: permission/hardware. Anything else (no-speech, network,
      // aborted) is transient — onend/watchdog will bring it back.
      if (err === "not-allowed" || err === "service-not-allowed") {
        wantRef.current = false;
        setListening(false);
        alert("لم يُسمح باستخدام الميكروفون. فعّل إذن الميكروفون من إعدادات المتصفح لهذا الموقع.");
      }
    };

    function restart() {
      if (!wantRef.current || runRef.current) return;
      setTimeout(() => {
        if (!wantRef.current || runRef.current) return;
        try {
          r.start();
        } catch {
          /* already starting — the watchdog retries */
        }
      }, 300);
    }

    recRef.current = r;
    // Watchdog: some browsers end the session without firing onend reliably.
    const watchdog = setInterval(() => {
      if (wantRef.current && !runRef.current) restart();
    }, 2000);

    return () => {
      wantRef.current = false;
      clearInterval(watchdog);
      try {
        r.onend = null;
        r.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const r = recRef.current;
    if (!r) return;
    if (wantRef.current) {
      wantRef.current = false;
      try { r.stop(); } catch { /* ignore */ }
      setListening(false);
    } else {
      wantRef.current = true;
      setListening(true);
      try { r.start(); } catch { /* watchdog will start it */ }
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
