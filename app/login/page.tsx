"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { authEnabled } from "@/lib/supabase/config";

// Supabase can surface opaque failures (paused project, wrong URL, CORS,
// blocked network) as an error whose message is literally "{}" — translate
// those into something the user can act on instead of showing raw JSON.
function authError(e: unknown, fallback: string): string {
  const err = e as { message?: string; status?: number; name?: string } | null;
  const raw = (err?.message || "").trim();
  const status = err?.status;
  const name = err?.name || "";

  if (!raw || raw === "{}" || raw === "[object Object]" || /failed to fetch|networkerror|load failed/i.test(raw) || name === "AuthRetryableFetchError") {
    return "تعذّر الاتصال بخادم الحسابات (Supabase). تأكد أن مشروع Supabase نشط وغير متوقف، وأن NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY مضبوطان بشكل صحيح في إعدادات النشر، ثم أعِد النشر (Redeploy).";
  }
  if (status === 429 || /rate limit|too many/i.test(raw)) {
    return "تم إرسال رسائل كثيرة خلال وقت قصير. انتظر دقائق ثم أعِد المحاولة. (بريد Supabase الافتراضي محدود جدًا — يُفضّل ضبط SMTP مخصّص مثل Resend.)";
  }
  if (/smtp|sending|email.*(failed|error)|error sending/i.test(raw)) {
    return "فشل إرسال البريد من Supabase. اضبط مزوّد بريد (SMTP) من: Authentication → Emails/SMTP، أو فعّل Email provider، ثم أعِد المحاولة.";
  }
  if (/signups? not allowed|disabled/i.test(raw)) {
    return "التسجيل بالبريد معطّل في Supabase. فعّله من: Authentication → Providers → Email.";
  }
  if (/invalid|expired|token/i.test(raw)) return "الرمز غير صحيح أو انتهت صلاحيته — اطلب رمزًا جديدًا.";
  return raw || fallback;
}

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("/builder");

  useEffect(() => {
    const rt = new URLSearchParams(window.location.search).get("returnTo");
    if (rt) setReturnTo(rt);
    const sb = getSupabase();
    if (sb) sb.auth.getUser().then(({ data }) => { if (data.user) router.replace(returnTo); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("code");
    } catch (e) {
      console.error("OTP send failed:", e);
      setError(authError(e, "تعذّر إرسال الرمز"));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const sb = getSupabase();
    if (!sb || code.trim().length < 6) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await sb.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      try { localStorage.setItem("oji:lastActive", String(Date.now())); } catch {}
      router.replace(returnTo);
    } catch (e) {
      console.error("OTP verify failed:", e);
      setError(authError(e, "رمز غير صحيح"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-h flex items-center justify-center px-6">
      <div className="w-full max-w-md oji-glass oji-glow rounded-3xl p-7 oji-up">
        <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition mb-6">← الرئيسية</button>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--oji-primary)] to-[var(--oji-accent)] flex items-center justify-center font-extrabold text-[#06121f]">O</div>
          <span className="text-xl font-extrabold">oji <span className="oji-gradient-text">builder</span></span>
        </div>

        {!authEnabled ? (
          <p className="text-[var(--oji-muted)] text-sm leading-relaxed">
            نظام الحسابات غير مُفعّل بعد. (يحتاج ضبط مفاتيح Supabase في الخادم.)
          </p>
        ) : step === "email" ? (
          <>
            <h1 className="text-2xl font-extrabold mb-2">تسجيل الدخول / إنشاء حساب</h1>
            <p className="text-sm text-[var(--oji-muted)] mb-5">اكتب بريدك وسنرسل لك رمز تحقّق (OTP).</p>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-[var(--oji-surface-2)] border border-[var(--oji-border)] px-4 py-3 outline-none focus:border-[var(--oji-primary)] mb-3"
            />
            <button onClick={sendCode} disabled={busy || !email.trim()} className="w-full py-3 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] disabled:opacity-40 transition">
              {busy ? "...جارٍ الإرسال" : "إرسال الرمز"}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold mb-2">أدخل رمز التحقّق</h1>
            <p className="text-sm text-[var(--oji-muted)] mb-5">أرسلنا رمزًا إلى <span className="text-white" dir="ltr">{email}</span></p>
            <input
              inputMode="numeric"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="أدخل الرمز"
              className="w-full text-center tracking-[0.4em] text-xl rounded-xl bg-[var(--oji-surface-2)] border border-[var(--oji-border)] px-4 py-3 outline-none focus:border-[var(--oji-primary)] mb-3"
            />
            <button onClick={verify} disabled={busy || code.length < 6} className="w-full py-3 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] disabled:opacity-40 transition mb-2">
              {busy ? "...جارٍ التحقّق" : "تأكيد ودخول"}
            </button>
            <button onClick={() => { setStep("email"); setCode(""); setError(""); }} className="w-full text-sm text-[var(--oji-muted)] hover:text-white transition">
              تغيير البريد / إعادة الإرسال
            </button>
          </>
        )}

        {error && <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-sm px-4 py-3">{error}</div>}
      </div>
    </main>
  );
}
