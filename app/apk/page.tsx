"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

export default function Apk() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("url");
    if (u) setUrl(u);
  }, []);

  function normalize(v: string): string {
    let s = v.trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    return s;
  }

  function convert() {
    const s = normalize(url);
    if (!s) return;
    window.open(`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(s)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <main className="min-h-screen max-w-2xl mx-auto px-6 py-12">
        <button onClick={() => router.back()} className="text-sm text-[var(--oji-muted)] hover:text-white transition mb-8">← رجوع</button>

        <div className="text-center mb-8 oji-up">
          <div className="text-5xl mb-3">📦</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">حوّل موقعك أو تطبيقك إلى <span className="oji-gradient-text">APK</span></h1>
          <p className="text-[var(--oji-muted)] text-sm max-w-xl mx-auto">احصل على ملف تطبيق أندرويد (APK) قابل للتثبيت من رابط موقعك المنشور — يُبنى في السحابة عبر PWABuilder المجاني، بدون أي خطوات بناء منك.</p>
        </div>

        <div className="oji-glass oji-glow rounded-2xl p-5 mb-6">
          <label className="block text-sm font-bold mb-2">رابط الموقع / التطبيق المنشور</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://your-site.com" onKeyDown={(e) => e.key === "Enter" && convert()} className="w-full bg-[var(--oji-surface-2)] border border-[var(--oji-border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--oji-primary)] mb-3" />
          <button onClick={convert} disabled={!url.trim()} className="w-full py-3 rounded-xl font-extrabold text-[#06121f] bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] disabled:opacity-40 hover:scale-[1.02] transition">📦 ابدأ التحويل إلى APK</button>
          <p className="text-xs text-[var(--oji-muted)] mt-2 text-center">سيفتح PWABuilder في نافذة جديدة، ومنه تنزّل حزمة الأندرويد.</p>
        </div>

        <div className="oji-glass rounded-2xl p-5">
          <h2 className="font-extrabold mb-3">📋 الخطوات</h2>
          <ol className="space-y-2 text-sm text-[var(--oji-muted)] list-decimal pe-5">
            <li><strong className="text-white">للموقع:</strong> انشره من زر «🚀 نشر» (أو استخدم رابطه/دومينه)، وحط الرابط فوق.</li>
            <li><strong className="text-white">للتطبيق:</strong> انشره أولًا على استضافة (Vercel) ليصبح له رابط، ثم حط الرابط فوق.</li>
            <li>اضغط «ابدأ التحويل» → في PWABuilder اختر <strong className="text-white">Android</strong> → <strong className="text-white">Generate / Download</strong>.</li>
            <li>انقل ملف الـ APK للهاتف وثبّته (فعّل «تثبيت من مصادر غير معروفة» لو طُلب).</li>
          </ol>
          <p className="text-xs text-[var(--oji-muted)] mt-3">ملاحظة: APK خاص بالأندرويد. لنُسخة iOS، PWABuilder يوفّرها أيضًا لكنها تتطلب جهاز Mac وحساب مطوّر Apple. ويُفضّل أن يكون الرابط HTTPS.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
