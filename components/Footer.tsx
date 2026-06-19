const CONTACTS = [
  { label: "رقم الهاتف", num: "+201200026457", emoji: "📞" },
  { label: "رقم الشكاوى", num: "+201200922780", emoji: "📝" },
  { label: "خدمة العملاء", num: "+966576913063", emoji: "🎧" },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--oji-border)] mt-12">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-6">
          <h3 className="text-xl font-extrabold mb-1">تواصل معنا</h3>
          <p className="text-sm text-[var(--oji-muted)] max-w-xl mx-auto">
            فريق <span className="font-bold text-white">oji builder</span> في خدمتك — لأي استفسار أو دعم فني أو شكوى، اختر الوسيلة الأنسب لك وسنرد عليك بأسرع وقت.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CONTACTS.map((c) => (
            <div key={c.num} className="oji-glass rounded-2xl p-4 text-center">
              <div className="text-2xl mb-2">{c.emoji}</div>
              <div className="text-xs text-[var(--oji-muted)] mb-2">{c.label}</div>
              <a href={`tel:${c.num}`} dir="ltr" className="block font-extrabold text-base hover:text-[var(--oji-primary)] transition">{c.num}</a>
              <a
                href={`https://wa.me/${c.num.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs px-3 py-1 rounded-full border border-[var(--oji-border)] hover:border-[#25D366] hover:text-[#25D366] transition"
              >
                واتساب
              </a>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-[var(--oji-muted)] mt-8">
          © {new Date().getFullYear()} oji builder — جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  );
}
