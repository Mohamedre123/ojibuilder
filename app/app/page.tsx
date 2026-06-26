"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_MODEL } from "@/lib/models";
import GithubButton from "@/components/GithubButton";

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

function setupGuide(idea: string): string {
  return `# دليل تشغيل ونشر التطبيق — oji builder

تطبيقك: ${idea}

التقنية: Next.js + Supabase (قاعدة بيانات + تسجيل دخول بـ OTP).

اتبع الخطوات بالترتيب:

## 1) المتطلبات
- ثبّت Node.js من https://nodejs.org (نسخة 18 أو أحدث).

## 2) تجهيز المشروع
- فك ضغط الملف، افتح مجلد المشروع في الطرفية (Terminal).
- شغّل: \`npm install\`

## 3) إنشاء قاعدة البيانات (Supabase)
1. أنشئ حسابًا ومشروعًا على https://supabase.com
2. من المشروع: **SQL Editor** → الصق محتوى ملف \`supabase/schema.sql\` → **Run**.
3. من **Authentication → Providers → Email**: فعّل **Email OTP** (Confirm email عبر رمز).
4. (اختياري) **Authentication → SMTP**: اضبط مزوّد بريد مثل Resend ليصل رمز الـ OTP من بريدك.

## 4) متغيّرات البيئة
- انسخ \`.env.example\` إلى \`.env.local\`.
- من Supabase: **Settings → API**:
  - \`NEXT_PUBLIC_SUPABASE_URL\` = Project URL (مثل https://xxxx.supabase.co — بدون / في الآخر).
  - \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` = مفتاح anon public.

## 5) التشغيل محليًا
- شغّل: \`npm run dev\`
- افتح http://localhost:3000

## 6) النشر (Vercel)
1. ارفع المشروع على GitHub.
2. على https://vercel.com اعمل Import للمستودع.
3. في **Settings → Environment Variables** أضف نفس المتغيّرين أعلاه.
4. **Deploy** — وموقعك يشتغل أونلاين.

## ملاحظات أمان
- قاعدة البيانات محميّة بـ Row Level Security (كل مستخدم يرى بياناته فقط).
- لا تضع المفتاح السري (service_role) في الكود إطلاقًا — فقط anon key العام.

صُنع بـ oji builder.
`;
}

export default function AppBuilder() {
  const router = useRouter();
  const [files, setFiles] = useState<GenFile[]>([]);
  const [status, setStatus] = useState("جارٍ توليد تطبيقك...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zipping, setZipping] = useState(false);
  const startedRef = useRef(false);
  const ideaRef = useRef("");
  const rawRef = useRef("");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const prompt = sessionStorage.getItem("oji:prompt");
    const model = sessionStorage.getItem("oji:model") || DEFAULT_MODEL;
    const lang = sessionStorage.getItem("oji:lang") || "ar";
    if (!prompt) {
      router.push("/");
      return;
    }
    ideaRef.current = prompt;
    generate(prompt, model, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(prompt: string, model: string, lang: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, lang, step: "app" }),
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
        rawRef.current = buf;
        const f = parseFiles(buf);
        if (f.length) {
          setFiles(f);
          setStatus(`تم توليد ${f.length} ملف...`);
        }
      }
      const errMatch = buf.match(/<!--OJI_ERROR:([\s\S]*?)-->/);
      if (errMatch) throw new Error(errMatch[1]);
      const finalFiles = parseFiles(buf);
      if (!finalFiles.length) throw new Error("لم يتم توليد ملفات صالحة، جرّب مجددًا أو بصياغة أوضح.");
      setFiles(finalFiles);
      setStatus(`تطبيقك جاهز — ${finalFiles.length} ملف.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  async function openLive() {
    if (!files.length) return;
    try {
      const sdk = (await import("@stackblitz/sdk")).default;
      const fileMap: Record<string, string> = {};
      for (const f of files) fileMap[f.path] = f.content;
      if (!fileMap["package.json"]) {
        fileMap["package.json"] = JSON.stringify(
          { name: "oji-app", scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "latest", react: "latest", "react-dom": "latest" } },
          null,
          2
        );
      }
      sdk.openProject(
        { title: "oji app", description: ideaRef.current, template: "node", files: fileMap },
        { newWindow: true }
      );
    } catch {
      setError("تعذّر فتح المعاينة المباشرة — جرّب تنزيل المشروع.");
    }
  }

  async function download() {
    if (!files.length || zipping) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of files) zip.file(f.path, f.content);
      zip.file("SETUP.md", setupGuide(ideaRef.current));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "oji-app.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("تعذّر تجهيز ملف ZIP.");
    } finally {
      setZipping(false);
    }
  }

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-6 py-10">
      <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition mb-6">← الرئيسية</button>

      <div className="text-center mb-8">
        <div className="text-5xl mb-3">📱</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">توليد تطبيق كامل</h1>
        <p className="text-[var(--oji-muted)] text-sm max-w-xl mx-auto">{ideaRef.current}</p>
      </div>

      <div className="oji-glass rounded-2xl p-5 mb-6 flex items-center gap-3">
        {loading && <span className="w-3 h-3 rounded-full bg-[var(--oji-primary)] animate-pulse shrink-0" />}
        <span className="text-sm">{status}</span>
      </div>

      {error && (
        <div className="rounded-2xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/40 text-red-300 mb-6 space-y-2">
          <div>{error}</div>
          <button onClick={() => { startedRef.current = false; const p = sessionStorage.getItem("oji:prompt") || ""; ideaRef.current = p; generate(p, sessionStorage.getItem("oji:model") || DEFAULT_MODEL, sessionStorage.getItem("oji:lang") || "ar"); }} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-bold transition">إعادة المحاولة ↻</button>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="oji-glass rounded-2xl p-4 mb-6">
            <div className="text-sm font-bold mb-3">ملفات المشروع ({files.length})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto scroll-touch">
              {files.map((f) => (
                <div key={f.path} dir="ltr" className="text-xs text-[var(--oji-muted)] truncate font-mono px-2 py-1 rounded bg-[var(--oji-surface-2)]">📄 {f.path}</div>
              ))}
            </div>
          </div>

          {!loading && (
            <div className="text-center mb-8 flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={download} disabled={zipping} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-extrabold text-[#06121f] bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] hover:scale-105 transition shadow-2xl disabled:opacity-50">
                  {zipping ? "...جارٍ التجهيز" : "⬇️ تنزيل المشروع (ZIP)"}
                </button>
                <button onClick={openLive} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-extrabold text-white bg-gradient-to-l from-[var(--oji-accent)] to-[#7c5cff] hover:scale-105 transition shadow-2xl">
                  ▶️ تشغيل مباشر
                </button>
                <button onClick={() => router.push("/apk")} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold border border-[var(--oji-border)] hover:border-[var(--oji-accent)] transition">
                  📦 تحويل لـ APK
                </button>
                <GithubButton files={() => Object.fromEntries(files.map((f) => [f.path, f.content]))} defaultRepo="oji-app" className="px-7 py-3.5 rounded-2xl" />
              </div>
              <p className="text-xs text-[var(--oji-muted)]">التنزيل: كل الملفات + SETUP. التشغيل المباشر يفتح المشروع حيًّا في StackBlitz (الأفضل على متصفح كمبيوتر).</p>
            </div>
          )}
        </>
      )}

      <div className="oji-glass rounded-2xl p-5">
        <h2 className="font-extrabold mb-3">📋 الخطوات بعد التنزيل</h2>
        <ol className="space-y-2 text-sm text-[var(--oji-muted)] list-decimal pe-5">
          <li>ثبّت Node.js، وفك ضغط المشروع، وشغّل <code className="text-[var(--oji-primary)]">npm install</code>.</li>
          <li>أنشئ مشروع Supabase، وشغّل <code className="text-[var(--oji-primary)]">supabase/schema.sql</code> في SQL Editor.</li>
          <li>فعّل Email OTP في Authentication (واضبط SMTP مثل Resend لإرسال الرمز).</li>
          <li>انسخ <code className="text-[var(--oji-primary)]">.env.example</code> إلى <code className="text-[var(--oji-primary)]">.env.local</code> واملأ رابط Supabase ومفتاح anon.</li>
          <li><code className="text-[var(--oji-primary)]">npm run dev</code> للتجربة، ثم انشر على Vercel بنفس المتغيّرات.</li>
        </ol>
        <p className="text-xs text-[var(--oji-muted)] mt-3">كل التفاصيل موجودة داخل ملف <strong>SETUP.md</strong> في المشروع.</p>
      </div>
    </main>
  );
}
