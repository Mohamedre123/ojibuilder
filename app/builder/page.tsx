"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MODELS, DEFAULT_MODEL, estimateCost } from "@/lib/models";
import { useUser } from "@/lib/supabase/useUser";
import { getSupabase } from "@/lib/supabase/client";

interface ChatMsg {
  role: "user" | "system";
  text: string;
}
interface Selected {
  tag: string;
  html: string;
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
</style>
<script id="__oji_edit_js">
(function(){
  var sel=null;
  function isNav(el){ return el && el.closest && el.closest('a,nav,button,[data-nav],[data-page]'); }
  document.addEventListener('mouseover',function(e){ if(e.target&&e.target.classList&&e.target!==document.body) e.target.classList.add('__oji_hl'); },true);
  document.addEventListener('mouseout',function(e){ if(e.target&&e.target.classList) e.target.classList.remove('__oji_hl'); },true);
  document.addEventListener('click',function(e){
    var t=e.target;
    if(isNav(t)){ return; }
    e.preventDefault(); e.stopPropagation();
    if(sel){ sel.classList.remove('__oji_sel'); sel.removeAttribute('contenteditable'); }
    sel=t; sel.classList.add('__oji_sel');
    if(sel.tagName!=='IMG'){ sel.setAttribute('contenteditable','true'); sel.focus(); }
    parent.postMessage({__oji:1,type:'select',tag:sel.tagName,html:sel.outerHTML},'*');
  },true);
  document.addEventListener('input',function(){ sync(); },true);
  function clean(node){
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
  window.addEventListener('message',function(ev){
    var d=ev.data||{}; if(!d.__oji)return;
    if(d.type==='delete'&&sel){ sel.remove(); sel=null; sync(); }
    if(d.type==='replaceImg'&&sel&&sel.tagName==='IMG'){ sel.src=d.url; sync(); }
    if(d.type==='insertImg'){ var img=document.createElement('img'); img.src=d.url; img.alt=''; img.style.maxWidth='100%'; img.style.borderRadius='12px'; (sel||document.body).appendChild(img); sync(); }
    if(d.type==='style'&&sel){ if(d.scope==='phone'){ applyResp(sel,d.prop,d.value); } else { try{ sel.style.setProperty(d.prop, d.value, 'important'); }catch(e){} } sync(); }
    if(d.type==='font'&&sel){ var cur=parseFloat(getComputedStyle(sel).fontSize)||16; var ns=Math.max(8,Math.min(120,cur+d.delta)); if(d.scope==='phone'){ applyResp(sel,'font-size',ns+'px'); } else { sel.style.setProperty('font-size',ns+'px','important'); } sync(); }
    if(d.type==='toggleClass'&&sel){ d.cls.split(' ').forEach(function(c){ if(c) sel.classList.toggle(c); }); sync(); }
  });
})();
</script>
`;
function injectEditor(doc: string): string {
  if (doc.includes("</body>")) return doc.replace("</body>", EDITOR_RUNTIME + "</body>");
  return doc + EDITOR_RUNTIME;
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
  const seedRef = useRef<{ prompt: string; image: ImageSeed | null; lang: string }>({ prompt: "", image: null, lang: "ar" });
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
      } else if (d.type === "select") {
        setSelected({ tag: d.tag, html: d.html });
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
    seedRef.current = { prompt, image, lang };
    setMessages([{ role: "user", text: image ? `🖼️ بناء من صورة — ${prompt}` : prompt }]);
    // For image-based builds, skip clarification (the image carries the intent).
    if (image) generateSite();
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

  async function generateSite() {
    lastReqRef.current = { kind: "site" };
    const { prompt, image, lang } = seedRef.current;
    const ac = beginRequest();
    const timeout = setTimeout(() => ac.abort(), 290_000);
    try {
      setMessages((m) => [...m, { role: "system", text: "⏳ أبني الهيكل والصفحة الرئيسية..." }]);
      let lastP = 0;
      let totIn = 0;
      let totOut = 0;
      const shellRaw = await streamText(
        { prompt, model, step: "shell", image, lang },
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

      const pages = parsePages(current);
      const toFill = pages.filter((p) => isSectionEmpty(current, p.id));
      for (const pg of toFill) {
        setMessages((m) => [...m, { role: "system", text: `⏳ أبني صفحة: ${pg.title}...` }]);
        const innerRaw = await streamText(
          { prompt, model, step: "page", pageId: pg.id, pageTitle: pg.title, context: current, lang },
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
      commit(current);
      setMessages((m) => [
        ...m,
        { role: "system", text: "تم بناء موقعك بالكامل ✓ اطلب أي تعديل، أو فعّل التعديل اليدوي، أو انشره." },
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
        body: JSON.stringify({ html: htmlRef.current, instruction, model }),
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
      const finalHtml = cleanHtml(buf);
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
    } catch (e) {
      setError(mapError(e));
      setTab(htmlRef.current ? "preview" : "code");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
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
      instruction = `ركّز التعديل على هذا العنصر تحديدًا داخل الموقع، وأعد المستند كاملًا:\n${selected.html}\n\nالمطلوب: ${text}`;
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
          html: cleanHtml(html),
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
          body: JSON.stringify({ id: current || undefined, html: cleanHtml(html), title }),
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

  function toApk() {
    if (publishedIdRef.current) {
      router.push(`/apk?url=${encodeURIComponent(window.location.origin + "/s/" + publishedIdRef.current)}`);
    } else {
      alert("انشر الموقع أولًا بزر «🚀 نشر» ليصبح له رابط، أو أدخل الرابط يدويًا في صفحة التحويل.");
      router.push("/apk");
    }
  }

  async function publish() {
    if (!html || publishing) return;
    if (!requireLogin()) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: cleanHtml(html) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر النشر");
      publishedIdRef.current = data.id;
      const fullUrl = window.location.origin + data.path;
      setMessages((m) => [...m, { role: "system", text: `🚀 تم النشر! الرابط: ${fullUrl}\nتقدر دلوقتي تربط نطاقك الخاص من زر «🌐 دومين».` }]);
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
    const blob = new Blob([cleanHtml(html)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oji-site.html";
    a.click();
    URL.revokeObjectURL(url);
  }
  function openNewTab() {
    const blob = new Blob([cleanHtml(html)], { type: "text/html;charset=utf-8" });
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
          <button onClick={toApk} disabled={!html} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-accent)] disabled:opacity-40 transition whitespace-nowrap">📦 APK</button>
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
              <input ref={editFileRef} type="file" accept="image/*" onChange={onEditFile} className="hidden" />
              {selected && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={deleteSelected} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-red-500 hover:text-red-300 transition">🗑 حذف</button>
                    <button onClick={replaceImageUrl} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-primary)] transition">🔗 صورة برابط</button>
                  </div>
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
              <button onClick={onSend} disabled={loading || !input.trim() || (chatMode === "edit" && !html)} className={`w-full mt-1 py-2 rounded-lg font-bold text-sm disabled:opacity-40 transition text-[#06121f] ${chatMode === "chat" ? "bg-gradient-to-l from-[var(--oji-accent)] to-[#7c5cff]" : "bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)]"}`}>
                {chatMode === "chat" ? "إرسال 💬" : selected ? "عدّل المحدد بالذكاء" : "إرسال التعديل"}
              </button>
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
                    srcDoc={editMode ? editDoc : previewHtml}
                    sandbox="allow-scripts allow-forms"
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
    </div>
  );
}
