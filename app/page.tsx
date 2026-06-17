"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/prompts";

type Entry = "text" | "image" | "url";

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [entry, setEntry] = useState<Entry>("text");
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [cat, setCat] = useState("الكل");
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => ["الكل", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))],
    []
  );
  const shown = cat === "الكل" ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat);

  function go(seed: { prompt: string; image?: { data: string; mediaType: string }; lang: "ar" | "en" }) {
    sessionStorage.setItem("oji:prompt", seed.prompt);
    sessionStorage.setItem("oji:lang", seed.lang);
    if (seed.image) sessionStorage.setItem("oji:image", JSON.stringify(seed.image));
    else sessionStorage.removeItem("oji:image");
    sessionStorage.removeItem("oji:html");
    router.push("/builder");
  }

  function launchText() {
    if (!prompt.trim()) return;
    go({ prompt: prompt.trim(), lang });
  }

  async function launchUrl() {
    if (!url.trim()) return;
    setBusy("جارٍ قراءة الرابط...");
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر قراءة الرابط");
      go({
        prompt: `أعد بناء موقع احترافي مستوحى من هذا الموقع القائم وحسّنه:\n\n${data.summary}`,
        lang,
      });
    } catch (e) {
      setBusy("");
      alert(e instanceof Error ? e.message : "تعذّر قراءة الرابط");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("الصورة كبيرة جدًا (الحد 5 ميجابايت)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const data = result.split(",")[1];
      go({
        prompt: prompt.trim() || "ابنِ موقعًا مستوحى من هذا التصميم",
        image: { data, mediaType: file.type || "image/png" },
        lang,
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--oji-primary)] to-[var(--oji-accent)] flex items-center justify-center font-extrabold text-[#06121f]">O</div>
          <span className="text-xl font-extrabold">oji <span className="oji-gradient-text">builder</span></span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-[var(--oji-muted)]">
          <a href="#templates" className="hover:text-white transition">القوالب</a>
          <a href="#how" className="hover:text-white transition">كيف يعمل</a>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-14 pb-12 text-center">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-[var(--oji-border)] text-[var(--oji-muted)] mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--oji-primary)] animate-pulse" />
          مدعوم بأحدث نماذج الذكاء الاصطناعي
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight mb-5">
          اكتب فكرتك، واحصل على <span className="oji-gradient-text">موقع كامل</span>
        </h1>
        <p className="text-lg text-[var(--oji-muted)] mb-7 max-w-xl mx-auto">
          من نص، أو صورة تصميم، أو رابط موقع قائم — ودع oji builder يبنيه ويتيح لك تعديل كل جزء.
        </p>

        {/* Entry mode tabs */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {([["text", "✍️ من نص"], ["image", "🖼️ من صورة"], ["url", "🔗 من رابط"]] as [Entry, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setEntry(k)} className={`px-4 py-1.5 rounded-lg text-sm transition ${entry === k ? "bg-[var(--oji-surface-2)] font-bold border border-[var(--oji-border)]" : "text-[var(--oji-muted)] hover:text-white"}`}>
              {label}
            </button>
          ))}
          <div className="flex rounded-lg border border-[var(--oji-border)] overflow-hidden text-xs ms-2">
            <button onClick={() => setLang("ar")} className={`px-2.5 py-1.5 ${lang === "ar" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>عربي</button>
            <button onClick={() => setLang("en")} className={`px-2.5 py-1.5 ${lang === "en" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>EN</button>
          </div>
        </div>

        <div className="oji-glow rounded-2xl bg-[var(--oji-surface)] p-3 text-right">
          {entry === "url" ? (
            <div className="flex flex-col gap-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://example.com" className="w-full bg-transparent outline-none px-3 py-3 text-base placeholder:text-[var(--oji-muted)]" onKeyDown={(e) => e.key === "Enter" && launchUrl()} />
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-xs text-[var(--oji-muted)]">{busy || "سنقرأ الموقع ونعيد بناءه بشكل قابل للتعديل"}</span>
                <button onClick={launchUrl} disabled={!url.trim() || !!busy} className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] disabled:opacity-40 transition">ابنِ من الرابط 🔗</button>
              </div>
            </div>
          ) : (
            <>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) launchText(); }} placeholder={entry === "image" ? "ملاحظات اختيارية عن التصميم المرفوع..." : "مثال: موقع لمطعم إيطالي يعرض المنيو والأسعار ونموذج حجز طاولة..."} className="w-full h-24 bg-transparent resize-none outline-none px-3 py-2 text-base placeholder:text-[var(--oji-muted)]" />
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-xs text-[var(--oji-muted)]">{entry === "image" ? "ارفع صورة تصميم أو سكرين‑شوت" : "Ctrl + Enter للإرسال"}</span>
                {entry === "image" ? (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                    <button onClick={() => fileRef.current?.click()} className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-accent)] to-[#7c5cff] text-[#06121f] hover:brightness-110 transition">ارفع صورة وابنِ 🖼️</button>
                  </>
                ) : (
                  <button onClick={launchText} disabled={!prompt.trim()} className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] disabled:opacity-40 transition">ابنِ الموقع ✨</button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <section id="templates" className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold mb-1 text-center">ابدأ من قالب جاهز</h2>
        <p className="text-[var(--oji-muted)] text-center mb-6">اضغط على أي قالب لتوليده فورًا، ثم خصّصه كما تشاء.</p>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-xs transition ${cat === c ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "border border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white"}`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {shown.map((t) => (
            <button key={t.id} onClick={() => go({ prompt: t.prompt, lang })} className="group text-right rounded-2xl bg-[var(--oji-surface)] border border-[var(--oji-border)] p-5 hover:border-[var(--oji-primary)] hover:-translate-y-1 transition">
              <div className="text-3xl mb-3">{t.emoji}</div>
              <div className="font-bold mb-1">{t.title}</div>
              <div className="text-xs text-[var(--oji-muted)]">{t.category}</div>
            </button>
          ))}
        </div>
      </section>

      <section id="how" className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          {[
            { n: "١", t: "صِف فكرتك", d: "نص، صورة، أو رابط موقع." },
            { n: "٢", t: "يتولّد الموقع", d: "موقع كامل بصفحاته في دقائق." },
            { n: "٣", t: "عدّل وانشر", d: "بالنقر أو بالأمر، ثم انشر أو نزّل." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl bg-[var(--oji-surface)] border border-[var(--oji-border)] p-6">
              <div className="w-10 h-10 rounded-full bg-[var(--oji-surface-2)] border border-[var(--oji-border)] flex items-center justify-center font-bold mx-auto mb-3 text-[var(--oji-primary)]">{s.n}</div>
              <div className="font-bold mb-2">{s.t}</div>
              <div className="text-sm text-[var(--oji-muted)]">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-sm text-[var(--oji-muted)] py-10 border-t border-[var(--oji-border)] mt-12">صُنع بـ oji builder</footer>
    </main>
  );
}
