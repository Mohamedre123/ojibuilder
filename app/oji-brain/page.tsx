"use client";

import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const FEATURES = [
  { emoji: "✍️", title: "توليد البرومبت", desc: "برومبتات احترافية جاهزة لأي مهمة في ثوانٍ." },
  { emoji: "🖼️", title: "توليد الصور", desc: "صور وتصاميم عالية الجودة من مجرد وصف." },
  { emoji: "🎬", title: "توليد الفيديو", desc: "فيديوهات تسويقية ومحتوى بصري جذّاب." },
  { emoji: "📈", title: "الاستراتيجيات", desc: "خطط تسويق ونمو مبنية على الذكاء الاصطناعي." },
  { emoji: "🤖", title: "وكلاء AI في كل جزء", desc: "وكلاء أذكياء يساعدونك في كل خطوة تلقائيًا." },
  { emoji: "🚀", title: "تكبير مشروعك", desc: "كل ما تحتاجه لنمو مشروعك في منصة واحدة." },
];

export default function OjiBrain() {
  const router = useRouter();
  return (
    <>
      <main className="min-h-screen max-w-5xl mx-auto px-6 py-12">
        <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition mb-8">← الرئيسية</button>

        {/* Hero */}
        <div className="text-center mb-12 oji-up">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#7c3aed] to-[#22d3ee] flex items-center justify-center text-6xl oji-float shadow-2xl">🧠</div>
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full oji-glass text-[var(--oji-muted)] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#d946ef] animate-pulse" /> منصتنا المتكاملة
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">
            <span className="oji-gradient-text">oji brain</span>
          </h1>
          <p className="text-[var(--oji-muted)] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            دراعك اليمين بالذكاء الاصطناعي. منصة واحدة مدمجة بالكامل تجمع كل ما يحتاجه مشروعك — من توليد المحتوى والصور والفيديو، إلى الاستراتيجيات ووكلاء الذكاء الاصطناعي في كل جزء — لتساعدك على تكبير مشروعك بكل ما تحتاجه في مكان واحد.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="oji-glass rounded-2xl p-5 text-center sm:text-right">
              <div className="text-3xl mb-3">{f.emoji}</div>
              <div className="font-bold mb-1">{f.title}</div>
              <div className="text-sm text-[var(--oji-muted)]">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Concept */}
        <div className="oji-glass rounded-3xl p-6 sm:p-8 text-center mb-12">
          <h2 className="text-xl sm:text-2xl font-extrabold mb-3">الفكرة باختصار</h2>
          <p className="text-[var(--oji-muted)] max-w-3xl mx-auto leading-relaxed">
            بدل ما تتنقّل بين عشرات الأدوات، oji brain بيجمعها كلها في منصة واحدة ذكية. كل أداة مدعومة بالذكاء الاصطناعي ووكلاء يشتغلوا معك خطوة بخطوة — توفّر وقتك، تنظّم شغلك، وتسرّع نمو مشروعك.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href="https://oji-brain.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-extrabold text-white text-lg bg-gradient-to-l from-[#7c3aed] to-[#d946ef] hover:scale-105 transition shadow-2xl"
          >
            ادخل إلى oji brain <span aria-hidden>↗</span>
          </a>
          <p className="text-xs text-[var(--oji-muted)] mt-3">سيفتح الموقع في نافذة جديدة</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
