"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MODELS, DEFAULT_MODEL, estimateCost } from "@/lib/models";
import { useUser } from "@/lib/supabase/useUser";
import { getSupabase } from "@/lib/supabase/client";
import VoiceButton from "@/components/VoiceButton";
import GithubButton from "@/components/GithubButton";
import { ghPush, ghStore } from "@/lib/github";

interface ChatMsg {
  role: "user" | "system";
  text: string;
}
interface Selected {
  tag: string;
  html: string;
  key?: string;
}
interface ImageSeed {
  data: string;
  mediaType: string;
}
type Tab = "preview" | "code";
type LastReq = { kind: "site" } | { kind: "edit"; instruction: string };

// ---- helpers ---------------------------------------------------------------

function readUsage(raw: string): { inT: number; outT: number } {
  const m = raw.match(/<!--OJI_USAGE:(\d+),(\d+)-->/);
  return m ? { inT: parseInt(m[1], 10), outT: parseInt(m[2], 10) } : { inT: 0, outT: 0 };
}

function cleanHtml(raw: string): string {
  let out = raw.replace(/<!--OJI_(ERROR|USAGE):[\s\S]*?-->/g, "");
  out = out.replace(/```html\s*/gi, "").replace(/```/g, "");
  const i = out.search(/<!doctype html/i);
  if (i > 0) out = out.slice(i);
  out = out
    .replace(/<style id="__oji_edit">[\s\S]*?<\/style>/g, "")
    .replace(/<script id="__oji_edit_js">[\s\S]*?<\/script>/g, "");
  return out;
}

function cleanInner(raw: string): string {
  let o = raw
    .replace(/<!--OJI_(ERROR|USAGE):[\s\S]*?-->/g, "")
    .replace(/```html\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const m = o.match(/^<section[^>]*\bdata-page\b[^>]*>([\s\S]*)<\/section>\s*$/i);
  if (m) o = m[1].trim();
  return o.trim();
}

function parsePages(fullHtml: string): { id: string; title: string }[] {
  const doc = new DOMParser().parseFromString(fullHtml, "text/html");
  const seen = new Set<string>();
  const pages: { id: string; title: string }[] = [];
  doc.querySelectorAll("[data-nav]").forEach((a) => {
    const id = a.getAttribute("data-nav");
    if (!id || seen.has(id)) return;
    seen.add(id);
    pages.push({ id, title: (a.textContent || id).trim() });
  });
  return pages;
}

function isSectionEmpty(fullHtml: string, id: string): boolean {
  const doc = new DOMParser().parseFromString(fullHtml, "text/html");
  const s = doc.querySelector(`[data-page="${CSS.escape(id)}"]`);
  return s ? s.innerHTML.trim().length < 80 : false;
}

function injectPage(fullHtml: string, id: string, inner: string): string {
  const doc = new DOMParser().parseFromString(fullHtml, "text/html");
  const s = doc.querySelector(`[data-page="${CSS.escape(id)}"]`);
  if (s) s.innerHTML = inner;
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

// Instantly recolor the theme by rewriting the CSS variable in <style id="theme">.
function applyPrimaryColor(fullHtml: string, color: string): string {
  if (/--c-primary\s*:/.test(fullHtml)) {
    return fullHtml.replace(/(--c-primary\s*:\s*)[^;]+/g, `$1${color}`);
  }
  return fullHtml;
}

const EDITOR_RUNTIME = `
<style id="__oji_edit">
  .__oji_hl{ outline:2px dashed #14b8a6 !important; outline-offset:2px; cursor:pointer; }
  .__oji_sel{ outline:2px solid #a78bfa !important; outline-offset:2px; }
  [contenteditable="true"]{ cursor:text; }
  .__oji_add{ position:relative; height:30px; display:flex; align-items:center; justify-content:center; }
  .__oji_add::before{ content:''; position:absolute; left:4%; right:4%; height:2px; background:linear-gradient(90deg,transparent,rgba(124,58,237,.55),transparent); }
  .__oji_addbtn{ position:relative; z-index:9; background:#7c3aed; color:#fff; border:0; border-radius:999px; padding:6px 14px;
    font:700 12px/1 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif; cursor:pointer; opacity:.4;
    box-shadow:0 4px 14px rgba(0,0,0,.35); transition:opacity .15s, transform .15s; white-space:nowrap; }
  .__oji_add:hover .__oji_addbtn{ opacity:1; transform:scale(1.04); }
  @media (max-width:640px){ .__oji_addbtn{ opacity:.9; font-size:11px; padding:5px 11px; } }
</style>
<script id="__oji_edit_js">
(function(){
  var sel=null;
  function isNav(el){ return el && el.closest && el.closest('a,nav,button,[data-nav],[data-page]'); }
  document.addEventListener('mouseover',function(e){ if(e.target&&e.target.classList&&e.target!==document.body) e.target.classList.add('__oji_hl'); },true);
  document.addEventListener('mouseout',function(e){ if(e.target&&e.target.classList) e.target.classList.remove('__oji_hl'); },true);
  document.addEventListener('click',function(e){
    var t=e.target;
    var addb=t&&t.closest&&t.closest('.__oji_addbtn');
    if(addb){ e.preventDefault(); e.stopPropagation(); parent.postMessage({__oji:1,type:'addHere',index:parseInt(addb.getAttribute('data-i'),10)||0},'*'); return; }
    if(isNav(t)){ setTimeout(renderAdders,150); return; }
    e.preventDefault(); e.stopPropagation();
    if(sel){ sel.classList.remove('__oji_sel'); sel.removeAttribute('contenteditable'); }
    sel=t; sel.classList.add('__oji_sel');
    if(sel.tagName!=='IMG'){ sel.setAttribute('contenteditable','true'); sel.focus(); }
    var key=elKey(sel);
    parent.postMessage({__oji:1,type:'select',tag:sel.tagName,key:key,html:sel.outerHTML},'*');
    sync();
  },true);
  document.addEventListener('input',function(){ sync(); },true);
  function clean(node){
    node.querySelectorAll('.__oji_add').forEach(function(x){x.remove();});
    node.querySelectorAll('.__oji_hl').forEach(function(x){x.classList.remove('__oji_hl');});
    node.querySelectorAll('.__oji_sel').forEach(function(x){x.classList.remove('__oji_sel');});
    node.querySelectorAll('[contenteditable]').forEach(function(x){x.removeAttribute('contenteditable');});
    var a=node.querySelector('#__oji_edit'); if(a)a.remove();
    var b=node.querySelector('#__oji_edit_js'); if(b)b.remove();
  }
  function docAttrs(){ var el=document.documentElement,s=''; for(var i=0;i<el.attributes.length;i++){var at=el.attributes[i]; s+=' '+at.name+'="'+at.value+'"';} return s; }
  window.__ojiRules = window.__ojiRules || {};
  (function initRules(){ var s=document.getElementById('__oji_resp'); if(!s)return; var re=/\\[data-oji-el="([^"]+)"\\]\\{([^:]+):([^!]+?) !important\\}/g; var m; while(m=re.exec(s.textContent||'')){ window.__ojiRules[m[1].trim()+'|'+m[2].trim()]={k:m[1].trim(),p:m[2].trim(),v:m[3].trim()}; } })();
  function ensureResp(){ var s=document.getElementById('__oji_resp'); if(!s){ s=document.createElement('style'); s.id='__oji_resp'; document.head.appendChild(s);} return s; }
  function elKey(el){ var k=el.getAttribute('data-oji-el'); if(!k){ k='x'+(window.__ojiK=(window.__ojiK||0)+1); el.setAttribute('data-oji-el',k);} return k; }
  function applyResp(el,prop,val){ var key=elKey(el); window.__ojiRules[key+'|'+prop]={k:key,p:prop,v:val}; var css='@media (max-width:640px){'; for(var id in window.__ojiRules){ var r=window.__ojiRules[id]; css+='[data-oji-el="'+r.k+'"]{'+r.p+':'+r.v+' !important}'; } css+='}'; ensureResp().textContent=css; }
  function sync(){
    var c=document.documentElement.cloneNode(true); clean(c);
    var html='<!DOCTYPE html>\\n<html'+docAttrs()+'>'+c.innerHTML+'</html>';
    parent.postMessage({__oji:1,type:'update',html:html},'*');
  }
  // ---- Shopify-style "+" insertion rails between top-level blocks ----
  function adderHost(){
    var pages=document.querySelectorAll('[data-page]');
    for(var i=0;i<pages.length;i++){ if(pages[i].offsetParent!==null) return pages[i]; }
    return document.querySelector('main')||document.body;
  }
  function realKids(host){ return Array.prototype.filter.call(host.children,function(c){ return !(c.classList&&c.classList.contains('__oji_add')); }); }
  function clearAdders(){ document.querySelectorAll('.__oji_add').forEach(function(x){x.remove();}); }
  function rail(i){
    var d=document.createElement('div'); d.className='__oji_add'; d.setAttribute('contenteditable','false');
    var b=document.createElement('button'); b.type='button'; b.className='__oji_addbtn'; b.setAttribute('data-i',String(i));
    b.textContent='＋ أضف قسم / بلوك / بانر';
    d.appendChild(b); return d;
  }
  function renderAdders(){
    clearAdders();
    var host=adderHost(); if(!host) return;
    var kids=realKids(host); if(!kids.length){ host.appendChild(rail(0)); return; }
    kids.forEach(function(k,i){ host.insertBefore(rail(i),k); });
    host.appendChild(rail(kids.length));
  }
  function insertNodes(index,html,asSlot){
    var host=adderHost(); if(!host) return;
    var kids=realKids(host); var ref=kids[index]||null;
    var nodes;
    if(asSlot){ var s=document.createElement('div'); s.setAttribute('data-oji-slot',''); nodes=[s]; }
    else { var tmp=document.createElement('div'); tmp.innerHTML=html; nodes=Array.prototype.slice.call(tmp.childNodes); }
    nodes.forEach(function(n){ host.insertBefore(n,ref); });
    clearAdders(); sync(); renderAdders();
    if(!asSlot&&nodes[0]&&nodes[0].scrollIntoView){ try{ nodes[0].scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){} }
  }
  renderAdders();
  setInterval(function(){ if(!document.querySelector('.__oji_add')) renderAdders(); },1500);

  window.addEventListener('message',function(ev){
    var d=ev.data||{}; if(!d.__oji)return;
    if(d.type==='insertAt'){ insertNodes(d.index,d.html,false); }
    if(d.type==='insertSlot'){ insertNodes(d.index,'',true); }
    if(d.type==='refreshAdders'){ renderAdders(); }
    if(d.type==='delete'&&sel){ sel.remove(); sel=null; sync(); }
    if(d.type==='replaceImg'&&sel&&sel.tagName==='IMG'){ sel.src=d.url; sync(); }
    if(d.type==='insertImg'){ var img=document.createElement('img'); img.src=d.url; img.alt=''; img.style.maxWidth='100%'; img.style.borderRadius='12px'; (sel||document.body).appendChild(img); sync(); }
    if(d.type==='style'&&sel){ if(d.scope==='phone'){ applyResp(sel,d.prop,d.value); } else { try{ sel.style.setProperty(d.prop, d.value, 'important'); }catch(e){} } sync(); }
    if(d.type==='font'&&sel){ var cur=parseFloat(getComputedStyle(sel).fontSize)||16; var ns=Math.max(8,Math.min(120,cur+d.delta)); if(d.scope==='phone'){ applyResp(sel,'font-size',ns+'px'); } else { sel.style.setProperty('font-size',ns+'px','important'); } sync(); }
    if(d.type==='toggleClass'&&sel){ d.cls.split(' ').forEach(function(c){ if(c) sel.classList.toggle(c); }); sync(); }
    if(d.type==='setLink'&&sel){ var a; if(sel.tagName==='A'){ a=sel; } else { a=document.createElement('a'); sel.parentNode.insertBefore(a,sel); a.appendChild(sel); } a.setAttribute('href',d.href); a.setAttribute('target','_blank'); a.setAttribute('rel','noopener noreferrer'); a.style.textDecoration='none'; a.style.color='inherit'; a.style.cursor='pointer'; sel=a; parent.postMessage({__oji:1,type:'select',tag:a.tagName,html:a.outerHTML},'*'); sync(); }
  });
})();
</script>
`;
function injectEditor(doc: string): string {
  if (doc.includes("</body>")) return doc.replace("</body>", EDITOR_RUNTIME + "</body>");
  return doc + EDITOR_RUNTIME;
}

// Guaranteed page-navigation + smooth-scroll runtime. Injected into the live
// preview and every export so multi-page nav and anchor buttons ALWAYS work,
// regardless of whatever (possibly buggy) script the model produced.
const SITE_RUNTIME = `<script>(function(){
  if(window.__ojiNav)return; window.__ojiNav=1;
  function show(id){
    var secs=document.querySelectorAll('[data-page]'); if(!secs.length)return false; var found=false;
    secs.forEach(function(s){ if(s.getAttribute('data-page')===id){ s.classList.remove('hidden'); s.style.display=''; found=true; } else { s.classList.add('hidden'); s.style.display='none'; } });
    if(found){ try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){window.scrollTo(0,0);} document.querySelectorAll('[data-nav]').forEach(function(n){ n.classList.toggle('active', n.getAttribute('data-nav')===id); }); }
    return found;
  }
  document.addEventListener('click',function(e){
    var n=e.target.closest&&e.target.closest('[data-nav]');
    if(n){ var id=n.getAttribute('data-nav'); if(id&&show(id)){ e.preventDefault(); } return; }
    var a=e.target.closest&&e.target.closest('a[href^="#"]');
    if(a){ var h=a.getAttribute('href').slice(1); if(h){ var sec=document.querySelector('[data-page="'+h+'"]'); if(sec){ if(show(h)) e.preventDefault(); return; } var el=document.getElementById(h); if(el){ e.preventDefault(); try{el.scrollIntoView({behavior:'smooth'});}catch(x){el.scrollIntoView();} } } }
  },true);
  var secs=document.querySelectorAll('[data-page]');
  if(secs.length>1){ var cur=null; for(var i=0;i<secs.length;i++){ if(!secs[i].classList.contains('hidden')&&secs[i].style.display!=='none'){ cur=secs[i].getAttribute('data-page'); break; } } show(cur||secs[0].getAttribute('data-page')); }
})();</script>`;

function withSiteRuntime(doc: string): string {
  if (!doc) return doc;
  if (doc.includes("</body>")) return doc.replace("</body>", SITE_RUNTIME + "</body>");
  return doc + SITE_RUNTIME;
}

// Ready-made sections/blocks the client can drop in without AI. They use the
// site's own CSS color variables so they always match the current theme, and
// are fully responsive (mobile-first grid + fluid type).
const LIB: { id: string; title: string; emoji: string; html: string }[] = [
  {
    id: "strip",
    title: "شريط ترويجي",
    emoji: "🏷️",
    html: `<section class="w-full px-4 py-3 sm:py-4 bg-[var(--c-primary,#0ea5e9)] text-white text-center">
  <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
    <p class="font-bold text-sm sm:text-base m-0">🔥 عرض خاص لفترة محدودة — خصم يصل إلى 40%</p>
    <a href="#" class="shrink-0 bg-white/95 text-[var(--c-primary,#0ea5e9)] font-extrabold text-sm rounded-full px-5 py-2 no-underline">تسوّق الآن</a>
  </div>
</section>`,
  },
  {
    id: "features",
    title: "مزايا (3 بطاقات)",
    emoji: "⭐",
    html: `<section class="w-full px-4 py-12 sm:py-16">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-2xl sm:text-3xl font-extrabold text-center mb-3">لماذا تختارنا؟</h2>
    <p class="text-center opacity-70 mb-10 max-w-2xl mx-auto">نقدّم لك تجربة متكاملة تجمع بين الجودة والسعر المناسب وخدمة تستحق ثقتك.</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <div class="rounded-2xl border border-black/10 p-6 text-center"><div class="text-3xl mb-3">🚚</div><h3 class="font-bold text-lg mb-2">شحن سريع</h3><p class="opacity-70 text-sm m-0">توصيل لكل المحافظات خلال 48 ساعة.</p></div>
      <div class="rounded-2xl border border-black/10 p-6 text-center"><div class="text-3xl mb-3">🛡️</div><h3 class="font-bold text-lg mb-2">ضمان حقيقي</h3><p class="opacity-70 text-sm m-0">ضمان شامل على كل المنتجات لمدة عام.</p></div>
      <div class="rounded-2xl border border-black/10 p-6 text-center"><div class="text-3xl mb-3">💬</div><h3 class="font-bold text-lg mb-2">دعم 24/7</h3><p class="opacity-70 text-sm m-0">فريقنا جاهز للرد على استفسارك في أي وقت.</p></div>
    </div>
  </div>
</section>`,
  },
  {
    id: "stats",
    title: "إحصائيات",
    emoji: "📊",
    html: `<section class="w-full px-4 py-12 sm:py-16 bg-black/5">
  <div class="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
    <div><div class="text-3xl sm:text-4xl font-extrabold text-[var(--c-primary,#0ea5e9)]">+5000</div><p class="opacity-70 text-sm mt-1 m-0">عميل سعيد</p></div>
    <div><div class="text-3xl sm:text-4xl font-extrabold text-[var(--c-primary,#0ea5e9)]">+12</div><p class="opacity-70 text-sm mt-1 m-0">سنة خبرة</p></div>
    <div><div class="text-3xl sm:text-4xl font-extrabold text-[var(--c-primary,#0ea5e9)]">+300</div><p class="opacity-70 text-sm mt-1 m-0">مشروع مكتمل</p></div>
    <div><div class="text-3xl sm:text-4xl font-extrabold text-[var(--c-primary,#0ea5e9)]">4.9★</div><p class="opacity-70 text-sm mt-1 m-0">تقييم العملاء</p></div>
  </div>
</section>`,
  },
  {
    id: "testimonials",
    title: "آراء عملاء",
    emoji: "💬",
    html: `<section class="w-full px-4 py-12 sm:py-16">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-2xl sm:text-3xl font-extrabold text-center mb-10">ماذا يقول عملاؤنا</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <figure class="rounded-2xl border border-black/10 p-6 m-0"><p class="m-0 mb-4 leading-relaxed">"تجربة ممتازة من أول التواصل لحد الاستلام، والجودة فاقت توقعاتي."</p><figcaption class="font-bold text-sm">أحمد سيد — القاهرة</figcaption></figure>
      <figure class="rounded-2xl border border-black/10 p-6 m-0"><p class="m-0 mb-4 leading-relaxed">"الأسعار مناسبة جدًا والخدمة سريعة. أنصح بالتعامل معهم بشدة."</p><figcaption class="font-bold text-sm">منى خالد — جدة</figcaption></figure>
      <figure class="rounded-2xl border border-black/10 p-6 m-0"><p class="m-0 mb-4 leading-relaxed">"فريق محترف ومتعاون، تابعوا معايا كل خطوة لحد ما اطمنت."</p><figcaption class="font-bold text-sm">كريم فؤاد — دبي</figcaption></figure>
    </div>
  </div>
</section>`,
  },
  {
    id: "faq",
    title: "أسئلة شائعة",
    emoji: "❓",
    html: `<section class="w-full px-4 py-12 sm:py-16">
  <div class="max-w-3xl mx-auto">
    <h2 class="text-2xl sm:text-3xl font-extrabold text-center mb-8">الأسئلة الشائعة</h2>
    <details class="rounded-xl border border-black/10 p-4 mb-3"><summary class="font-bold cursor-pointer">كم تستغرق مدة التوصيل؟</summary><p class="opacity-70 mt-3 mb-0">من 2 إلى 5 أيام عمل حسب المحافظة.</p></details>
    <details class="rounded-xl border border-black/10 p-4 mb-3"><summary class="font-bold cursor-pointer">هل يمكن الاستبدال أو الاسترجاع؟</summary><p class="opacity-70 mt-3 mb-0">نعم، خلال 14 يومًا من الاستلام بشرط بقاء المنتج بحالته.</p></details>
    <details class="rounded-xl border border-black/10 p-4"><summary class="font-bold cursor-pointer">ما هي طرق الدفع المتاحة؟</summary><p class="opacity-70 mt-3 mb-0">الدفع عند الاستلام، أو بالبطاقة، أو المحافظ الإلكترونية.</p></details>
  </div>
</section>`,
  },
  {
    id: "cta",
    title: "دعوة لإجراء",
    emoji: "🚀",
    html: `<section class="w-full px-4 py-14 sm:py-20 text-center bg-[var(--c-primary,#0ea5e9)] text-white">
  <div class="max-w-3xl mx-auto">
    <h2 class="text-2xl sm:text-4xl font-extrabold mb-4">جاهز تبدأ معنا؟</h2>
    <p class="opacity-90 mb-8">تواصل معنا الآن واحصل على استشارة مجانية وعرض سعر خاص.</p>
    <a href="#" class="inline-block bg-white text-[var(--c-primary,#0ea5e9)] font-extrabold rounded-full px-8 py-3 no-underline">تواصل معنا</a>
  </div>
</section>`,
  },
];

// Photographic fallback if AI image generation isn't available/fails.
function fallbackImg(desc: string): string {
  const kw = encodeURIComponent(
    (desc || "abstract").replace(/[^a-zA-Z0-9\s,]/g, "").trim().split(/\s+/).slice(0, 2).join(",") || "abstract"
  );
  return `https://loremflickr.com/1200/700/${kw}`;
}

function mapError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const low = raw.toLowerCase();
  if (e instanceof DOMException && e.name === "AbortError")
    return "استغرق الطلب وقتًا طويلًا أو أُلغي. جرّب مجددًا.";
  if (e instanceof TypeError) return "خطأ في الاتصال — تأكد أن الخادم يعمل، ثم أعد المحاولة.";
  if (low.includes("x-api-key") || low.includes("authentication") || low.includes("401"))
    return "مفتاح Anthropic غير صحيح أو منتهي الصلاحية.";
  if (low.includes("credit") || low.includes("billing") || low.includes("insufficient") || low.includes("quota"))
    return "لا يوجد رصيد كافٍ في حساب Anthropic. أضف رصيدًا ثم أعد المحاولة.";
  return raw;
}

const SWATCHES = ["#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#ef4444", "#10b981", "#0ea5e9"];

// Smart next-step suggestions the agent offers after each build/edit.
const SUGGESTIONS = [
  "أضف قسم آراء العملاء",
  "أضف صفحة الأسعار",
  "أضف أنيميشن وحركة احترافية",
  "أضف قسم الأسئلة الشائعة",
  "حسّن الهيدر وأضف زر تواصل بارز",
  "أضف معرض صور للأعمال",
  "اجعل الألوان أكثر عصرية بتدرّجات",
  "أضف نموذج تواصل في صفحة جديدة",
];

// ---- component -------------------------------------------------------------

export default function Builder() {
  const router = useRouter();
  const { user, authEnabled } = useUser();
  const userRef = useRef<typeof user>(null);
  userRef.current = user;
  const [html, setHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [tab, setTab] = useState<Tab>("preview");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [asking, setAsking] = useState(false);
  const [clarifyQs, setClarifyQs] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [chatMode, setChatMode] = useState<"edit" | "chat">("edit");
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editScope, setEditScope] = useState<"all" | "phone">("all");
  const [editImage, setEditImage] = useState<{ data: string; mediaType: string } | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertDesc, setInsertDesc] = useState("");
  const [insertBusy, setInsertBusy] = useState("");
  const insertIdxRef = useRef(0);
  const pendingSlotRef = useRef<{ kind: "section" | "banner"; desc: string } | null>(null);
  const editImgRef = useRef<HTMLInputElement>(null);
  const editImageRef = useRef<{ data: string; mediaType: string } | null>(null);
  editImageRef.current = editImage;

  function onEditImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("الصورة كبيرة جدًا (الحد 5 ميجابايت).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(",")[1];
      setEditImage({ data, mediaType: file.type || "image/png" });
    };
    reader.readAsDataURL(file);
  }
  const [editDoc, setEditDoc] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [histVer, setHistVer] = useState(0);
  const [mobileView, setMobileView] = useState<"chat" | "work">("work");
  const [linking, setLinking] = useState(false);
  const projectIdRef = useRef<string | null>(null);
  const publishedIdRef = useRef<string | null>(null);

  const startedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastReqRef = useRef<LastReq | null>(null);
  const seedRef = useRef<{
    prompt: string;
    image: ImageSeed | null;
    lang: string;
    theme?: string;
    contact?: { whatsapp?: string; email?: string } | null;
    kind?: string;
    product?: Record<string, string> | null;
  }>({ prompt: "", image: null, lang: "ar" });
  const htmlRef = useRef("");
  const histRef = useRef<{ stack: string[]; idx: number }>({ stack: [], idx: -1 });
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  htmlRef.current = html;

  // ---- history ----
  function commit(h: string) {
    const st = histRef.current;
    if (st.stack[st.idx] === h) return;
    st.stack = st.stack.slice(0, st.idx + 1);
    st.stack.push(h);
    if (st.stack.length > 60) st.stack.shift();
    st.idx = st.stack.length - 1;
    setHistVer((v) => v + 1);
  }
  function commitDebounced(h: string) {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commit(h), 700);
  }
  function applyHistory(h: string) {
    setHtml(h);
    setPreviewHtml(h);
    sessionStorage.setItem("oji:html", h);
    if (editMode) setEditDoc(injectEditor(h));
  }
  function undo() {
    const st = histRef.current;
    if (st.idx <= 0) return;
    st.idx -= 1;
    setHistVer((v) => v + 1);
    applyHistory(st.stack[st.idx]);
  }
  function redo() {
    const st = histRef.current;
    if (st.idx >= st.stack.length - 1) return;
    st.idx += 1;
    setHistVer((v) => v + 1);
    applyHistory(st.stack[st.idx]);
  }
  const canUndo = histRef.current.idx > 0;
  const canRedo = histRef.current.idx < histRef.current.stack.length - 1;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data;
      if (!d || !d.__oji) return;
      if (d.type === "update" && typeof d.html === "string") {
        const c = cleanHtml(d.html);
        setHtml(c);
        sessionStorage.setItem("oji:html", c);
        commitDebounced(c);
        // A slot was just inserted for an AI-built section → fill it now.
        const pend = pendingSlotRef.current;
        if (pend && c.includes("data-oji-slot")) {
          pendingSlotRef.current = null;
          htmlRef.current = c; // ref is render-synced; make it current for runEdit
          runSlotFill(c, pend);
        }
      } else if (d.type === "select") {
        setSelected({ tag: d.tag, html: d.html, key: d.key });
      } else if (d.type === "addHere") {
        insertIdxRef.current = typeof d.index === "number" ? d.index : 0;
        setInsertOpen(true);
        setMobileView("chat");
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const savedModel = sessionStorage.getItem("oji:model");
    if (savedModel) setModel(savedModel);

    // Open a saved project via /builder?project=<id>
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (projectId) {
      (async () => {
        setLoading(true);
        try {
          let proj: { html: string; title: string };
          const sb = getSupabase();
          if (authEnabled && sb) {
            const { data, error } = await sb.from("projects").select("html,title").eq("id", projectId).single();
            if (error || !data) throw new Error("تعذّر فتح المشروع");
            proj = data as { html: string; title: string };
          } else {
            const res = await fetch(`/api/projects/${projectId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "تعذّر فتح المشروع");
            proj = data;
          }
          projectIdRef.current = projectId;
          setHtml(proj.html);
          setPreviewHtml(proj.html);
          commit(proj.html);
          sessionStorage.setItem("oji:html", proj.html);
          setMessages([{ role: "system", text: `تم فتح المشروع: ${proj.title}` }]);
        } catch (e) {
          setError(mapError(e));
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    const savedHtml = sessionStorage.getItem("oji:html");
    const prompt = sessionStorage.getItem("oji:prompt");
    if (savedHtml) {
      setHtml(savedHtml);
      setPreviewHtml(savedHtml);
      commit(savedHtml);
      return;
    }
    if (!prompt) {
      router.push("/");
      return;
    }
    let image: ImageSeed | null = null;
    try {
      image = JSON.parse(sessionStorage.getItem("oji:image") || "null");
    } catch {
      image = null;
    }
    const lang = sessionStorage.getItem("oji:lang") || "ar";
    const theme = sessionStorage.getItem("oji:theme") || "auto";
    let contact: { whatsapp?: string; email?: string } | null = null;
    try {
      contact = JSON.parse(sessionStorage.getItem("oji:contact") || "null");
    } catch {
      contact = null;
    }
    const kind = sessionStorage.getItem("oji:kind") || "site";
    let product: Record<string, string> | null = null;
    try {
      product = JSON.parse(sessionStorage.getItem("oji:product") || "null");
    } catch {
      product = null;
    }
    seedRef.current = { prompt, image, lang, theme, contact, kind, product };
    setMessages([{ role: "user", text: image ? `🖼️ بناء من صورة — ${prompt}` : prompt }]);
    // Image builds carry their intent in the picture; landing pages already
    // collected the product details up front — both skip clarification.
    if (image || kind === "landing") generateSite();
    else startClarify(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startClarify(idea: string) {
    setAsking(true);
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: idea, model }),
      });
      const data = await res.json().catch(() => ({ questions: [] }));
      const qs: string[] = Array.isArray(data.questions) ? data.questions.slice(0, 3) : [];
      if (qs.length) {
        setClarifyQs(qs);
        setMessages((m) => [...m, { role: "system", text: "قبل ما أبدأ، جاوبني على دي عشان أطلّعلك أحسن نتيجة (أو تخطّاها):" }]);
      } else {
        setAsking(false);
        generateSite();
      }
    } catch {
      setAsking(false);
      generateSite();
    }
  }

  function submitClarify() {
    const qs = clarifyQs;
    const extras = qs
      .map((q, i) => ({ q, a: (clarifyAnswers[i] || "").trim() }))
      .filter((x) => x.a);
    if (extras.length) {
      const detail = extras.map((x) => `- ${x.q} ${x.a}`).join("\n");
      seedRef.current.prompt = `${seedRef.current.prompt}\n\nتفاصيل إضافية من العميل:\n${detail}`;
      setMessages((m) => [...m, { role: "user", text: extras.map((x) => x.a).join(" — ") }]);
    }
    setAsking(false);
    setClarifyQs([]);
    generateSite();
  }

  function skipClarify() {
    setAsking(false);
    setClarifyQs([]);
    generateSite();
  }

  async function streamText(
    body: Record<string, unknown>,
    signal: AbortSignal,
    onChunk?: (buf: string) => void
  ): Promise<string> {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
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
      onChunk?.(buf);
    }
    const errMatch = buf.match(/<!--OJI_ERROR:([\s\S]*?)-->/);
    if (errMatch) throw new Error(errMatch[1]);
    if (!buf.trim()) throw new Error("لم يصل أي محتوى من الخادم");
    return buf;
  }

  function beginRequest(): AbortController {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    if (editMode) {
      setEditMode(false);
      setSelected(null);
    }
    setTab("code");
    setMobileView("work"); // on phones, surface the build as it streams
    return ac;
  }

  // Replace <img data-oji-gen="..."> placeholders with real AI-generated images
  // (Gemini / Nano Banana), or a photographic fallback. Runs after text is done.
  async function resolveGenImages(doc: string): Promise<string> {
    if (!doc || !doc.includes("data-oji-gen")) return doc;
    let parsed: Document;
    try {
      parsed = new DOMParser().parseFromString(doc, "text/html");
    } catch {
      return doc;
    }
    const nodes = Array.from(parsed.querySelectorAll("[data-oji-gen]")).slice(0, 4);
    if (!nodes.length) return doc;
    setMessages((m) => [...m, { role: "system", text: `🎨 أُنشئ ${nodes.length} صورة/بانر بالذكاء (Nano Banana)...` }]);
    await Promise.all(
      nodes.map(async (el) => {
        const desc = el.getAttribute("data-oji-gen") || "";
        el.removeAttribute("data-oji-gen");
        if (!el.getAttribute("alt")) el.setAttribute("alt", desc.slice(0, 80));
        let src = "";
        try {
          const res = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: desc }),
          });
          const data = await res.json();
          if (res.ok && data.url) src = data.url;
        } catch {
          /* ignore */
        }
        el.setAttribute("src", src || fallbackImg(desc));
      })
    );
    return "<!DOCTYPE html>\n" + parsed.documentElement.outerHTML;
  }

  async function generateSite() {
    lastReqRef.current = { kind: "site" };
    const { prompt, image, lang, theme, contact, kind, product } = seedRef.current;
    const isLanding = kind === "landing";
    const ac = beginRequest();
    const timeout = setTimeout(() => ac.abort(), 290_000);
    try {
      setMessages((m) => [
        ...m,
        { role: "system", text: isLanding ? "⏳ أبني صفحة الهبوط الاحترافية..." : "⏳ أبني الهيكل والصفحة الرئيسية..." },
      ]);
      let lastP = 0;
      let totIn = 0;
      let totOut = 0;
      const shellRaw = await streamText(
        isLanding
          ? { prompt, model, step: "landing", image, lang, theme, contact, product }
          : { prompt, model, step: "shell", image, lang, theme, contact },
        ac.signal,
        (buf) => {
          const c = cleanHtml(buf);
          setHtml(c);
          const now = Date.now();
          if (now - lastP > 400) {
            setPreviewHtml(c);
            lastP = now;
          }
        }
      );
      { const u = readUsage(shellRaw); totIn += u.inT; totOut += u.outT; }
      let current = cleanHtml(shellRaw);
      setHtml(current);
      setPreviewHtml(current);
      setTab("preview");
      sessionStorage.setItem("oji:html", current);

      const pages = isLanding ? [] : parsePages(current);
      const toFill = pages.filter((p) => isSectionEmpty(current, p.id));
      for (const pg of toFill) {
        setMessages((m) => [...m, { role: "system", text: `⏳ أبني صفحة: ${pg.title}...` }]);
        const innerRaw = await streamText(
          { prompt, model, step: "page", pageId: pg.id, pageTitle: pg.title, context: current, lang, contact },
          ac.signal
        );
        const u = readUsage(innerRaw);
        totIn += u.inT;
        totOut += u.outT;
        current = injectPage(current, pg.id, cleanInner(innerRaw));
        setHtml(current);
        setPreviewHtml(current);
        sessionStorage.setItem("oji:html", current);
      }
      current = await resolveGenImages(current);
      setHtml(current);
      setPreviewHtml(current);
      sessionStorage.setItem("oji:html", current);
      commit(current);
      setMessages((m) => [
        ...m,
        { role: "system", text: isLanding ? "تمّت صفحة الهبوط ✓ اطلب أي تعديل، أو فعّل التعديل اليدوي، أو انشرها." : "تم بناء موقعك بالكامل ✓ اطلب أي تعديل، أو فعّل التعديل اليدوي، أو انشره." },
        { role: "system", text: `💡 استهلاك التوليد: ${estimateCost(totIn, totOut, model)}` },
      ]);
    } catch (e) {
      setError(mapError(e));
      setTab(htmlRef.current ? "preview" : "code");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function runEdit(instruction: string) {
    lastReqRef.current = { kind: "edit", instruction };
    const ac = beginRequest();
    const timeout = setTimeout(() => ac.abort(), 290_000);
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlRef.current, instruction, model, image: editImageRef.current }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({ error: `فشل الطلب (${res.status})` }));
        throw new Error(d.error || `فشل الطلب (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let lastP = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const c = cleanHtml(buf);
        setHtml(c);
        const now = Date.now();
        if (now - lastP > 400) {
          setPreviewHtml(c);
          lastP = now;
        }
      }
      const errMatch = buf.match(/<!--OJI_ERROR:([\s\S]*?)-->/);
      if (errMatch) throw new Error(errMatch[1]);
      if (!buf.trim()) throw new Error("لم يصل أي محتوى من الخادم");
      const finalHtml = (await resolveGenImages(cleanHtml(buf))).replace(
        /<div\s+data-oji-slot(?:="")?\s*><\/div>/gi,
        ""
      );
      setHtml(finalHtml);
      setPreviewHtml(finalHtml);
      sessionStorage.setItem("oji:html", finalHtml);
      commit(finalHtml);
      setTab("preview");
      const u = readUsage(buf);
      setMessages((m) => [
        ...m,
        { role: "system", text: "تم تطبيق التعديل ✓" },
        { role: "system", text: `💡 استهلاك التعديل: ${estimateCost(u.inT, u.outT, model)}` },
      ]);
      autoSyncGithub();
    } catch (e) {
      setError(mapError(e));
      setTab(htmlRef.current ? "preview" : "code");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setEditImage(null);
    }
  }

  function retry() {
    const r = lastReqRef.current;
    if (!r) return;
    if (r.kind === "site") generateSite();
    else runEdit(r.instruction);
  }

  function sendEdit() {
    const text = input.trim();
    if (!text || loading || !html) return;
    setInput("");
    let instruction = text;
    if (selected) {
      const anchor = selected.key
        ? `العنصر المستهدف هو الذي يحمل السمة data-oji-el="${selected.key}".`
        : `العنصر المستهدف هو هذا بالضبط:\n${selected.html}`;
      instruction = `طبّق التعديل **داخل عنصر محدد فقط** وأعد المستند كاملًا.
${anchor}

المطلوب: ${text}

قواعد صارمة للتعديل الموضعي:
1. نفّذ التغيير **داخل هذا العنصر نفسه أو مكانه بالضبط** — ممنوع تمامًا إنشاء قسم/سيكشن جديد فوقه أو تحته أو خارج مكانه.
2. التزم بنفس **عرض ومقاس** العنصر الحالي وحاويته (نفس max-w ونفس الـ padding والهوامش) — ممنوع أن يخرج المحتوى الجديد عريضًا full-width إن كان العنصر ليس كذلك.
3. لا تترك أي فراغات كبيرة أو مربعات فارغة، ولا تُخلّ بتناسق الصفحة: عدّل ارتفاع/حشو العنصر ليناسب المحتوى الجديد بشكل مضبوط ومتناسق.
4. لو المطلوب صورة أو بانر، استخدم <img data-oji-gen="وصف إنجليزي دقيق" ...> بأصناف متجاوبة (w-full h-auto object-cover ورادياس مناسب) بحيث يظهر مضبوطًا على الفون والكمبيوتر.
5. لا تغيّر أي جزء آخر من الموقع إطلاقًا.`;
    }
    setMessages((m) => [...m, { role: "user", text: selected ? `🎯 (على العنصر المحدد) ${text}` : text }]);
    runEdit(instruction);
  }

  function applySuggestion(text: string) {
    if (loading || !html) return;
    setMessages((m) => [...m, { role: "user", text }]);
    runEdit(text);
  }

  function onSend() {
    if (chatMode === "chat") {
      const t = input.trim();
      if (!t || loading) return;
      setInput("");
      sendChat(t);
    } else {
      sendEdit();
    }
  }

  async function sendChat(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, html: htmlRef.current, history, model }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({ error: `فشل الطلب (${res.status})` }));
        throw new Error(d.error || `فشل الطلب (${res.status})`);
      }
      setMessages((m) => [...m, { role: "system", text: "..." }]);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const clean = buf.replace(/<!--OJI_(ERROR|USAGE):[\s\S]*?-->/g, "").trim();
        setMessages((m) => {
          const c = [...m];
          if (c.length) c[c.length - 1] = { role: "system", text: clean || "..." };
          return c;
        });
      }
      const errMatch = buf.match(/<!--OJI_ERROR:([\s\S]*?)-->/);
      if (errMatch) throw new Error(errMatch[1]);
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuggestions() {
    if (loadingSuggest || !html) return;
    setLoadingSuggest(true);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlRef.current, model }),
      });
      const data = await res.json().catch(() => ({ suggestions: [] }));
      if (Array.isArray(data.suggestions) && data.suggestions.length) setAiSuggestions(data.suggestions);
    } catch {
      /* keep static suggestions */
    } finally {
      setLoadingSuggest(false);
    }
  }

  // Device-specific visibility for the selected element (phone vs desktop).
  function toggleDeviceClass(cls: string) {
    iframePost({ type: "toggleClass", cls });
  }

  function updateCode(value: string) {
    setHtml(value);
    setPreviewHtml(value);
    sessionStorage.setItem("oji:html", value);
    commitDebounced(value);
  }

  function toggleEdit() {
    if (!html) return;
    if (!editMode) {
      setEditDoc(injectEditor(html));
      setEditMode(true);
      setTab("preview");
    } else {
      setEditMode(false);
      setSelected(null);
      setPreviewHtml(html);
    }
  }

  function iframePost(msg: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage({ __oji: 1, ...msg }, "*");
  }
  function deleteSelected() {
    iframePost({ type: "delete" });
    setSelected(null);
  }
  function replaceImageUrl() {
    const url = window.prompt("رابط الصورة الجديدة:");
    if (url) iframePost({ type: "replaceImg", url });
  }
  function insertImageUrl() {
    const url = window.prompt("رابط الصورة المراد إضافتها:");
    if (url) iframePost({ type: "insertImg", url });
  }
  function buildHref(v: string): string {
    const s = v.trim();
    if (/^(https?:|mailto:|tel:|sms:)/i.test(s)) return s;
    if (/^wa\.me\//i.test(s)) return "https://" + s;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "mailto:" + s;
    const digits = s.replace(/[^\d]/g, "");
    // A bare phone number → WhatsApp (the common case for a "تواصل/اطلب" button).
    if (digits.length >= 7 && /^[\d\s+()-]+$/.test(s)) return "https://wa.me/" + digits;
    if (/^www\./i.test(s)) return "https://" + s;
    return "https://" + s;
  }
  function setLink() {
    if (!selected) return;
    const raw = window.prompt(
      "وجهة الزر عند الضغط:\n• رقم واتساب بالكود الدولي (مثال: 201200026457)\n• رابط كامل: https://...\n• بريد: name@site.com\n• اتصال: tel:+201200026457",
      ""
    );
    if (raw == null) return;
    const v = raw.trim();
    if (!v) return;
    iframePost({ type: "setLink", href: buildHref(v) });
  }
  // ---- Insert panel (Shopify-style add section / block / banner) ----
  const SLOT_RE = /<div\s+data-oji-slot(?:="")?\s*><\/div>/i;

  function closeInsert() {
    setInsertOpen(false);
    setInsertDesc("");
  }
  function insertLibrary(item: { title: string; html: string }) {
    iframePost({ type: "insertAt", index: insertIdxRef.current, html: item.html });
    setMessages((m) => [...m, { role: "system", text: `➕ تمت إضافة «${item.title}» — تقدر تعدّله يدويًا أو تطلب تعديله بالذكاء.` }]);
    closeInsert();
  }
  function startAiInsert(kind: "section" | "banner") {
    const desc = insertDesc.trim();
    if (!desc) {
      alert(kind === "banner" ? "اكتب وصف البانر/الصورة المطلوبة." : "اكتب وصف القسم المطلوب.");
      return;
    }
    pendingSlotRef.current = { kind, desc };
    iframePost({ type: "insertSlot", index: insertIdxRef.current });
    closeInsert();
  }

  // Fill the inserted slot: banners are built locally (fast), sections via AI.
  async function runSlotFill(doc: string, pend: { kind: "section" | "banner"; desc: string }) {
    if (pend.kind === "banner") {
      setInsertBusy("🎨 أُنشئ البانر...");
      setMessages((m) => [...m, { role: "system", text: `🎨 أُنشئ البانر: ${pend.desc}` }]);
      let url = "";
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: pend.desc, aspect: "16:6" }),
        });
        const data = await res.json();
        if (res.ok && data.url) url = data.url;
      } catch {
        /* ignore */
      }
      const src = url || fallbackImg(pend.desc);
      const banner = `<section class="w-full px-4 py-6 sm:py-8"><div class="max-w-6xl mx-auto"><img src="${src}" alt="${pend.desc.slice(0, 80).replace(/"/g, "")}" loading="lazy" class="block w-full h-auto max-h-[420px] object-cover rounded-2xl shadow-lg" /></div></section>`;
      const next = doc.replace(SLOT_RE, banner);
      applyDoc(next);
      setInsertBusy("");
      setMessages((m) => [...m, { role: "system", text: url ? "تم إنشاء البانر وتركيبه ✓" : "تم تركيب صورة بديلة (فعّل GEMINI_API_KEY لتوليد بانر مخصّص)." }]);
      return;
    }
    // AI-built section, scoped strictly to the slot so nothing else changes.
    await runEdit(
      `أدرِج قسمًا جديدًا مكان العنصر النائب <div data-oji-slot></div> بالضبط (استبدله به تمامًا واحذف العنصر النائب).
المطلوب في القسم: ${pend.desc}
قواعد صارمة: لا تغيّر أي شيء آخر في الصفحة إطلاقًا. اجعل عرض القسم ومسافاته الداخلية **مطابقة تمامًا** للأقسام المجاورة له (نفس الحاوية max-w ونفس الـ padding)، وبنفس ألوان وخطوط الموقع (متغيّرات --c-primary وغيرها)، ومتجاوب بالكامل على الفون والكمبيوتر بدون أي فراغات زائدة أو تمدّد خارج التنسيق.`
    );
  }

  // Apply a full document produced locally (no AI round-trip).
  function applyDoc(next: string) {
    const c = cleanHtml(next);
    setHtml(c);
    setPreviewHtml(c);
    sessionStorage.setItem("oji:html", c);
    commit(c);
    if (editMode) setEditDoc(injectEditor(c));
  }

  function styleSelected(prop: string, value: string) {
    iframePost({ type: "style", prop, value, scope: editScope });
  }
  function changeFont(delta: number) {
    iframePost({ type: "font", delta, scope: editScope });
  }
  function onEditFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("الصورة كبيرة جدًا (الحد 5 ميجابايت)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      if (selected && selected.tag === "IMG") iframePost({ type: "replaceImg", url });
      else iframePost({ type: "insertImg", url });
    };
    reader.readAsDataURL(file);
  }

  function setThemeColor(color: string) {
    if (!html) return;
    const next = applyPrimaryColor(html, color);
    setHtml(next);
    setPreviewHtml(next);
    sessionStorage.setItem("oji:html", next);
    if (editMode) setEditDoc(injectEditor(next));
    commit(next);
  }

  function rememberProject(id: string, title: string) {
    try {
      const raw = localStorage.getItem("oji:projects");
      const list: { id: string; title: string; ts: number }[] = raw ? JSON.parse(raw) : [];
      const next = [{ id, title, ts: Date.now() }, ...list.filter((p) => p.id !== id)].slice(0, 50);
      localStorage.setItem("oji:projects", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // Returns false (and redirects to login) when auth is on but the user is a guest.
  function requireLogin(): boolean {
    if (authEnabled && !userRef.current) {
      router.push("/login?returnTo=/builder");
      return false;
    }
    return true;
  }

  function goProjects() {
    if (!requireLogin()) return;
    router.push("/projects");
  }

  async function logout() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    try { localStorage.removeItem("oji:lastActive"); } catch {}
    router.push("/");
  }

  async function saveProject() {
    if (!html || saving || loading) return;
    if (!requireLogin()) return;
    const current = projectIdRef.current;
    const def = (seedRef.current.prompt || "مشروعي").slice(0, 40);
    const title = window.prompt("اسم المشروع:", def);
    if (title === null) return;
    setSaving(true);
    try {
      if (authEnabled) {
        const sb = getSupabase();
        if (!sb || !userRef.current) throw new Error("سجّل الدخول أولًا");
        const row = {
          user_id: userRef.current.id,
          title: title || "مشروع بدون اسم",
          html: withSiteRuntime(cleanHtml(html)),
          updated_at: new Date().toISOString(),
        };
        if (current) {
          const { error } = await sb.from("projects").update(row).eq("id", current);
          if (error) throw error;
        } else {
          const { data, error } = await sb.from("projects").insert(row).select("id").single();
          if (error) throw error;
          projectIdRef.current = data.id as string;
        }
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: current || undefined, html: withSiteRuntime(cleanHtml(html)), title }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
        projectIdRef.current = data.id;
        rememberProject(data.id, title || "مشروع بدون اسم");
      }
      setMessages((m) => [...m, { role: "system", text: "💾 تم حفظ المشروع. تجده في «مشاريعي»." }]);
    } catch (e) {
      setError(mapError(e));
    } finally {
      setSaving(false);
    }
  }

  // Silent auto-sync to GitHub after a successful edit/build, if enabled.
  function autoSyncGithub() {
    if (!ghStore.auto()) return;
    const token = ghStore.token();
    const repo = ghStore.repo();
    if (!token || !repo || !htmlRef.current) return;
    ghPush({ "index.html": withSiteRuntime(cleanHtml(htmlRef.current)) }, { token, repo, message: "Auto-sync from oji builder" }).catch(() => {});
  }

  async function toApk() {
    if (!html || publishing) return;
    // Auto-publish silently so the client doesn't do any step — one click → APK.
    let url = publishedIdRef.current ? window.location.origin + "/s/" + publishedIdRef.current : "";
    if (!url) {
      setPublishing(true);
      try {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: withSiteRuntime(cleanHtml(html)) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "تعذّر التجهيز");
        publishedIdRef.current = data.id;
        url = window.location.origin + data.path;
      } catch (e) {
        setError(mapError(e));
        setPublishing(false);
        return;
      }
      setPublishing(false);
    }
    router.push(`/apk?url=${encodeURIComponent(url)}`);
  }

  async function publish() {
    if (!html || publishing) return;
    if (!requireLogin()) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: withSiteRuntime(cleanHtml(html)) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر النشر");
      publishedIdRef.current = data.id;
      const pathUrl = window.location.origin + data.path;
      const fullUrl = data.subdomainUrl || pathUrl;
      const extra = data.subdomainUrl ? `\n(أو: ${pathUrl})` : "";
      setMessages((m) => [...m, { role: "system", text: `🚀 تم النشر! الرابط: ${fullUrl}${extra}\nتقدر دلوقتي تربط نطاقك الخاص من زر «🌐 دومين».` }]);
      window.open(fullUrl, "_blank");
    } catch (e) {
      setError(mapError(e));
    } finally {
      setPublishing(false);
    }
  }

  async function connectDomain() {
    if (linking) return;
    if (!requireLogin()) return;
    if (!publishedIdRef.current) {
      alert("انشر الموقع أولًا بزر «🚀 نشر»، ثم اربط النطاق.");
      return;
    }
    const domain = window.prompt("اكتب نطاقك (مثال: mystore.com أو www.mystore.com):");
    if (!domain) return;
    setLinking(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, siteId: publishedIdRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر ربط النطاق");
      const recs = (data.records || []).map((r: { type: string; name: string; value: string }) => `• ${r.type}   ${r.name}   →   ${r.value}`).join("\n");
      const ver = (data.verification || []).map((v: { type: string; domain: string; value: string }) => `• ${v.type}   ${v.domain}   →   ${v.value}`).join("\n");
      setMessages((m) => [
        ...m,
        {
          role: "system",
          text:
            `🌐 لربط «${data.domain}»: أضِف سجلّات DNS التالية في لوحة استضافتك:\n${recs}` +
            (ver ? `\n\nسجلّات تأكيد الملكية:\n${ver}` : "") +
            `\n\nبعد إضافتها قد يستغرق التفعيل حتى ساعة، وسيعمل النطاق تلقائيًا مع شهادة SSL.` +
            (data.verified ? "\n\n✅ تم التحقق والتفعيل!" : "\n\n(الحالة: بانتظار إضافة السجلّات)"),
        },
      ]);
      setMobileView("chat");
    } catch (e) {
      setError(mapError(e));
    } finally {
      setLinking(false);
    }
  }

  function download() {
    const blob = new Blob([withSiteRuntime(cleanHtml(html))], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oji-site.html";
    a.click();
    URL.revokeObjectURL(url);
  }
  function openNewTab() {
    const blob = new Blob([withSiteRuntime(cleanHtml(html))], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <div className="app-h flex flex-col">
      <header className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-[var(--oji-border)] bg-[var(--oji-surface)]">
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition">←</button>
          <span className="font-extrabold whitespace-nowrap">oji <span className="oji-gradient-text">builder</span></span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scroll-touch ms-auto [&>*]:shrink-0">
          <div className="flex rounded-lg border border-[var(--oji-border)] overflow-hidden">
            <button onClick={undo} disabled={!canUndo || loading} title="تراجع" className="px-2.5 py-1.5 text-sm disabled:opacity-30 hover:bg-[var(--oji-surface-2)]">↶</button>
            <button onClick={redo} disabled={!canRedo || loading} title="إعادة" className="px-2.5 py-1.5 text-sm disabled:opacity-30 hover:bg-[var(--oji-surface-2)] border-r border-[var(--oji-border)]">↷</button>
          </div>
          <button onClick={toggleEdit} disabled={!html || loading} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-40 ${editMode ? "bg-[var(--oji-accent)] text-[#06121f]" : "border border-[var(--oji-border)] hover:border-[var(--oji-accent)]"}`}>
            {editMode ? "إنهاء التعديل ✓" : "✏️ تعديل يدوي"}
          </button>
          <select
            value={model}
            onChange={(e) => { setModel(e.target.value); sessionStorage.setItem("oji:model", e.target.value); }}
            disabled={loading}
            title="اختر نموذج الذكاء الاصطناعي"
            className="px-2.5 py-1.5 rounded-lg border border-[var(--oji-border)] bg-[var(--oji-surface-2)] text-sm outline-none hover:border-[var(--oji-primary)] disabled:opacity-50 cursor-pointer"
          >
            {MODELS.map((mo) => (
              <option key={mo.id} value={mo.id}>{mo.badge} {mo.label} · {mo.speed}</option>
            ))}
          </select>
          <button onClick={goProjects} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] transition whitespace-nowrap">مشاريعي</button>
          <button onClick={() => router.push("/contact")} title="تواصل معنا" className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] transition whitespace-nowrap">☎ تواصل</button>
          {authEnabled && (
            user ? (
              <button onClick={logout} title={user.email || ""} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-red-500 hover:text-red-300 transition whitespace-nowrap">خروج</button>
            ) : (
              <button onClick={() => router.push("/login?returnTo=/builder")} className="px-3 py-1.5 rounded-lg bg-[var(--oji-surface-2)] border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] transition whitespace-nowrap">دخول</button>
            )
          )}
          <button onClick={saveProject} disabled={!html || loading || saving} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] disabled:opacity-40 transition">
            {saving ? "...حفظ" : "💾 حفظ"}
          </button>
          <button onClick={publish} disabled={!html || loading || publishing} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] disabled:opacity-40 transition">
            {publishing ? "...نشر" : "🚀 نشر"}
          </button>
          <button onClick={connectDomain} disabled={!html || loading || linking} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] disabled:opacity-40 transition">
            {linking ? "...ربط" : "🌐 دومين"}
          </button>
          {html && <GithubButton files={() => ({ "index.html": withSiteRuntime(cleanHtml(htmlRef.current || html)) })} defaultRepo="oji-site" />}
          <button onClick={toApk} disabled={!html || publishing} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-accent)] disabled:opacity-40 transition whitespace-nowrap">📦 APK</button>
          <button onClick={openNewTab} disabled={!html} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] disabled:opacity-40 transition">معاينة ↗</button>
          <button onClick={download} disabled={!html} className="px-3 py-1.5 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm disabled:opacity-40 transition">تنزيل</button>
        </div>
      </header>

      {/* Mobile view switch */}
      <div className="lg:hidden flex shrink-0 border-b border-[var(--oji-border)] bg-[var(--oji-surface)]">
        <button onClick={() => setMobileView("work")} className={`flex-1 py-2.5 text-sm ${mobileView === "work" ? "bg-[var(--oji-surface-2)] font-bold" : "text-[var(--oji-muted)]"}`}>المعاينة</button>
        <button onClick={() => setMobileView("chat")} className={`flex-1 py-2.5 text-sm ${mobileView === "chat" ? "bg-[var(--oji-surface-2)] font-bold" : "text-[var(--oji-muted)]"}`}>المحادثة والأدوات</button>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className={`w-full lg:w-[340px] shrink-0 border-l border-[var(--oji-border)] bg-[var(--oji-surface)] flex-col ${mobileView === "chat" ? "flex" : "hidden"} lg:flex`}>
          <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-line ${m.role === "user" ? "bg-[var(--oji-surface-2)] border border-[var(--oji-border)]" : "bg-[var(--oji-primary)]/10 border border-[var(--oji-primary)]/30 text-[var(--oji-text)]"}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="rounded-2xl px-4 py-2.5 text-sm bg-[var(--oji-primary)]/10 border border-[var(--oji-primary)]/30 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--oji-primary)] animate-pulse" />
                يكتب الكود الآن...
              </div>
            )}
            {error && (
              <div className="rounded-2xl px-4 py-3 text-sm bg-red-500/10 border border-red-500/40 text-red-300 space-y-2">
                <div>{error}</div>
                <button onClick={retry} disabled={loading} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-bold transition">إعادة المحاولة ↻</button>
              </div>
            )}
            {asking && clarifyQs.length > 0 && (
              <div className="rounded-2xl px-3 py-3 bg-[var(--oji-accent)]/10 border border-[var(--oji-accent)]/30 space-y-3">
                {clarifyQs.map((q, i) => (
                  <div key={i}>
                    <div className="text-xs mb-1">{q}</div>
                    <input
                      value={clarifyAnswers[i] || ""}
                      onChange={(e) => setClarifyAnswers((a) => ({ ...a, [i]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") submitClarify(); }}
                      className="w-full rounded-lg bg-[var(--oji-surface-2)] border border-[var(--oji-border)] px-3 py-2 text-sm outline-none focus:border-[var(--oji-accent)]"
                      placeholder="إجابتك (اختياري)"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={submitClarify} className="flex-1 py-2 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm">ابدأ البناء 🚀</button>
                  <button onClick={skipClarify} className="px-4 py-2 rounded-lg border border-[var(--oji-border)] text-sm hover:text-white">تخطّي</button>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Theme color quick controls */}
          {html && !loading && (
            <div className="px-3 pt-3 border-t border-[var(--oji-border)]">
              <div className="text-xs text-[var(--oji-muted)] mb-2">اللون الأساسي للموقع</div>
              <div className="flex flex-wrap gap-2 items-center">
                {SWATCHES.map((c) => (
                  <button key={c} onClick={() => setThemeColor(c)} style={{ background: c }} className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition" title={c} />
                ))}
                <input type="color" onChange={(e) => setThemeColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border border-[var(--oji-border)]" title="لون مخصص" />
              </div>
            </div>
          )}

          {editMode && (
            <div className="px-3 pt-3 border-t border-[var(--oji-border)] space-y-2">
              <div className="text-xs text-[var(--oji-muted)]">{selected ? `العنصر المحدد: <${selected.tag.toLowerCase()}>` : "انقر على أي جزء في المعاينة لتحديده"}</div>
              <div className="text-[11px] text-[var(--oji-accent)] bg-[var(--oji-accent)]/10 border border-[var(--oji-accent)]/30 rounded-lg px-2 py-1.5 leading-relaxed">
                💡 بين كل قسم والتاني في المعاينة فيه زرار <b>＋</b> — منه تضيف قسم جاهز أو تطلب قسم/بانر بالذكاء في نفس المكان بالمقاس المضبوط.
              </div>
              <input ref={editFileRef} type="file" accept="image/*" onChange={onEditFile} className="hidden" />
              {selected && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={deleteSelected} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-red-500 hover:text-red-300 transition">🗑 حذف</button>
                    <button onClick={replaceImageUrl} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-primary)] transition">🖼 صورة برابط</button>
                  </div>
                  <button onClick={setLink} className="w-full px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-primary)] transition flex items-center justify-center gap-1">🔗 اربط الزر برابط (واتساب / اتصال / صفحة)</button>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[var(--oji-muted)]">نطاق التعديل:</span>
                    <div className="flex rounded-lg border border-[var(--oji-border)] overflow-hidden text-[11px]">
                      <button onClick={() => setEditScope("all")} className={`px-2.5 py-1 ${editScope === "all" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>🖥️ الكل</button>
                      <button onClick={() => setEditScope("phone")} className={`px-2.5 py-1 ${editScope === "phone" ? "bg-[var(--oji-accent)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>📱 الفون فقط</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs cursor-pointer">
                      لون النص
                      <input type="color" onChange={(e) => styleSelected("color", e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                    </label>
                    <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs cursor-pointer">
                      لون الخلفية
                      <input type="color" onChange={(e) => styleSelected("background-color", e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs">
                    <span>حجم الخط</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeFont(-2)} className="w-7 h-7 rounded bg-[var(--oji-surface-2)] hover:text-white">A-</button>
                      <button onClick={() => changeFont(2)} className="w-7 h-7 rounded bg-[var(--oji-surface-2)] hover:text-white font-bold">A+</button>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--oji-muted)] pt-1">👁️ الظهور حسب الجهاز:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => toggleDeviceClass("max-sm:hidden")} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-accent)] transition">📱 إخفاء على الفون</button>
                    <button onClick={() => toggleDeviceClass("sm:hidden")} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-accent)] transition">🖥️ إخفاء على الكمبيوتر</button>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => editFileRef.current?.click()} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-primary)] transition">⬆️ رفع صورة</button>
                <button onClick={insertImageUrl} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-primary)] transition">➕ صورة برابط</button>
              </div>
            </div>
          )}

          <div className="p-3 border-t border-[var(--oji-border)]">
            {/* agent suggestions for the next step */}
            {html && !loading && !selected && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[var(--oji-muted)]">💡 اقتراحات لتحسين موقعك:</span>
                  <button onClick={fetchSuggestions} disabled={loadingSuggest} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--oji-accent)]/50 text-[var(--oji-accent)] hover:bg-[var(--oji-accent)]/10 transition disabled:opacity-50">
                    {loadingSuggest ? "..." : "✨ اقتراحات ذكية"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(aiSuggestions.length ? aiSuggestions : SUGGESTIONS).slice(0, 5).map((s) => (
                    <button key={s} onClick={() => applySuggestion(s)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white hover:border-[var(--oji-primary)] transition text-right">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selected && (
              <div className="flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg bg-[var(--oji-accent)]/15 border border-[var(--oji-accent)]/40 text-xs">
                <span>🎯 التعديل على: &lt;{selected.tag.toLowerCase()}&gt;</span>
                <button onClick={() => setSelected(null)} className="hover:text-white">✕</button>
              </div>
            )}
            {/* edit vs discuss mode */}
            <div className="flex rounded-lg border border-[var(--oji-border)] overflow-hidden text-xs mb-2 w-max">
              <button onClick={() => setChatMode("edit")} className={`px-3 py-1.5 ${chatMode === "edit" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>✏️ تعديل</button>
              <button onClick={() => setChatMode("chat")} className={`px-3 py-1.5 ${chatMode === "chat" ? "bg-[var(--oji-accent)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>💬 نقاش</button>
            </div>
            <div className="rounded-xl bg-[var(--oji-surface-2)] border border-[var(--oji-border)] p-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }} placeholder={chatMode === "chat" ? "ناقش أو اسأل: «إيه أحسن ألوان لموقع مطعم؟»، «اقترحلي أقسام»..." : selected ? "اطلب تعديل العنصر المحدد بالذكاء..." : "اطلب تعديلًا: «غيّر الألوان»، «أضف صفحة أسعار»، «أضف لوجو»..."} className="w-full h-16 bg-transparent resize-none outline-none px-2 py-1 text-sm placeholder:text-[var(--oji-muted)]" />
              <input ref={editImgRef} type="file" accept="image/*" onChange={onEditImg} className="hidden" />
              {chatMode === "edit" && editImage && (
                <div className="flex items-center gap-2 mb-1 text-xs bg-[var(--oji-surface)] border border-[var(--oji-border)] rounded-lg px-2 py-1 w-max">
                  <img src={`data:${editImage.mediaType};base64,${editImage.data}`} alt="مرجع" className="w-7 h-7 rounded object-cover" />
                  <span className="text-[var(--oji-muted)]">صورة مرجعية مرفقة</span>
                  <button onClick={() => setEditImage(null)} className="text-red-300 hover:text-red-200">✕</button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <VoiceButton onText={(t) => setInput((p) => (p ? p + " " + t : t))} />
                {chatMode === "edit" && (
                  <button type="button" onClick={() => editImgRef.current?.click()} title="أرفق صورة مرجعية للتعديل" className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border border-[var(--oji-border)] text-[var(--oji-muted)] hover:text-white hover:border-[var(--oji-primary)] transition">🖼️</button>
                )}
                <button onClick={onSend} disabled={loading || !input.trim() || (chatMode === "edit" && !html)} className={`flex-1 py-2 rounded-lg font-bold text-sm disabled:opacity-40 transition text-[#06121f] ${chatMode === "chat" ? "bg-gradient-to-l from-[var(--oji-accent)] to-[#7c5cff]" : "bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)]"}`}>
                  {chatMode === "chat" ? "إرسال 💬" : selected ? "عدّل المحدد بالذكاء" : "إرسال التعديل"}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className={`flex-1 flex-col min-w-0 bg-[var(--oji-bg)] ${mobileView === "work" ? "flex" : "hidden"} lg:flex`}>
          <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--oji-border)]">
            {(["preview", "code"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm flex items-center gap-2 ${tab === t ? "bg-[var(--oji-surface-2)] font-bold" : "text-[var(--oji-muted)] hover:text-white"}`}>
                {t === "preview" ? "المعاينة" : "الكود"}
                {t === "code" && loading && <span className="w-1.5 h-1.5 rounded-full bg-[var(--oji-primary)] animate-pulse" />}
              </button>
            ))}
            {editMode && tab === "preview" && (
              <span className="text-xs text-[var(--oji-accent)] truncate">وضع التعديل — انقر على أي عنصر</span>
            )}
            {tab === "preview" && (
              <div className="ms-auto flex rounded-lg border border-[var(--oji-border)] overflow-hidden text-sm shrink-0">
                <button onClick={() => setDevice("desktop")} title="كمبيوتر" className={`px-2.5 py-1 ${device === "desktop" ? "bg-[var(--oji-surface-2)]" : "text-[var(--oji-muted)] hover:text-white"}`}>🖥️</button>
                <button onClick={() => setDevice("phone")} title="فون" className={`px-2.5 py-1 ${device === "phone" ? "bg-[var(--oji-surface-2)]" : "text-[var(--oji-muted)] hover:text-white"}`}>📱</button>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {tab === "preview" ? (
              (editMode ? editDoc : previewHtml) ? (
                <div className={device === "phone" ? "h-full flex justify-center p-3 overflow-auto scroll-touch" : "h-full"}>
                  <iframe
                    ref={editMode ? iframeRef : undefined}
                    key={editMode ? "editor" : "preview"}
                    title="preview"
                    srcDoc={editMode ? editDoc : withSiteRuntime(previewHtml)}
                    sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy={editMode ? undefined : "no-referrer"}
                    className={`bg-white ${device === "phone" ? "w-[390px] max-w-full h-full rounded-[2rem] border-4 border-[var(--oji-surface-2)] shadow-2xl" : "w-full h-full"}`}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--oji-muted)]">{loading ? "جارٍ بناء موقعك..." : "لا يوجد محتوى بعد"}</div>
              )
            ) : (
              <textarea value={html} onChange={(e) => updateCode(e.target.value)} dir="ltr" spellCheck={false} className="w-full h-full bg-[#0a0f1c] text-[#c8d3e6] font-mono text-xs p-4 outline-none resize-none" />
            )}
          </div>
        </main>
      </div>

      {/* Add section / block / banner — opened from the "+" rails in the preview */}
      {insertOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={closeInsert}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto scroll-touch bg-[var(--oji-surface)] border border-[var(--oji-border)] rounded-t-2xl sm:rounded-2xl p-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold">➕ أضف قسمًا أو بلوك أو بانر</h3>
              <button onClick={closeInsert} className="text-[var(--oji-muted)] hover:text-white text-lg leading-none">✕</button>
            </div>

            <div className="text-xs text-[var(--oji-muted)] mb-2">أقسام جاهزة (تُضاف فورًا ثم عدّلها يدويًا):</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {LIB.map((it) => (
                <button
                  key={it.id}
                  onClick={() => insertLibrary(it)}
                  className="px-3 py-2.5 rounded-xl border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] hover:bg-[var(--oji-surface-2)] transition text-right"
                >
                  {it.emoji} {it.title}
                </button>
              ))}
            </div>

            <div className="border-t border-[var(--oji-border)] pt-3">
              <div className="text-xs text-[var(--oji-muted)] mb-2">أو اوصف اللي محتاجه والذكاء ينفّذه في نفس المكان بالمقاس المناسب:</div>
              <textarea
                value={insertDesc}
                onChange={(e) => setInsertDesc(e.target.value)}
                placeholder="مثال: بانر ترويجي لأفضل متجر إلكترونيات مع زر «تسوّق الآن»، أو قسم عرض 4 منتجات بالأسعار..."
                className="w-full h-20 bg-[var(--oji-surface-2)] border border-[var(--oji-border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--oji-primary)] resize-none mb-2"
              />
              <div className="flex items-center gap-2">
                <VoiceButton onText={(t) => setInsertDesc((p) => (p ? p + " " + t : t))} />
                <button
                  onClick={() => startAiInsert("section")}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-[#06121f] bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] transition"
                >
                  🧩 أضف قسم بالذكاء
                </button>
                <button
                  onClick={() => startAiInsert("banner")}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-[#06121f] bg-gradient-to-l from-[var(--oji-accent)] to-[#7c5cff] transition"
                >
                  🖼️ أضف بانر/صورة
                </button>
              </div>
              <p className="text-[10px] text-[var(--oji-muted)] mt-2 leading-relaxed">
                البانر يُنشأ بالذكاء (Nano Banana) بمقاس عريض متجاوب. القسم يُبنى بنفس ألوان موقعك وعرض الأقسام المجاورة تمامًا.
              </p>
            </div>
          </div>
        </div>
      )}

      {insertBusy && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[var(--oji-surface)] border border-[var(--oji-border)] text-sm shadow-2xl">
          {insertBusy}
        </div>
      )}
    </div>
  );
}
