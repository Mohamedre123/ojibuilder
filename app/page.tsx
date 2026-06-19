"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/prompts";
import { MODELS, DEFAULT_MODEL } from "@/lib/models";
import { useUser } from "@/lib/supabase/useUser";
import { getSupabase } from "@/lib/supabase/client";
import Footer from "@/components/Footer";

type Entry = "text" | "image" | "url";

export default function Home() {
  const router = useRouter();
  const { user, authEnabled } = useUser();
  const [prompt, setPrompt] = useState("");
  const [entry, setEntry] = useState<Entry>("text");
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [cat, setCat] = useState("الكل");
  const [busy, setBusy] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickModel(id: string) {
    setModel(id);
    sessionStorage.setItem("oji:model", id);
  }

  async function logout() {
    setMenuOpen(false);
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    router.refresh();
  }

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
      <header className="relative flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--oji-primary)] to-[var(--oji-accent)] flex items-center justify-center font-extrabold text-[#06121f]">O</div>
          <span className="text-xl font-extrabold">oji <span className="oji-gradient-text">builder</span></span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-6 text-sm text-[var(--oji-muted)]">
          <a href="#templates" className="hover:text-white transition">القوالب</a>
          <a href="#how" className="hover:text-white transition">كيف يعمل</a>
          <button onClick={() => router.push("/oji-brain")} className="font-bold text-transparent bg-clip-text bg-gradient-to-l from-[#d946ef] to-[#22d3ee] hover:opacity-80 transition">🚀 كبّر مشروعك بالـ AI</button>
          <button onClick={() => router.push("/contact")} className="hover:text-white transition">تواصل</button>
          {authEnabled && user && (
            <>
              <button onClick={() => router.push("/projects")} className="px-4 py-1.5 rounded-lg bg-[var(--oji-surface-2)] border border-[var(--oji-border)] text-white hover:border-[var(--oji-primary)] transition">مشاريعي</button>
              <button onClick={logout} title={user.email || ""} className="px-4 py-1.5 rounded-lg border border-[var(--oji-border)] hover:border-red-500 hover:text-red-300 transition">خروج</button>
            </>
          )}
          {authEnabled && !user && (
            <button onClick={() => router.push("/login")} className="px-4 py-1.5 rounded-lg bg-[var(--oji-surface-2)] border border-[var(--oji-border)] text-white hover:border-[var(--oji-primary)] transition">دخول</button>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(true)} aria-label="القائمة" className="sm:hidden w-10 h-10 rounded-lg border border-[var(--oji-border)] flex items-center justify-center text-xl">
          ☰
        </button>
      </header>

      {/* Mobile side drawer (right) */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-[60]">
          <div onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/70" />
          <div className="oji-drawer absolute top-0 right-0 bottom-0 w-72 max-w-[82vw] bg-[var(--oji-surface)] border-l border-[var(--oji-border)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--oji-border)]">
              <span className="font-extrabold">oji <span className="oji-gradient-text">builder</span></span>
              <button onClick={() => setMenuOpen(false)} aria-label="إغلاق" className="w-9 h-9 rounded-lg border border-[var(--oji-border)] flex items-center justify-center text-lg">✕</button>
            </div>
            <nav className="flex flex-col p-3 gap-1 text-[15px]">
              <a href="#templates" onClick={() => setMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-[var(--oji-surface-2)] transition">القوالب</a>
              <a href="#how" onClick={() => setMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-[var(--oji-surface-2)] transition">كيف يعمل</a>
              <button onClick={() => { setMenuOpen(false); router.push("/oji-brain"); }} className="text-right px-4 py-3 rounded-xl font-bold text-transparent bg-clip-text bg-gradient-to-l from-[#d946ef] to-[#22d3ee] hover:bg-[var(--oji-surface-2)] transition">🚀 كبّر مشروعك بالـ AI</button>
              <button onClick={() => { setMenuOpen(false); router.push("/contact"); }} className="text-right px-4 py-3 rounded-xl hover:bg-[var(--oji-surface-2)] transition">تواصل معنا</button>
              {authEnabled && user && (
                <>
                  <button onClick={() => { setMenuOpen(false); router.push("/projects"); }} className="mt-2 px-4 py-3 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f]">مشاريعي</button>
                  <button onClick={logout} className="px-4 py-3 rounded-xl text-right border border-[var(--oji-border)] hover:border-red-500 hover:text-red-300 transition">تسجيل الخروج</button>
                </>
              )}
              {authEnabled && !user && (
                <button onClick={() => { setMenuOpen(false); router.push("/login"); }} className="mt-2 px-4 py-3 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f]">تسجيل الدخول</button>
              )}
            </nav>
          </div>
        </div>
      )}

      <section className="max-w-3xl mx-auto px-6 pt-14 pb-12 text-center">
        <div className="oji-up inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full oji-glass text-[var(--oji-muted)] mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--oji-primary)] animate-pulse" />
          مدعوم بأحدث نماذج الذكاء الاصطناعي من Claude
        </div>
        <h1 className="oji-up text-4xl sm:text-6xl font-extrabold leading-tight mb-5">
          اكتب فكرتك، واحصل على <span className="oji-gradient-text">موقع كامل</span>
        </h1>
        <p className="oji-up-2 text-base sm:text-lg text-[var(--oji-muted)] mb-7 max-w-xl mx-auto">
          من نص، أو صورة تصميم، أو رابط موقع قائم — ودع oji builder يبنيه ويتيح لك تعديل كل جزء.
        </p>

        {/* Entry mode tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
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

        {/* Model picker with cost hint */}
        <div className="oji-up-2 flex flex-wrap items-center justify-center gap-2 mb-4">
          {MODELS.map((mo) => (
            <button
              key={mo.id}
              onClick={() => pickModel(mo.id)}
              title={`$${mo.inPrice}/$${mo.outPrice} لكل مليون توكن`}
              className={`px-3 py-1.5 rounded-xl text-xs transition border ${model === mo.id ? "border-[var(--oji-primary)] bg-[var(--oji-primary)]/15 text-white font-bold" : "border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white hover:border-[var(--oji-primary)]"}`}
            >
              {mo.badge} {mo.label} · {mo.speed}
            </button>
          ))}
        </div>

        <div className="oji-up-3 oji-glow oji-glass rounded-2xl p-3 text-right">
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
            <button key={t.id} onClick={() => go({ prompt: t.prompt, lang })} className="group text-right rounded-2xl oji-glass p-5 hover:border-[var(--oji-primary)] hover:-translate-y-1 transition">
              <div className="text-3xl mb-3">{t.emoji}</div>
              <div className="font-bold mb-1">{t.title}</div>
              <div className="text-xs text-[var(--oji-muted)]">{t.category}</div>
            </button>
          ))}
        </div>
      </section>

      {/* oji brain promo section */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <a
          href="https://oji-brain.site/"
          target="_blank"
          rel="noopener noreferrer"
          className="group block relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-l from-[#7c3aed] via-[#d946ef] to-[#22d3ee] oji-glow"
        >
          <div className="relative rounded-3xl bg-[var(--oji-surface)] px-6 sm:px-10 py-8 sm:py-10 overflow-hidden">
            <div className="absolute -top-16 -start-16 w-56 h-56 rounded-full bg-[#d946ef]/20 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 min-w-0 text-center md:text-right">
                <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full oji-glass text-[var(--oji-muted)] mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#d946ef] animate-pulse" /> منتجنا الجديد
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
                  جرّب <span className="oji-gradient-text">oji brain</span> — دراعك اليمين بالذكاء الاصطناعي
                </h2>
                <p className="text-[var(--oji-muted)] mb-5 max-w-2xl">
                  منصة متكاملة تجمع كل أدوات الذكاء الاصطناعي في مكان واحد لتكبير مشروعك.
                </p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                  {["✍️ توليد البرومبت", "🖼️ الصور", "🎬 الفيديو", "📈 الاستراتيجيات", "🤖 وكلاء AI في كل جزء"].map((f) => (
                    <span key={f} className="text-xs px-3 py-1.5 rounded-full oji-glass">{f}</span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-gradient-to-l from-[#7c3aed] to-[#d946ef] text-white group-hover:scale-105 transition shadow-lg">
                  اكتشف oji brain <span aria-hidden>↗</span>
                </span>
              </div>
              <div className="shrink-0 mx-auto md:mx-0">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-[#7c3aed] to-[#22d3ee] flex items-center justify-center text-6xl sm:text-7xl oji-float shadow-2xl">
                  🧠
                </div>
              </div>
            </div>
          </div>
        </a>
      </section>

      <section id="how" className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          {[
            { n: "١", t: "صِف فكرتك", d: "نص، صورة، أو رابط موقع." },
            { n: "٢", t: "يتولّد الموقع", d: "موقع كامل بصفحاته في دقائق." },
            { n: "٣", t: "عدّل وانشر", d: "بالنقر أو بالأمر، ثم انشر أو نزّل." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl oji-glass p-6">
              <div className="w-10 h-10 rounded-full bg-[var(--oji-surface-2)] border border-[var(--oji-border)] flex items-center justify-center font-bold mx-auto mb-3 text-[var(--oji-primary)]">{s.n}</div>
              <div className="font-bold mb-2">{s.t}</div>
              <div className="text-sm text-[var(--oji-muted)]">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
