"use client";

import { useState } from "react";

// Dismissible promo banner for oji brain (the user's other product).
// Dismissal is per-view (in-memory) — it reappears on every refresh / reopen.
export default function PromoBanner() {
  const [show, setShow] = useState(true);
  if (!show) return null;

  function close(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShow(false);
  }

  return (
    <a
      href="https://oji-brain.site/"
      target="_blank"
      rel="noopener noreferrer"
      className="oji-promo group relative z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 text-white overflow-hidden"
    >
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] sm:text-xs font-extrabold tracking-wide">
        ✨ جديد
      </span>

      <div className="flex-1 min-w-0 text-center sm:text-right">
        <span className="font-extrabold text-sm sm:text-base">oji brain</span>
        <span className="hidden sm:inline text-sm text-white/90">
          {" "}— دراعك اليمين بالذكاء الاصطناعي: برومبت، صور، فيديو، استراتيجيات، ووكلاء AI لتكبير مشروعك في مكان واحد
        </span>
        <span className="sm:hidden text-xs text-white/90"> — كل أدوات الذكاء الاصطناعي في مكان واحد</span>
      </div>

      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white text-[#3b0764] font-extrabold text-xs sm:text-sm px-3 sm:px-4 py-1.5 group-hover:scale-105 transition shadow-lg">
        جرّب الآن
        <span aria-hidden>↗</span>
      </span>

      <button
        onClick={close}
        aria-label="إغلاق الإعلان"
        className="shrink-0 w-7 h-7 -me-1 rounded-full hover:bg-white/20 flex items-center justify-center text-white/90 text-lg leading-none transition"
      >
        ×
      </button>
    </a>
  );
}
