"use client";

import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const AGENCY_URL = "https://www.oji-agency.site/";

const SERVICES = [
  { emoji: "🎯", title: "استراتيجية تسويقية", desc: "خطة واضحة مبنية على تحليل السوق والمنافسين وجمهورك." },
  { emoji: "🎨", title: "هوية وتصاميم إبداعية", desc: "هوية بصرية قوية وتصاميم تميّز علامتك عن غيرها." },
  { emoji: "📣", title: "إدارة الحملات الإعلانية", desc: "حملات مدروسة تستهدف عملاءك الحقيقيين وتحقّق مبيعات." },
  { emoji: "✍️", title: "كتابة المحتوى", desc: "محتوى تسويقي يخاطب عميلك ويدفعه لقرار الشراء بثقة." },
  { emoji: "🎬", title: "فيديوهات سوشيال ميديا", desc: "فيديوهات قصيرة جذّابة تزيد الوصول والتفاعل." },
  { emoji: "🔍", title: "تحسين محركات البحث (SEO)", desc: "ظهور أفضل في جوجل وزيارات مجانية مستمرة." },
];

const PACKAGES = [
  {
    id: "basic",
    name: "الباقة الأساسية",
    emoji: "🚀",
    price: "4,500",
    old: "8,500",
    off: "47%",
    period: "لمدة 3 شهور",
    featured: false,
    items: [
      "12 منشورًا شهريًا",
      "استراتيجية تسويقية احترافية",
      "3 حملات إعلانية (الميزانية منفصلة)",
      "تحليل السوق والمنافسين",
      "تصاميم إبداعية",
      "تحسين محركات البحث (SEO)",
      "كتابة المحتوى",
      "فيديوهين لسوشيال ميديا",
      "تقرير شهري مبسّط",
    ],
  },
  {
    id: "launch",
    name: "باقة الانطلاق",
    emoji: "⚡",
    price: "12,000",
    old: "16,000",
    off: "25%",
    period: "لمدة 3 شهور",
    featured: true,
    items: [
      "كل مميزات الباقة الأساسية",
      "15 منشورًا شهريًا",
      "5 حملات إعلانية",
      "5 فيديوهات سوشيال ميديا",
      "خدمات SEO موسّعة",
      "التسويق عبر البريد الإلكتروني",
      "استشارات أسبوعية",
      "تقارير شهرية تفصيلية",
    ],
  },
  {
    id: "gold",
    name: "الباقة الذهبية",
    emoji: "👑",
    price: "18,000",
    old: "25,000",
    off: "28%",
    period: "شهرين + شهر مجانًا",
    featured: false,
    items: [
      "كل مميزات الباقات السابقة",
      "إدارة وتطوير الموقع الإلكتروني",
      "30 منشورًا شهريًا",
      "تصاميم متقدّمة",
      "10 فيديوهات ترويجية",
      "إدارة حملات إعلانية بلا حدود",
      "SEO متقدّم",
      "حساب إعلاني مخصّص",
    ],
  },
];

const WA = "966576913063";

export default function OjiAgency() {
  const router = useRouter();
  return (
    <>
      <main className="min-h-screen max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-12">
        <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition mb-8">← الرئيسية</button>

        {/* Hero */}
        <div className="text-center mb-12 oji-up">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#f59e0b] to-[#f43f5e] flex items-center justify-center text-5xl sm:text-6xl oji-float shadow-2xl">🏢</div>
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full oji-glass text-[var(--oji-muted)] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" /> المؤسسة الأم
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">
            <span className="oji-gradient-text">Oji Agency</span>
          </h1>
          <p className="text-[var(--oji-muted)] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            وكالة تسويق رقمي متكاملة بخبرة تتجاوز <span className="text-white font-bold">4 سنوات</span> — نبني علامات تجارية قوية تسيطر على السوق وتحقّق أرباحًا حقيقية. شريكك الاستراتيجي لبناء هوية واضحة، وفهم عميلك، وصناعة محتوى تسويقي يدفعه لقرار الشراء بثقة.
          </p>
          <p className="text-sm text-[var(--oji-muted)] mt-4 max-w-2xl mx-auto">
            ومن <span className="text-white font-bold">Oji Agency</span> تتفرّع أنظمتنا الرقمية: <span className="text-white font-bold">oji builder</span> لبناء المواقع والتطبيقات بالذكاء الاصطناعي، و<span className="text-white font-bold">oji brain</span> لأدوات الذكاء الاصطناعي المتكاملة.
          </p>
        </div>

        {/* Services */}
        <div className="oji-reveal grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {SERVICES.map((s) => (
            <div key={s.title} className="oji-glass rounded-2xl p-5 text-center sm:text-right">
              <div className="text-3xl mb-3">{s.emoji}</div>
              <div className="font-bold mb-1">{s.title}</div>
              <div className="text-sm text-[var(--oji-muted)]">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Packages */}
        <div className="oji-reveal mb-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">باقات التسويق الإلكتروني</h2>
          <p className="text-sm text-[var(--oji-muted)]">اختر الباقة المناسبة لمشروعك — والأسعار بالريال السعودي.</p>
        </div>

        <div className="oji-reveal grid grid-cols-1 lg:grid-cols-3 gap-5 mb-14 items-start">
          {PACKAGES.map((p) => (
            <div
              key={p.id}
              className={`relative rounded-3xl p-[1px] ${p.featured ? "bg-gradient-to-b from-[#f59e0b] to-[#f43f5e] lg:-mt-3" : "bg-[var(--oji-border)]"}`}
            >
              {p.featured && (
                <span className="absolute -top-3 right-1/2 translate-x-1/2 z-10 px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-l from-[#f59e0b] to-[#f43f5e] text-[#06121f] whitespace-nowrap">
                  الأكثر طلبًا
                </span>
              )}
              <div className="h-full rounded-3xl bg-[var(--oji-surface)] p-6 flex flex-col">
                <div className="text-center mb-5">
                  <div className="text-3xl mb-2">{p.emoji}</div>
                  <h3 className="font-extrabold text-lg mb-3">{p.name}</h3>
                  <div className="flex items-end justify-center gap-2">
                    <span className="text-3xl font-extrabold">{p.price}</span>
                    <span className="text-sm text-[var(--oji-muted)] mb-1">ر.س</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-sm text-[var(--oji-muted)] line-through">{p.old}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f43f5e]/15 text-[#f43f5e]">خصم {p.off}</span>
                  </div>
                  <div className="text-xs text-[var(--oji-muted)] mt-2">{p.period}</div>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm">
                      <span className="text-[var(--oji-primary)] shrink-0 mt-0.5">✓</span>
                      <span className="text-[var(--oji-muted)]">{it}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={`https://wa.me/${WA}?text=${encodeURIComponent(`مرحبًا Oji Agency 👋\nمهتم بـ«${p.name}» (${p.price} ر.س - ${p.period}).\nياريت تفاصيل أكثر.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block text-center py-3 rounded-xl font-extrabold transition hover:scale-[1.02] ${
                    p.featured
                      ? "bg-gradient-to-l from-[#f59e0b] to-[#f43f5e] text-[#06121f]"
                      : "border border-[var(--oji-border)] hover:border-[#f59e0b]"
                  }`}
                >
                  اطلب الباقة
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="oji-reveal text-center">
          <a
            href={AGENCY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-extrabold text-[#06121f] bg-gradient-to-l from-[#f59e0b] to-[#f43f5e] hover:scale-105 transition shadow-2xl"
          >
            زُر موقع Oji Agency ↗
          </a>
          <p className="text-xs text-[var(--oji-muted)] mt-4">
            أو تواصل مباشرة عبر واتساب:{" "}
            <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="hover:text-[#25D366] transition">
              +{WA}
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
