"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/prompts";

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  function launch(text: string) {
    const value = text.trim();
    if (!value) return;
    sessionStorage.setItem("oji:prompt", value);
    sessionStorage.removeItem("oji:html");
    router.push("/builder");
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--oji-primary)] to-[var(--oji-accent)] flex items-center justify-center font-extrabold text-[#06121f]">
            O
          </div>
          <span className="text-xl font-extrabold">oji <span className="oji-gradient-text">builder</span></span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-[var(--oji-muted)]">
          <a href="#templates" className="hover:text-white transition">القوالب</a>
          <a href="#how" className="hover:text-white transition">كيف يعمل</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-[var(--oji-border)] text-[var(--oji-muted)] mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--oji-primary)] animate-pulse" />
          مدعوم بأحدث نماذج الذكاء الاصطناعي
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight mb-5">
          اكتب فكرتك،
          <br />
          واحصل على <span className="oji-gradient-text">موقع كامل</span>
        </h1>
        <p className="text-lg text-[var(--oji-muted)] mb-9 max-w-xl mx-auto">
          صف ما تريد بالعربي، ودع oji builder يبني لك موقعًا احترافيًا في ثوانٍ — ثم عدّل أي جزء بالأمر أو يدويًا.
        </p>

        {/* Prompt box */}
        <div className="oji-glow rounded-2xl bg-[var(--oji-surface)] p-3 text-right">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) launch(prompt);
            }}
            placeholder="مثال: موقع لمطعم إيطالي يعرض المنيو والأسعار ونموذج حجز طاولة..."
            className="w-full h-28 bg-transparent resize-none outline-none px-3 py-2 text-base placeholder:text-[var(--oji-muted)]"
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-[var(--oji-muted)]">Ctrl + Enter للإرسال</span>
            <button
              onClick={() => launch(prompt)}
              disabled={!prompt.trim()}
              className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
            >
              ابنِ الموقع ✨
            </button>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold mb-1 text-center">ابدأ من قالب جاهز</h2>
        <p className="text-[var(--oji-muted)] text-center mb-8">اضغط على أي قالب لتوليده فورًا، ثم خصّصه كما تشاء.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => launch(t.prompt)}
              className="group text-right rounded-2xl bg-[var(--oji-surface)] border border-[var(--oji-border)] p-5 hover:border-[var(--oji-primary)] hover:-translate-y-1 transition"
            >
              <div className="text-3xl mb-3">{t.emoji}</div>
              <div className="font-bold mb-1">{t.title}</div>
              <div className="text-xs text-[var(--oji-muted)]">{t.category}</div>
            </button>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          {[
            { n: "١", t: "صِف فكرتك", d: "اكتب ما تريد بالعربي بكل بساطة." },
            { n: "٢", t: "يتولّد الموقع", d: "يبني الذكاء الاصطناعي موقعًا كاملًا في ثوانٍ." },
            { n: "٣", t: "عدّل كل جزء", d: "بالأمر أو بتحرير الكود مباشرة، ثم نزّله." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl bg-[var(--oji-surface)] border border-[var(--oji-border)] p-6">
              <div className="w-10 h-10 rounded-full bg-[var(--oji-surface-2)] border border-[var(--oji-border)] flex items-center justify-center font-bold mx-auto mb-3 text-[var(--oji-primary)]">
                {s.n}
              </div>
              <div className="font-bold mb-2">{s.t}</div>
              <div className="text-sm text-[var(--oji-muted)]">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-sm text-[var(--oji-muted)] py-10 border-t border-[var(--oji-border)] mt-12">
        صُنع بـ oji builder
      </footer>
    </main>
  );
}
