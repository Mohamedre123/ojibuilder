"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ChatMsg {
  role: "user" | "system";
  text: string;
}
interface Selected {
  tag: string;
  html: string;
}

type Mode = "auto" | "opus";
type Tab = "preview" | "code";

// ---- helpers ---------------------------------------------------------------

function cleanHtml(raw: string): string {
  let out = raw.replace(/<!--OJI_ERROR:[\s\S]*?-->/g, "");
  out = out.replace(/```html\s*/gi, "").replace(/```/g, "");
  const i = out.search(/<!doctype html/i);
  if (i > 0) out = out.slice(i);
  // strip any leftover editor runtime, just in case
  out = out
    .replace(/<style id="__oji_edit">[\s\S]*?<\/style>/g, "")
    .replace(/<script id="__oji_edit_js">[\s\S]*?<\/script>/g, "");
  return out;
}

// Runtime injected into the preview iframe to enable click-to-edit.
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
  });
})();
</script>
`;

function injectEditor(doc: string): string {
  if (doc.includes("</body>")) return doc.replace("</body>", EDITOR_RUNTIME + "</body>");
  return doc + EDITOR_RUNTIME;
}

// ---- component -------------------------------------------------------------

export default function Builder() {
  const router = useRouter();
  const [html, setHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [tab, setTab] = useState<Tab>("preview");
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editDoc, setEditDoc] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);

  const startedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastReqRef = useRef<{ url: string; body: Record<string, unknown>; doneMsg: string } | null>(null);
  const htmlRef = useRef("");
  htmlRef.current = html;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Receive edits coming back from inside the preview iframe.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data;
      if (!d || !d.__oji) return;
      if (d.type === "update" && typeof d.html === "string") {
        const c = cleanHtml(d.html);
        setHtml(c);
        sessionStorage.setItem("oji:html", c);
      } else if (d.type === "select") {
        setSelected({ tag: d.tag, html: d.html });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const savedHtml = sessionStorage.getItem("oji:html");
    const prompt = sessionStorage.getItem("oji:prompt");
    if (savedHtml) {
      setHtml(savedHtml);
      setPreviewHtml(savedHtml);
      return;
    }
    if (!prompt) {
      router.push("/");
      return;
    }
    setMessages([{ role: "user", text: prompt }]);
    streamRequest("/api/generate", { prompt, mode }, "تم بناء موقعك! اطلب أي تعديل، أو فعّل التعديل اليدوي.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function streamRequest(url: string, body: Record<string, unknown>, doneMsg: string) {
    lastReqRef.current = { url, body, doneMsg };
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const timeout = setTimeout(() => ac.abort(), 180_000);

    setLoading(true);
    setError("");
    if (editMode) {
      setEditMode(false);
      setSelected(null);
    }
    setTab("code");

    let buf = "";
    let lastPreview = 0;
    let gotChunk = false;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({ error: `فشل الطلب (${res.status})` }));
        throw new Error(d.error || `فشل الطلب (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        gotChunk = true;
        buf += decoder.decode(value, { stream: true });
        const clean = cleanHtml(buf);
        setHtml(clean);
        const now = Date.now();
        if (now - lastPreview > 400) {
          setPreviewHtml(clean);
          lastPreview = now;
        }
      }
      const errMatch = buf.match(/<!--OJI_ERROR:([\s\S]*?)-->/);
      if (errMatch) throw new Error(errMatch[1]);
      if (!gotChunk || !buf.trim()) throw new Error("لم يصل أي محتوى من الخادم");

      const finalHtml = cleanHtml(buf);
      setHtml(finalHtml);
      setPreviewHtml(finalHtml);
      sessionStorage.setItem("oji:html", finalHtml);
      setTab("preview");
      setMessages((m) => [...m, { role: "system", text: doneMsg }]);
    } catch (e) {
      let msg: string;
      if (e instanceof DOMException && e.name === "AbortError") {
        msg = "استغرق الطلب وقتًا طويلًا أو أُلغي. جرّب مجددًا.";
      } else if (e instanceof TypeError) {
        msg = "خطأ في الاتصال — تأكد أن الخادم يعمل ومن وجود مفتاح/رصيد Anthropic، ثم أعد المحاولة.";
      } else {
        msg = e instanceof Error ? e.message : "خطأ غير متوقع";
      }
      setError(msg);
      setTab(htmlRef.current ? "preview" : "code");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  function retry() {
    const r = lastReqRef.current;
    if (r) streamRequest(r.url, r.body, r.doneMsg);
  }

  function sendEdit() {
    const text = input.trim();
    if (!text || loading || !html) return;
    setInput("");
    let instruction = text;
    if (selected) {
      instruction = `ركّز التعديل على هذا العنصر تحديدًا داخل الموقع، وأعد المستند كاملًا:\n${selected.html}\n\nالمطلوب: ${text}`;
    }
    setMessages((m) => [
      ...m,
      { role: "user", text: selected ? `🎯 (على العنصر المحدد) ${text}` : text },
    ]);
    streamRequest("/api/edit", { html, instruction, mode }, "تم تطبيق التعديل ✓");
  }

  function updateCode(value: string) {
    setHtml(value);
    setPreviewHtml(value);
    sessionStorage.setItem("oji:html", value);
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
  function replaceImage() {
    const url = window.prompt("رابط الصورة الجديدة:");
    if (url) iframePost({ type: "replaceImg", url });
  }
  function insertImage() {
    const url = window.prompt("رابط الصورة المراد إضافتها:");
    if (url) iframePost({ type: "insertImg", url });
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
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--oji-border)] bg-[var(--oji-surface)]">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition">
            ← الرئيسية
          </button>
          <span className="font-extrabold">oji <span className="oji-gradient-text">builder</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleEdit}
            disabled={!html || loading}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-40 ${
              editMode ? "bg-[var(--oji-accent)] text-[#06121f]" : "border border-[var(--oji-border)] hover:border-[var(--oji-accent)]"
            }`}
          >
            {editMode ? "إنهاء التعديل اليدوي ✓" : "✏️ تعديل يدوي"}
          </button>
          <div className="flex rounded-lg border border-[var(--oji-border)] overflow-hidden text-xs">
            <button onClick={() => setMode("auto")} className={`px-3 py-1.5 ${mode === "auto" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>
              تلقائي
            </button>
            <button onClick={() => setMode("opus")} className={`px-3 py-1.5 ${mode === "opus" ? "bg-[var(--oji-accent)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}>
              متقدّم
            </button>
          </div>
          <button onClick={openNewTab} disabled={!html} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] disabled:opacity-40 transition">
            معاينة ↗
          </button>
          <button onClick={download} disabled={!html} className="px-3 py-1.5 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm disabled:opacity-40 transition">
            تنزيل الموقع
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-[340px] shrink-0 border-l border-[var(--oji-border)] bg-[var(--oji-surface)] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-[var(--oji-surface-2)] border border-[var(--oji-border)]" : "bg-[var(--oji-primary)]/10 border border-[var(--oji-primary)]/30 text-[var(--oji-text)]"}`}>
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
                <button onClick={retry} disabled={loading} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-bold transition">
                  إعادة المحاولة ↻
                </button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Manual-edit toolbar for the selected element */}
          {editMode && (
            <div className="px-3 pt-3 border-t border-[var(--oji-border)] space-y-2">
              <div className="text-xs text-[var(--oji-muted)]">
                {selected ? `العنصر المحدد: <${selected.tag.toLowerCase()}>` : "انقر على أي جزء في المعاينة لتحديده وتعديله"}
              </div>
              {selected && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={deleteSelected} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-red-500 hover:text-red-300 transition">🗑 حذف</button>
                  <button onClick={replaceImage} className="px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-primary)] transition">🖼 استبدال صورة</button>
                </div>
              )}
              <button onClick={insertImage} className="w-full px-2 py-1.5 rounded-lg border border-[var(--oji-border)] text-xs hover:border-[var(--oji-primary)] transition">➕ إضافة صورة / بانر</button>
            </div>
          )}

          <div className="p-3 border-t border-[var(--oji-border)]">
            {selected && (
              <div className="flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg bg-[var(--oji-accent)]/15 border border-[var(--oji-accent)]/40 text-xs">
                <span>🎯 التعديل على: &lt;{selected.tag.toLowerCase()}&gt;</span>
                <button onClick={() => setSelected(null)} className="hover:text-white">✕</button>
              </div>
            )}
            <div className="rounded-xl bg-[var(--oji-surface-2)] border border-[var(--oji-border)] p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendEdit();
                  }
                }}
                placeholder={selected ? "اطلب تعديل العنصر المحدد بالذكاء..." : "اطلب تعديلًا: «غيّر الألوان للأزرق»، «أضف صفحة أسعار»، «أضف لوجو»..."}
                className="w-full h-16 bg-transparent resize-none outline-none px-2 py-1 text-sm placeholder:text-[var(--oji-muted)]"
              />
              <button onClick={sendEdit} disabled={loading || !input.trim() || !html} className="w-full mt-1 py-2 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm disabled:opacity-40 transition">
                {selected ? "عدّل المحدد بالذكاء" : "إرسال التعديل"}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-[var(--oji-bg)]">
          <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--oji-border)]">
            {(["preview", "code"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm flex items-center gap-2 ${tab === t ? "bg-[var(--oji-surface-2)] font-bold" : "text-[var(--oji-muted)] hover:text-white"}`}>
                {t === "preview" ? "المعاينة" : "الكود"}
                {t === "code" && loading && <span className="w-1.5 h-1.5 rounded-full bg-[var(--oji-primary)] animate-pulse" />}
              </button>
            ))}
            {editMode && tab === "preview" && (
              <span className="ms-auto text-xs text-[var(--oji-accent)]">وضع التعديل اليدوي مُفعّل — انقر على أي عنصر</span>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {tab === "preview" ? (
              editMode ? (
                <iframe ref={iframeRef} title="editor" srcDoc={editDoc} className="w-full h-full bg-white" sandbox="allow-scripts allow-forms" />
              ) : previewHtml ? (
                <iframe title="preview" srcDoc={previewHtml} className="w-full h-full bg-white" sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--oji-muted)]">
                  {loading ? "جارٍ بناء موقعك..." : "لا يوجد محتوى بعد"}
                </div>
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
