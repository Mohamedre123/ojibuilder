"use client";

import { useRouter } from "next/navigation";
import PromoBanner from "@/components/PromoBanner";

const CONTACTS = [
  { label: "رقم الهاتف", num: "+201200026457", emoji: "📞", desc: "للاستفسارات العامة والتواصل المباشر" },
  { label: "رقم الشكاوى", num: "+201200922780", emoji: "📝", desc: "لتقديم أي شكوى أو ملاحظة" },
  { label: "خدمة العملاء", num: "+966576913063", emoji: "🎧", desc: "للدعم الفني ومساعدتك خطوة بخطوة" },
];

export default function Contact() {
  const router = useRouter();
  return (
    <>
      <PromoBanner />
      <main className="min-h-screen max-w-4xl mx-auto px-6 py-12">
        <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition mb-8">← الرئيسية</button>

        <div className="text-center mb-10 oji-up">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">تواصل <span className="oji-gradient-text">معنا</span></h1>
          <p className="text-[var(--oji-muted)] max-w-2xl mx-auto">
            نحن هنا من أجلك. فريق <span className="font-bold text-white">oji builder</span> جاهز للرد على استفساراتك وحل أي مشكلة ومساعدتك في تحقيق أقصى استفادة من المنصة. اختر وسيلة التواصل الأنسب وسنرد عليك بأسرع وقت.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {CONTACTS.map((c) => (
            <div key={c.num} className="oji-glass oji-glow rounded-3xl p-6 text-center flex flex-col">
              <div className="text-4xl mb-3">{c.emoji}</div>
              <div className="font-extrabold text-lg mb-1">{c.label}</div>
              <p className="text-xs text-[var(--oji-muted)] mb-4 flex-1">{c.desc}</p>
              <a href={`tel:${c.num}`} dir="ltr" className="block font-extrabold text-base mb-3 hover:text-[var(--oji-primary)] transition">{c.num}</a>
              <div className="flex gap-2 justify-center">
                <a href={`tel:${c.num}`} className="flex-1 py-2 rounded-xl bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm">اتصال</a>
                <a href={`https://wa.me/${c.num.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-xl border border-[var(--oji-border)] hover:border-[#25D366] hover:text-[#25D366] font-bold text-sm transition">واتساب</a>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[var(--oji-muted)] mt-10">ساعات العمل: يوميًا — وسنسعد دائمًا بخدمتك 💙</p>
      </main>
    </>
  );
}
