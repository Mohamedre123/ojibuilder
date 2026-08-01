"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_MODEL } from "@/lib/models";
import Footer from "@/components/Footer";

interface GenFile {
  path: string;
  content: string;
}

function parseFiles(raw: string): GenFile[] {
  const re = /===FILE:\s*(.+?)\s*===\r?\n([\s\S]*?)\r?\n===END===/g;
  const files: GenFile[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const path = m[1].trim().replace(/^\/+/, "");
    if (path) files.push({ path, content: m[2] });
  }
  return files;
}

const UPLOAD_STEPS: Record<string, string[]> = {
  shopify: [
    "اضغط «⬇️ تنزيل الثيم (ZIP)» — الملف جاهز بالبنية الرسمية.",
    "ادخل لوحة Shopify → Online Store → Themes.",
    "اضغط Add theme → Upload zip file، واختر الملف.",
    "بعد الرفع: Customize لتعديل كل قسم (كل الأقسام قابلة للإضافة والحذف والترتيب).",
    "لما يعجبك: Actions → Publish.",
  ],
  woocommerce: [
    "اضغط «⬇️ تنزيل الثيم (ZIP)».",
    "ادخل لوحة ووردبريس → المظهر (Appearance) → القوالب (Themes).",
    "اضغط أضف جديد → رفع قالب (Upload Theme) → اختر الملف → تثبيت.",
    "فعّل القالب، وتأكد أن إضافة WooCommerce مثبّتة ومفعّلة.",
    "عدّل كل شيء من: المظهر → المحرّر (Site Editor).",
  ],
  salla: [
    "اضغط «⬇️ تنزيل الثيم (ZIP)».",
    "ثبّت أداة سلة: npm i -g @salla.sa/cli ثم salla login.",
    "فك الضغط وادخل المجلد وشغّل: salla theme push",
    "من لوحة سلة → التصميم → فعّل الثيم وعدّل أقسامه.",
  ],
  default: [
    "اضغط «⬇️ تنزيل الثيم (ZIP)».",
    "افتح ملف README.md بالداخل — فيه خطوات الرفع لمنصتك بالتفصيل.",
    "ارفع الملفات على المنصة أو الاستضافة، ثم اربط حقول المنتجات كما هو موضّح.",
  ],
};

export default function ThemeBuilder() {
  const router = useRouter();
  const [files, setFiles] = useState<GenFile[]>([]);
  const [status, setStatus] = useState("جارٍ توليد الثيم...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zipping, setZipping] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const startedRef = useRef(false);
  const ideaRef = useRef("");
  const platRef = useRef("shopify");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const prompt = sessionStorage.getItem("oji:prompt");
    if (!prompt) {
      router.push("/");
      return;
    }
    ideaRef.current = prompt;
    platRef.current = sessionStorage.getItem("oji:platform") || "shopify";
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    setStatus("جارٍ توليد ملفات الثيم...");
    try {
      let store: Record<string, string> | null = null;
      try {
        store = JSON.parse(sessionStorage.getItem("oji:store") || "null");
      } catch {
        store = null;
      }
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: sessionStorage.getItem("oji:prompt") || "",
          model: sessionStorage.getItem("oji:model") || DEFAULT_MODEL,
          lang: sessionStorage.getItem("oji:lang") || "ar",
          step: "theme",
          platform: sessionStorage.getItem("oji:platform") || "shopify",
          platformCustom: sessionStorage.getItem("oji:platformCustom") || "",
          theme: sessionStorage.getItem("oji:theme") || "auto",
          store,
        }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({ error: `فشل الطلب (${res.status})` }));
        throw new Error(d.error || `فشل الطلب (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const f = parseFiles(buf);
        if (f.length) {
          setFiles(f);
          setStatus(`تم توليد ${f.length} ملف...`);
        }
      }
      const errMatch = buf.match(/<!--OJI_ERROR:([\s\S]*?)-->/);
      if (errMatch) throw new Error(errMatch[1]);
      const finalFiles = parseFiles(buf);
      if (!finalFiles.length) throw new Error("لم يتم توليد ملفات صالحة، جرّب مجددًا أو بوصف أوضح.");
      setFiles(finalFiles);
      setStatus(`الثيم جاهز — ${finalFiles.length} ملف.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!files.length || zipping) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of files) zip.file(f.path, f.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oji-theme-${platRef.current}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("تعذّر تجهيز ملف ZIP.");
    } finally {
      setZipping(false);
    }
  }

  const steps = UPLOAD_STEPS[platRef.current] || UPLOAD_STEPS.default;

  return (
    <>
      <main className="min-h-screen max-w-4xl mx-auto px-5 sm:px-6 py-10">
        <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition mb-6">← الرئيسية</button>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎨</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">ثيم <span className="oji-gradient-text">احترافي</span> جاهز للرفع</h1>
          <p className="text-[var(--oji-muted)] text-sm max-w-xl mx-auto">{ideaRef.current}</p>
        </div>

        <div className="oji-glass rounded-2xl p-5 mb-6 flex items-center gap-3">
          {loading && <span className="w-3 h-3 rounded-full bg-[var(--oji-primary)] animate-pulse shrink-0" />}
          <span className="text-sm">{status}</span>
        </div>

        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/40 text-red-300 mb-6 space-y-2">
            <div>{error}</div>
            <button onClick={() => { startedRef.current = false; generate(); }} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-bold transition">إعادة المحاولة ↻</button>
          </div>
        )}

        {files.length > 0 && (
          <>
            <div className="oji-glass rounded-2xl p-4 mb-6">
              <div className="text-sm font-bold mb-3">ملفات الثيم ({files.length}) — اضغط أي ملف لعرضه</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto scroll-touch">
                {files.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => setOpen(open === f.path ? null : f.path)}
                    dir="ltr"
                    className={`text-xs truncate font-mono px-2 py-1.5 rounded text-left transition ${open === f.path ? "bg-[var(--oji-primary)]/20 text-white" : "bg-[var(--oji-surface-2)] text-[var(--oji-muted)] hover:text-white"}`}
                  >
                    📄 {f.path}
                  </button>
                ))}
              </div>
              {open && (
                <pre dir="ltr" className="mt-3 max-h-72 overflow-auto scroll-touch bg-[#0a0f1c] text-[#c8d3e6] text-[11px] leading-relaxed p-3 rounded-xl">
                  {files.find((f) => f.path === open)?.content}
                </pre>
              )}
            </div>

            {!loading && (
              <div className="text-center mb-8">
                <button onClick={download} disabled={zipping} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-extrabold text-[#06121f] bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] hover:scale-105 transition shadow-2xl disabled:opacity-50">
                  {zipping ? "...جارٍ التجهيز" : "⬇️ تنزيل الثيم (ZIP)"}
                </button>
              </div>
            )}
          </>
        )}

        <div className="oji-glass rounded-2xl p-5">
          <h2 className="font-extrabold mb-3">📋 خطوات الرفع على منصتك</h2>
          <ol className="space-y-2 text-sm text-[var(--oji-muted)] list-decimal pe-5">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="text-xs text-[var(--oji-muted)] mt-3">
            كل قسم في الثيم له إعدادات وblocks كاملة — تقدر تضيف وتحذف وترتّب <strong className="text-white">كل</strong> الأقسام من لوحة المنصة، مش قسمين بس زي الثيمات الجاهزة.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
