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
    // If accounts are enabled and the visitor is a guest, sign in first then
    // return to the builder (the saved seed generates after login).
    if (authEnabled && !user) {
      router.push("/login?returnTo=/builder");
      return;
    }
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

      <section className="max-w-6xl mx-auto px-6 pt-8 sm:pt-12 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Text + command bar */}
          <div className="text-center lg:text-right">
            <div className="oji-up inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full oji-glass text-[var(--oji-muted)] mb-5">
              <span className="w-2 h-2 rounded-full bg-[var(--oji-primary)] animate-pulse" /> مدعوم بأحدث نماذج Claude
            </div>
            <h1 className="oji-up text-4xl sm:text-6xl font-extrabold leading-[1.12] mb-4">
              من فكرة إلى <span className="oji-gradient-text">موقع كامل</span> في دقائق
            </h1>
            <p className="oji-up-2 text-base sm:text-lg text-[var(--oji-muted)] mb-6 max-w-xl mx-auto lg:mx-0">
              اكتب وصفًا، أو ارفع صورة، أو ضع رابطًا — و oji builder يبني موقعك بكل صفحاته، ويتيح لك تعديل كل جزء، ثم انشره على دومينك.
            </p>

            {/* entry tabs + lang */}
            <div className="oji-up-2 flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-3">
              {([["text", "✍️ من نص"], ["image", "🖼️ من صورة"], ["url", "🔗 من رابط"]] as [Entry, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setEntry(k)} className={`px-4 py-1.5 rounded-lg text-sm transition ${entry === k ? "bg-[var(--oji-surface-2)] font-bold border border-[var(--oji-border)]" : "text-[var(--oji-muted)] hover:text-white"}`}>{label}</button>
              ))}
              <div className="flex rounded-lg border border-[var(--oji-border)] overflow-hidden text-xs ms-1">
                <button onClick={() => setLang("ar")} className={`px-2.5 py-1.5 ${lang === "ar" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>عربي</button>
                <button onClick={() => setLang("en")} className={`px-2.5 py-1.5 ${lang === "en" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>EN</button>
              </div>
            </div>

            {/* model pills */}
            <div className="oji-up-2 flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4">
              {MODELS.map((mo) => (
                <button key={mo.id} onClick={() => pickModel(mo.id)} title={`$${mo.inPrice}/$${mo.outPrice} لكل مليون توكن`} className={`px-3 py-1.5 rounded-xl text-xs transition border ${model === mo.id ? "border-[var(--oji-primary)] bg-[var(--oji-primary)]/15 text-white font-bold" : "border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white hover:border-[var(--oji-primary)]"}`}>
                  {mo.badge} {mo.label} · {mo.speed}
                </button>
              ))}
            </div>

            {/* prompt box */}
            <div className="oji-up-3 oji-glow oji-glass rounded-2xl p-3 text-right">
              {entry === "url" ? (
                <div className="flex flex-col gap-2">
                  <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://example.com" className="w-full bg-transparent outline-none px-3 py-3 text-base placeholder:text-[var(--oji-muted)]" onKeyDown={(e) => e.key === "Enter" && launchUrl()} />
                  <div className="flex items-center justify-between gap-2 px-2 pb-1">
                    <span className="text-xs text-[var(--oji-muted)]">{busy || "سنقرأ الموقع ونعيد بناءه"}</span>
                    <button onClick={launchUrl} disabled={!url.trim() || !!busy} className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] disabled:opacity-40 transition">ابنِ من الرابط 🔗</button>
                  </div>
                </div>
              ) : (
                <>
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) launchText(); }} placeholder={entry === "image" ? "ملاحظات اختيارية عن التصميم المرفوع..." : "مثال: موقع لمطعم إيطالي يعرض المنيو ونموذج حجز طاولة..."} className="w-full h-24 bg-transparent resize-none outline-none px-3 py-2 text-base placeholder:text-[var(--oji-muted)]" />
                  <div className="flex items-center justify-between gap-2 px-2 pb-1">
                    <span className="text-xs text-[var(--oji-muted)]">{entry === "image" ? "ارفع تصميمًا" : "Ctrl + Enter"}</span>
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
          </div>

          {/* Animated faux-browser mockup (desktop) */}
          <div className="oji-up-3 hidden lg:block relative">
            <div className="oji-glass oji-float rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[var(--oji-border)] bg-[var(--oji-surface-2)]">
                <span className="w-3 h-3 rounded-full bg-red-400/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <span className="w-3 h-3 rounded-full bg-green-400/70" />
                <span dir="ltr" className="ms-auto text-xs text-[var(--oji-muted)] px-3 py-0.5 rounded-md bg-[var(--oji-bg)]/60">yoursite.oji</span>
              </div>
              <div className="p-4 space-y-3 h-[340px] bg-gradient-to-br from-[var(--oji-surface)] to-[var(--oji-bg)]">
                <div className="h-28 rounded-xl bg-gradient-to-l from-[var(--oji-primary)]/35 to-[var(--oji-accent)]/25 flex items-center justify-center">
                  <div className="oji-skel h-4 w-1/2 rounded" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg bg-[var(--oji-surface-2)] p-3 space-y-2">
                      <div className="w-8 h-8 rounded-md bg-[var(--oji-primary)]/30" />
                      <div className="oji-skel h-2.5 rounded w-full" />
                      <div className="oji-skel h-2.5 rounded w-2/3" />
                    </div>
                  ))}
                </div>
                <div className="oji-skel h-3 rounded w-2/3 ms-auto" />
                <div className="oji-skel h-3 rounded w-1/2 ms-auto" />
                <div className="h-10 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] w-40 ms-auto" />
              </div>
            </div>
            <div className="absolute -bottom-4 -start-4 oji-glass rounded-xl px-3 py-2 text-xs font-bold shadow-xl">⚡ تم البناء في 30 ثانية</div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="oji-reveal mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto">
          {[["+16", "قالب جاهز"], ["4", "نماذج ذكاء"], ["دقائق", "لا أسابيع"], ["∞", "تعديلات حرة"]].map(([n, l]) => (
            <div key={l} className="oji-glass rounded-2xl py-4 text-center">
              <div className="text-2xl font-extrabold oji-gradient-text">{n}</div>
              <div className="text-xs text-[var(--oji-muted)] mt-1">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="oji-reveal max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold mb-1 text-center">ابدأ من قالب جاهز</h2>
        <p className="text-[var(--oji-muted)] text-center mb-6">اضغط على أي قالب لتوليده فورًا، ثم خصّصه كما تشاء.</p>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-xs transition ${cat === c ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "border border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white"}`}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {shown.map((t, i) => (
            <button
              key={t.id}
              onClick={() => go({ prompt: t.prompt, lang })}
              style={{ animationDelay: `${(i % 6) * 0.4}s` }}
              className="oji-float group w-[140px] sm:w-[160px] rounded-2xl oji-glass p-4 text-center shadow-[0_18px_36px_-20px_rgba(0,0,0,.8)] transition-[box-shadow,border-color] duration-300 hover:border-[var(--oji-primary)] hover:shadow-[0_26px_50px_-16px_rgba(255,138,76,.65)]"
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br from-[var(--oji-primary)]/30 to-[var(--oji-accent)]/20 border border-[var(--oji-border)] group-hover:scale-110 transition">{t.emoji}</div>
              <div className="font-bold text-sm mb-2 truncate group-hover:text-[var(--oji-primary)] transition">{t.title}</div>
              <div className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--oji-surface-2)] text-[var(--oji-muted)] inline-block">{t.category}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Features bento */}
      <section className="oji-reveal max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">كل ما تحتاجه لموقع احترافي</h2>
        <p className="text-[var(--oji-muted)] text-center mb-8">منصة متكاملة من الفكرة حتى النشر.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:row-span-2 rounded-3xl oji-glass p-6 flex flex-col justify-between overflow-hidden relative">
            <div className="absolute -top-10 -start-10 w-44 h-44 rounded-full bg-[var(--oji-primary)]/10 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="text-4xl mb-3">🌐</div>
              <h3 className="text-xl font-extrabold mb-2">مواقع كاملة متعددة الصفحات</h3>
              <p className="text-sm text-[var(--oji-muted)] max-w-md">مش صفحة واحدة — موقع كامل بصفحاته (الرئيسية، من نحن، الخدمات، تواصل...) بمحتوى وتصميم احترافي.</p>
            </div>
            <div className="relative mt-5 grid grid-cols-4 gap-2">
              {["🏠", "ℹ️", "🛠️", "✉️"].map((e, i) => (
                <div key={i} className="aspect-video rounded-lg bg-[var(--oji-surface-2)] flex items-center justify-center text-lg">{e}</div>
              ))}
            </div>
          </div>
          {[
            { icon: "🖱️", t: "تعديل بصري بالنقر", d: "اضغط أي عنصر وعدّله بإيدك، أو اطلب من الذكاء تعديله." },
            { icon: "🚀", t: "نشر فوري + دومين خاص", d: "انشر بضغطة، واربط دومينك مع شهادة SSL تلقائية." },
            { icon: "🧠", t: "4 نماذج ذكاء", d: "اختر بين Haiku/Sonnet/Opus حسب السرعة والجودة، وشوف التكلفة." },
            { icon: "💾", t: "حفظ وتصدير", d: "احفظ مشاريعك في حسابك، أو نزّل كود الموقع كامل." },
          ].map((f) => (
            <div key={f.t} className="rounded-3xl oji-glass p-6 hover:border-[var(--oji-primary)] transition">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold mb-1.5">{f.t}</h3>
              <p className="text-sm text-[var(--oji-muted)]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* oji brain promo section */}
      <section className="oji-reveal max-w-5xl mx-auto px-6 py-10">
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

      <section id="how" className="oji-reveal max-w-5xl mx-auto px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">كيف يعمل؟</h2>
        <p className="text-[var(--oji-muted)] text-center mb-10">ثلاث خطوات بسيطة من الفكرة إلى موقع منشور.</p>
        <div className="relative grid sm:grid-cols-3 gap-6">
          {/* connecting line (desktop) */}
          <div className="hidden sm:block absolute top-8 inset-x-[16%] h-px bg-gradient-to-l from-[var(--oji-primary)]/60 via-[var(--oji-accent)]/40 to-transparent" />
          {[
            { n: "١", icon: "💡", t: "صِف فكرتك", d: "اكتب وصفًا، أو ارفع صورة تصميم، أو ضع رابط موقع." },
            { n: "٢", icon: "⚡", t: "يتولّد الموقع", d: "موقع كامل بكل صفحاته ومحتواه في دقائق." },
            { n: "٣", icon: "🚀", t: "عدّل وانشر", d: "بالنقر أو بالأمر، ثم انشر على دومينك أو نزّله." },
          ].map((s) => (
            <div key={s.n} className="relative text-center">
              <div className="relative z-10 w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] shadow-[0_14px_30px_-10px_rgba(255,138,76,.6)]">
                {s.icon}
                <span className="absolute -top-2 -start-2 w-7 h-7 rounded-full bg-[var(--oji-surface)] border border-[var(--oji-border)] flex items-center justify-center text-xs font-bold text-[var(--oji-primary)]">{s.n}</span>
              </div>
              <div className="font-bold text-lg mb-2">{s.t}</div>
              <div className="text-sm text-[var(--oji-muted)] max-w-xs mx-auto">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="oji-reveal max-w-5xl mx-auto px-6 py-12">
        <div className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-l from-[var(--oji-primary)] via-[var(--oji-accent)] to-[var(--oji-primary)] oji-glow">
          <div className="rounded-3xl bg-[var(--oji-surface)] px-6 py-12 text-center">
            <h2 className="text-2xl sm:text-4xl font-extrabold mb-3">جاهز تبني موقعك دلوقتي؟</h2>
            <p className="text-[var(--oji-muted)] mb-7 max-w-xl mx-auto">ابدأ مجانًا — اكتب فكرتك ودع الذكاء الاصطناعي يبني لك موقعًا كاملًا في دقائق.</p>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="px-8 py-3.5 rounded-2xl font-extrabold text-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] hover:scale-105 transition shadow-2xl">
              ابدأ الآن ✨
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
