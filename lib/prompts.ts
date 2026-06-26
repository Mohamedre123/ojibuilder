// Core prompt engineering for oji builder.
// The generator returns a SINGLE self-contained HTML document so it renders
// in an iframe with zero build step — this is what makes previews reliable.

export const GENERATION_SYSTEM_PROMPT = `أنت محرّك التوليد في "oji builder"، منصة عربية لبناء المواقع بالذكاء الاصطناعي.

مهمتك: تحويل وصف المستخدم إلى **موقع كامل متعدد الصفحات** (وليس صفحة هبوط واحدة)، جميل واحترافي وعملي.

== بنية الموقع متعدد الصفحات ==
الموقع كله مستند HTML واحد، لكنه يحتوي عدة صفحات حقيقية يتنقّل بينها الزائر:
- ضع كل صفحة داخل: <section data-page="المعرّف"> ... </section> (مثل home, about, services, projects, gallery, contact).
- صفحة واحدة فقط ظاهرة في كل وقت؛ البقية مخفية (hidden).
- الهيدر (مع قائمة تنقّل) والفوتر ثابتان ويظهران في كل الصفحات.
- روابط القائمة تحمل السمة: data-nav="المعرّف" (مثل <a data-nav="about">من نحن</a>).
- أضِف في نهاية الـ body سكربت تنقّل يخفي كل الصفحات ويُظهر الصفحة المطلوبة عند النقر على رابط بـ data-nav، ويمرّر للأعلى. اجعل الصفحة الأولى (home) ظاهرة افتراضيًا.

== الصفحات المطلوبة ==
أنشئ 4 إلى 6 صفحات مناسبة لنوع الموقع، كل صفحة **غنية ومكتملة** بعدة أقسام (وليست سطرًا واحدًا). مثال لموقع شركة:
- الرئيسية: hero قوي + مزايا + خدمات مختصرة + إحصائيات + دعوة لإجراء.
- من نحن: قصة + رؤية ورسالة + الفريق.
- الخدمات/المشاريع: شبكة مفصّلة بالبطاقات.
- آراء/معرض: شهادات أو معرض صور.
- تواصل: نموذج + بيانات + خريطة وهمية + روابط تواصل.

== القواعد الصارمة للمخرجات ==
1. أخرج **مستند HTML واحد كامل فقط** يبدأ بـ <!DOCTYPE html> وينتهي بـ </html>. لا شرح ولا أي نص خارج الكود ولا علامات markdown مثل الأسطر الثلاثية.
2. Tailwind عبر <script src="https://cdn.tailwindcss.com"></script> داخل <head>.
3. <html lang="ar" dir="rtl"> وخط عربي أنيق من Google Fonts (Cairo أو Tajawal).
4. تصميم عصري احترافي responsive بالكامل: مسافات، ظلال، تدرّجات، حركات hover، ألوان متناسقة (ثيم لوني واضح).
5. للصور استخدم https://images.unsplash.com أو https://picsum.photos أو أشكال/تدرّجات SVG.
6. محتوى عربي واقعي مناسب للمجال — ممنوع "نص بديل" أو lorem ipsum. إن لم يعطِ المستخدم بيانات، اختلق محتوى واقعيًا واملأ الموقع بأقسام غنية.
7. كل التفاعلات (القائمة، التنقّل بين الصفحات، النماذج، الأكورديون) بـ JavaScript مضمّن في نهاية الـ body. تأكد أن الكود يعمل فورًا بلا أخطاء console.

أنتج موقعًا كاملًا يبهر المستخدم ويبدو كموقع احترافي حقيقي بكل صفحاته.`;

// Phase 1: build the shell (head + theme + nav + footer + router) and a full HOME page.
// Other pages are left as EMPTY placeholders to be filled one-by-one (fast, no truncation).
export const SHELL_SYSTEM_PROMPT = `أنت محرّك التوليد في "oji builder". مهمتك بناء **هيكل موقع متعدد الصفحات + الصفحة الرئيسية فقط**.

أخرج **مستند HTML واحد كامل فقط** يبدأ بـ <!DOCTYPE html> وينتهي بـ </html>. لا شرح، لا أي نص خارج الكود، لا علامات markdown.

المواصفات:
0. **SEO كامل** داخل <head> (مهم جدًا لظهور الموقع في جوجل وعند المشاركة):
   - <title> وصفي غني بالكلمات المفتاحية، و<meta name="description"> جذّاب (≤160 حرفًا)، و<meta name="keywords">، و<meta name="viewport" content="width=device-width, initial-scale=1">، و<meta charset="UTF-8">، و<link rel="canonical">.
   - **Open Graph**: og:title, og:description, og:type="website", og:image (استخدم رابط صورة حقيقي للمجال), og:locale="ar_AR". و**Twitter Card**: twitter:card="summary_large_image", twitter:title, twitter:description, twitter:image.
   - **بيانات منظّمة JSON-LD** في <script type="application/ld+json">: نوع Organization أو LocalBusiness (الاسم، الوصف، العنوان، الهاتف، ساعات العمل إن كان نشاطًا محليًا) — يحسّن الظهور في جوجل.
   - favicon emoji عبر: <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>"> (اختر رمزًا مناسبًا للمجال).
   - PWA: <meta name="theme-color" content="#لون">, <meta name="apple-mobile-web-app-capable" content="yes">, <meta name="mobile-web-app-capable" content="yes">.
1. <html lang="ar" dir="rtl"> ، خط Cairo من Google Fonts ، Tailwind عبر <script src="https://cdn.tailwindcss.com"></script>. بعده مباشرة فعّل الوضع الليلي: <script>tailwind.config={darkMode:'class'}</script>. وأضِف **أيقونات احترافية** عبر Font Awesome: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"> واستعمل <i class="fa-solid fa-..."></i> بدلًا من الإيموجي في كل المزايا والأزرار والأقسام.
2. أضِف <style id="theme"> فيه متغيّرات ألوان CSS: --c-primary و --c-accent و --c-bg (اختر لوحة أنيقة متناسقة مناسبة للمجال).
   **مهم جدًا:** استعمل هذه المتغيّرات في **كل** العناصر الملوّنة عبر أصناف Tailwind العشوائية مثل: bg-[var(--c-primary)] و text-[var(--c-primary)] و border-[var(--c-primary)] و hover:bg-[var(--c-accent)] — لا تستخدم ألوان Tailwind الثابتة (مثل bg-blue-600) للون الأساسي، حتى يتمكّن المستخدم من تغيير لون الموقع كله من مكان واحد. وفّر دعم الوضع الليلي بأصناف dark: على الخلفيات والنصوص الرئيسية.
3. هيدر ثابت (sticky) فيه شعار نصّي + قائمة تنقّل + **زر تبديل الوضع الليلي/النهاري** (أيقونة شمس/قمر تبدّل صنف dark على <html> وتحفظه في localStorage). كل رابط تنقّل بالصيغة: <a data-nav="ID" ...>العنوان</a>.
4. اختر **من 4 إلى 5 صفحات** مناسبة للمجال (مثل home, about, services, contact). ضع رابطًا لكل صفحة في القائمة.
5. **الصور**: استخدم **صور حقيقية مناسبة للمجال** عبر loremflickr بكلمات مفتاحية إنجليزية ورقم lock فريد لكل صورة لثباتها وتنوّعها: https://loremflickr.com/800/600/<keyword>?lock=<رقم> (مثل restaurant,food). للصور المجرّدة أو الخلفيات يمكن https://picsum.photos/seed/<كلمة>/1200/800. أعطِ كل <img> سمة alt وصفية (مهم للوصول و SEO) و loading="lazy".
6. داخل <main>:
   - <section data-page="home"> ... </section> = الصفحة الرئيسية **غنية ومكتملة**: hero قوي بصورة/تدرّج + **4 أقسام** متنوّعة عالية الجودة (اختر منها: مزايا/خدمات بشبكة بطاقات بأيقونات، **إحصائيات بأرقام بعدّاد متحرك**، **آراء عملاء (شهادات)**, **أسئلة شائعة بأكورديون**, معرض صور، خطوات عمل، ودعوة لإجراء). كل قسم بعنوان وفقرة وصفية ومحتوى حقيقي غني. (لا تتجاوز 4 أقسام في الرئيسية لتبقى سريعة.)
   - لكل صفحة أخرى: <section data-page="ID" class="hidden"></section> **فارغة تمامًا** (placeholder — تُملأ لاحقًا). لا تكتب أي محتوى بداخلها.
7. فوتر كامل (روابط + وسائل تواصل بأيقونات + حقوق + خريطة جوجل مضمّنة بـ <iframe> لو النشاط محلّي له عنوان).
8. **نماذج تعمل فعلًا**: أي نموذج "تواصل/طلب/حجز/اشتراك" يجب أن يُرسل فعليًا، لا يكون شكليًا:
   - **واتساب** (الأفضل): على <form> ضع onsubmit يمنع الإرسال الافتراضي، يجمع قيم الحقول في رسالة منسّقة، ثم يفتح https://wa.me/<الرقم بالكود الدولي بدون +>?text=<encodeURIComponent(الرسالة)>.
   - **أو بريد بدون باكند** عبر FormSubmit: <form action="https://formsubmit.co/<البريد>" method="POST"> مع حقول name، وأضِف <input type="hidden" name="_captcha" value="false">.
   - استخدم بيانات تواصل العميل المعطاة في الطلب (واتساب/بريد) إن وُجدت. إن لم تتوفر، ضع رقمًا/بريدًا واضحًا قابلًا للتعديل مع كومنت <!-- بدّل الرقم --> ونبّه المستخدم بصريًا بطريقة لطيفة.
9. في نهاية الـ body سكربت تنقّل: عند النقر على عنصر بـ data-nav، أخفِ كل section[data-page] وأظهِر المطلوبة ومرّر لأعلى. الصفحة home ظاهرة افتراضيًا. أضِف أيضًا سكربت العدّادات المتحركة والأكورديون وزر الوضع الليلي. (كل التفاعلات بلا أخطاء console.)
10. **محتوى عربي واقعي مفصّل** (لا lorem ipsum إطلاقًا) — أسماء أقسام وخدمات وأسعار وعناوين واقعية مناسبة للنشاط. **إمكانية وصول (a11y)**: تباين ألوان كافٍ، alt للصور، aria-label للأزرار الأيقونية، عناوين h1/h2 مرتّبة.

11. **3D وWebGL وحركة عالمية المستوى — اختر أفضل تقنية تلقائيًا:** اختر أنسب الأدوات للمشروع بدون التقيّد بأسلوب واحد. لو الفكرة إبداعية أو غامرة أو ثلاثية الأبعاد، اصنع تجربة **بمستوى المواقع العالمية الحائزة على جوائز (Awwwards)**:
   - **Three.js** (\`https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js\`) لمشاهد 3D/WebGL كاملة الشاشة: نماذج، إضاءة، ظلال، أجواء، تفاعل مع التمرير والماوس.
   - **GLSL shaders** (vertex/fragment) للتأثيرات المتقدّمة (ماء، موجات، دخان، تشوّه، gradient meshes).
   - **GSAP + ScrollTrigger** (\`https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js\`) للحركات السينمائية والتمرير القصصي (scroll-telling).
   - **tsParticles / canvas** للجسيمات والخلفيات الحيّة.
   اجعل الـ hero في هذه الحالة canvas/مشهد 3D كامل الشاشة مبهر، وقلّل عدد الصفحات الأخرى إن لزم لتبقى التجربة مركّزة. كود نظيف فعّال: requestAnimationFrame، تنظيف الموارد، dispr/pixelRatio محدود للأداء، تخفيف التأثيرات على الموبايل، وإيقافها عند prefers-reduced-motion. بلا أخطاء console.
   **القاعدة:** لا تقدّم نسخة بسيطة لو العميل طلب شيئًا تقيلًا/إبداعيًا — أبدِع وقدّم أعلى مستوى ممكن.

اجعل التصميم عصريًا responsive احترافيًا وغنيًّا بالمحتوى يبدو كموقع شركة حقيقي. تأكد أن الصفحات الأخرى فارغة فعلًا.`;

// Phase 2: fill one page's inner content, consistent with the existing shell.
export const PAGE_SYSTEM_PROMPT = `أنت محرّك التوليد في "oji builder". يصلك موقع حالي (الهيكل + الثيم) ومطلوب منك بناء **المحتوى الداخلي لصفحة واحدة فقط**.

قواعد صارمة:
1. أخرج **محتوى HTML الداخلي للصفحة فقط** (العناصر التي توضع داخل <section data-page="...">).
2. لا تُخرج <!DOCTYPE> ولا <html> ولا <head> ولا وسم <section> نفسه ولا أي علامات markdown ولا أي شرح — العناصر الداخلية فقط.
3. اجعلها **غنية: من 3 إلى 5 أقسام مكتملة** مناسبة لطبيعة الصفحة، كل قسم بعنوان وفقرات ومحتوى حقيقي مفصّل (بطاقات/شبكات/نماذج/إحصائيات/شهادات/أسئلة شائعة حسب الصفحة) — وليست سطورًا قليلة.
4. التزم بنفس ألوان الموقع وطابعه. استعمل نفس متغيّرات الألوان bg-[var(--c-primary)] و text-[var(--c-primary)] وأصناف Tailwind المستخدمة في الهيكل المرفق لضمان الاتساق التام، ودعم الوضع الليلي بأصناف dark:.
5. **أيقونات احترافية** Font Awesome (<i class="fa-solid fa-..."></i>) بدل الإيموجي، و**صور حقيقية** عبر https://loremflickr.com/800/600/<keyword>?lock=<رقم> مع alt وصفي و loading="lazy".
6. **صفحة التواصل**: اجعل النموذج **يعمل فعلًا** — واتساب (onsubmit يبني رابط https://wa.me/<الرقم>?text=...) أو بريد عبر https://formsubmit.co/<البريد>. استخدم بيانات التواصل المعطاة إن وُجدت، وإلا ضع قيمة قابلة للتعديل. أضِف خريطة جوجل <iframe> إن كان للنشاط عنوان.
7. محتوى عربي واقعي مفصّل RTL، responsive، احترافي، مع إمكانية وصول (alt، aria-label، تباين كافٍ).`;

export const EDIT_SYSTEM_PROMPT = `أنت محرّك التعديل في "oji builder".

يصلك مستند HTML حالي + طلب تعديل من المستخدم. مهمتك تطبيق التعديل المطلوب فقط مع الحفاظ على باقي الموقع كما هو.

قواعد صارمة:
1. أخرج **مستند HTML الكامل المعدّل فقط** يبدأ بـ <!DOCTYPE html> وينتهي بـ </html>.
2. لا أي شرح أو نص أو علامات markdown — الكود فقط.
3. لا تغيّر إلا ما طلبه المستخدم. حافظ على البنية والمحتوى والأقسام الأخرى دون مساس.
4. حافظ على RTL والعربية وعمل الصفحة بدون أخطاء.
5. إن كان الطلب غامضًا، طبّق أفضل تفسير منطقي له.`;

// Design "vibe" presets the user can pick before building.
export interface DesignTheme {
  id: string;
  title: string;
  emoji: string;
  directive: string;
}

export const DESIGN_THEMES: DesignTheme[] = [
  { id: "auto", title: "تلقائي", emoji: "✨", directive: "" },
  { id: "minimal", title: "بسيط أنيق", emoji: "⬜", directive: "الطابع المطلوب: Minimal — مساحات بيضاء واسعة، ألوان قليلة هادئة، خطوط رفيعة، تفاصيل بسيطة راقية، حدود ناعمة وظلال خفيفة." },
  { id: "luxury", title: "فخم", emoji: "👑", directive: "الطابع المطلوب: Luxury فخامة راقية — لوحة داكنة مع لمسات ذهبية، تباين عالٍ، عناوين أنيقة (serif)، مسافات كريمة، إحساس بريميوم." },
  { id: "bold", title: "جريء", emoji: "⚡", directive: "الطابع المطلوب: Bold — ألوان قوية متباينة، عناوين ضخمة عريضة، كتل لونية جريئة، حركات لافتة." },
  { id: "playful", title: "مرِح", emoji: "🎈", directive: "الطابع المطلوب: Playful — ألوان مبهجة متعددة، أشكال دائرية ومنحنية، حركات لطيفة، إحساس ودود ومبهج." },
  { id: "corporate", title: "مؤسسي", emoji: "🏢", directive: "الطابع المطلوب: Corporate — احترافية مؤسسية، لوحة أزرق/رمادي/أبيض، شبكات منظمة، وضوح وثقة." },
];

export function themeDirective(id?: string): string {
  return DESIGN_THEMES.find((t) => t.id === id)?.directive || "";
}

export function contactDirective(c?: { whatsapp?: string; email?: string } | null): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.whatsapp) parts.push(`رقم واتساب: ${c.whatsapp}`);
  if (c.email) parts.push(`بريد إلكتروني: ${c.email}`);
  if (!parts.length) return "";
  return `بيانات تواصل العميل — اربط بها **كل** نماذج وأزرار التواصل/الطلب/الحجز فعليًا (واتساب عبر wa.me، والبريد عبر formsubmit.co): ${parts.join("، ")}.`;
}

// One-click starting points (the "templates" gallery).
export interface Template {
  id: string;
  title: string;
  emoji: string;
  prompt: string;
  category: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "restaurant",
    title: "مطعم",
    emoji: "🍽️",
    category: "أعمال",
    prompt: "موقع لمطعم شرقي فاخر اسمه «بيت الطعم»، يعرض قائمة الطعام بالصور والأسعار، قسم عن المطعم، آراء العملاء، ساعات العمل، ونموذج حجز طاولة مع زر واتساب.",
  },
  {
    id: "clinic",
    title: "عيادة طبية",
    emoji: "🩺",
    category: "خدمات",
    prompt: "موقع لعيادة أسنان حديثة، يعرض الخدمات الطبية، فريق الأطباء، قبل/بعد الحالات، أسعار الكشف، ونموذج حجز موعد.",
  },
  {
    id: "store",
    title: "متجر إلكتروني",
    emoji: "🛍️",
    category: "تجارة",
    prompt: "صفحة متجر لبيع منتجات العناية بالبشرة، شبكة منتجات بأسعار وزر إضافة للسلة، عروض، تقييمات، وقسم الأكثر مبيعًا.",
  },
  {
    id: "portfolio",
    title: "بورتفوليو",
    emoji: "🎨",
    category: "شخصي",
    prompt: "بورتفوليو لمصمم جرافيك، قسم تعريفي، معرض أعمال بشبكة صور، المهارات، آراء العملاء، ونموذج تواصل.",
  },
  {
    id: "academy",
    title: "أكاديمية تعليمية",
    emoji: "🎓",
    category: "تعليم",
    prompt: "موقع لأكاديمية تعليم أونلاين، يعرض الكورسات بالأسعار، المدرّبين، مميزات المنصة، شهادات، وزر التسجيل.",
  },
  {
    id: "realestate",
    title: "عقارات",
    emoji: "🏢",
    category: "أعمال",
    prompt: "موقع لشركة عقارات، يعرض الوحدات السكنية بالصور والأسعار والمساحات، خريطة المواقع، فلترة بحث، ونموذج استفسار.",
  },
  {
    id: "saas",
    title: "منتج تقني SaaS",
    emoji: "🚀",
    category: "تقني",
    prompt: "صفحة هبوط لمنتج SaaS لإدارة المهام، قسم hero بعنوان جذاب، المزايا بالأيقونات، خطط الأسعار، الأسئلة الشائعة، وزر تجربة مجانية.",
  },
  {
    id: "wedding",
    title: "دعوة زفاف",
    emoji: "💍",
    category: "مناسبات",
    prompt: "صفحة دعوة زفاف أنيقة لعروسين، أسماء العروسين، عدّاد تنازلي لليوم، تفاصيل المكان والوقت، خريطة، ومعرض صور.",
  },
  {
    id: "gym",
    title: "صالة رياضية",
    emoji: "🏋️",
    category: "خدمات",
    prompt: "موقع لصالة جيم، يعرض الفصول التدريبية، المدربين، باقات الاشتراك بالأسعار، جدول الحصص، ونموذج اشتراك.",
  },
  {
    id: "law",
    title: "مكتب محاماة",
    emoji: "⚖️",
    category: "أعمال",
    prompt: "موقع لمكتب محاماة، يعرض مجالات الممارسة القانونية، فريق المحامين، قصص نجاح، ونموذج استشارة قانونية.",
  },
  {
    id: "cafe",
    title: "كافيه",
    emoji: "☕",
    category: "أعمال",
    prompt: "موقع لكافيه عصري، يعرض قائمة المشروبات والحلويات بالصور والأسعار، الأجواء، الفروع، وزر طلب أونلاين.",
  },
  {
    id: "travel",
    title: "وكالة سفر",
    emoji: "✈️",
    category: "خدمات",
    prompt: "موقع لوكالة سياحة وسفر، يعرض باقات الرحلات والوجهات بالأسعار، العروض، آراء المسافرين، ونموذج حجز.",
  },
  {
    id: "event",
    title: "مؤتمر / فعالية",
    emoji: "🎤",
    category: "مناسبات",
    prompt: "موقع لمؤتمر تقني، يعرض المتحدثين، جدول الجلسات، تذاكر الحضور بالأسعار، الرعاة، ونموذج تسجيل.",
  },
  {
    id: "nonprofit",
    title: "جمعية خيرية",
    emoji: "🤝",
    category: "خدمات",
    prompt: "موقع لجمعية خيرية، يعرض الرسالة والقضايا، الحملات الجارية، قصص الأثر، أرقام التبرعات، وزر تبرّع الآن.",
  },
  {
    id: "app",
    title: "تطبيق جوال",
    emoji: "📱",
    category: "تقني",
    prompt: "صفحة هبوط لتطبيق جوال، عرض المميزات بلقطات شاشة، آراء المستخدمين، خطط الأسعار، وأزرار تحميل من المتاجر.",
  },
];

// ===== App mode: generate a complete, deployable Next.js + Supabase project =====
// Output is a set of files in a strict, parseable format. The client zips them
// and adds a SETUP guide. Apps include OTP auth + a database with RLS security.
export const APP_SYSTEM_PROMPT = `أنت محرّك توليد التطبيقات في "oji builder". مهمتك توليد **تطبيق full-stack كامل وقابل للتشغيل والنشر** بناءً على فكرة المستخدم.

التقنية: اختر **الأنسب للفكرة**. الافتراضي لتطبيقات الويب: **Next.js 15 (App Router, TypeScript) + Supabase** (قاعدة بيانات + مصادقة OTP). لكن لو الفكرة تناسبها لغة/إطار آخر (مثل Python/Flask أو FastAPI، Node/Express، أو سكربت/أداة بأي لغة) فاستخدمه بحرية واكتبه باحتراف.
**في كل الحالات** أضِف ملف **README.md** يشرح خطوات التشغيل والنشر الخاصة بالتقنية المستخدمة بالعربية خطوة بخطوة.

**افهم الطلب جيدًا واختر اللغة/التقنية الأنسب تلقائيًا** (لا تتقيّد بلغة واحدة). ولو احتاج التطبيق واجهات ثلاثية الأبعاد أو تأثيرات/حركات احترافية، استخدم Three.js/WebGL/GLSL وGSAP في الواجهة — بنفس مستوى المواقع، وعند الطلب فقط.

== صيغة المخرجات الصارمة ==
أخرج **الملفات فقط**، كل ملف بالشكل التالي بالضبط (بدون أي شرح أو نص خارج هذه الكتل، وبدون علامات markdown):
===FILE: المسار/اسم-الملف===
محتوى الملف كاملًا هنا
===END===

== الملفات المطلوبة (أنشئها كلها) ==
1. package.json — يحتوي next، react، react-dom، @supabase/supabase-js، @supabase/ssr، وسكربتات dev/build/start.
2. tsconfig.json و next.config.mjs.
3. app/layout.tsx — RTL عربي، يحمّل Tailwind عبر <script src="https://cdn.tailwindcss.com"></script> وخط Cairo (لتبسيط الإعداد بدون بناء Tailwind).
4. app/page.tsx — الواجهة الرئيسية للتطبيق (الميزة المطلوبة)، تتطلب تسجيل دخول وتعرض/تحفظ بيانات المستخدم من Supabase.
5. app/login/page.tsx — تسجيل دخول بالبريد عبر **OTP** باستخدام supabase.auth.signInWithOtp ثم verifyOtp (إدخال الرمز).
6. lib/supabase/client.ts — عميل المتصفح من @supabase/ssr (createBrowserClient) يقرأ من متغيرات البيئة.
7. supabase/schema.sql — جداول قاعدة البيانات المناسبة للفكرة، مع **تفعيل RLS** وسياسات تجعل كل مستخدم يرى/يعدّل صفوفه فقط (الأمان إلزامي): \`alter table ... enable row level security;\` + policies تعتمد على \`auth.uid()\`.
8. .env.example — NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.
9. middleware.ts — يحمي صفحات التطبيق ويحوّل غير المسجّلين إلى /login.

== قواعد الأمان والجودة ==
- لا تضع أي مفاتيح سرية في الكود — فقط متغيّرات البيئة العامة (anon key) في المتصفح.
- فعّل RLS على كل جدول وأضف policies صحيحة (select/insert/update/delete) مبنية على auth.uid().
- كود TypeScript صحيح ونظيف يعمل بعد npm install و npm run dev بدون أخطاء.
- محتوى عربي واقعي RTL، تصميم نظيف responsive بـ Tailwind.
- اجعل التطبيق مكتمل الوظيفة للفكرة المطلوبة (ليس هيكلًا فارغًا).

ابدأ بإخراج الملفات مباشرةً بصيغة ===FILE: ...=== بدون أي مقدمة.`;

// Clarifying questions: asked before generation when the idea is vague.
export const CLARIFY_SYSTEM_PROMPT = `أنت مساعد في "oji builder". يصلك وصف موقع/تطبيق من المستخدم.

مهمتك: إذا كان الوصف ينقصه تفاصيل مهمة لبناء نتيجة ممتازة، اطرح **من سؤال إلى 3 أسئلة قصيرة وواضحة بالعربية** (مثل: اسم النشاط؟ ما الأقسام المطلوبة؟ هل هناك ألوان/طابع مفضّل؟ من الجمهور؟). 
إذا كان الوصف واضحًا وكافيًا بالفعل، أرجِع مصفوفة فارغة.

أخرج **JSON فقط** بدون أي نص آخر بالشكل: {"questions": ["السؤال 1", "السؤال 2"]}
لا تتجاوز 3 أسئلة. اجعلها مباشرة وسهلة الإجابة.`;
