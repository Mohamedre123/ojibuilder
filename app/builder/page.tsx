"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ChatMsg {
  role: "user" | "system";
  text: string;
}

type Mode = "auto" | "opus";
type Tab = "preview" | "code";

// Strip stray markdown fences / error markers and trim to the real document.
function cleanHtml(raw: string): string {
  let out = raw.replace(/<!--OJI_ERROR:[\s\S]*?-->/g, "");
  out = out.replace(/```html\s*/gi, "").replace(/```/g, "");
  const i = out.search(/<!doctype html/i);
  if (i > 0) out = out.slice(i);
  return out;
}

export default function Builder() {
  const router = useRouter();
  const [html, setHtml] = useState(""); // live code (updates every chunk)
  const [previewHtml, setPreviewHtml] = useState(""); // throttled preview source
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [tab, setTab] = useState<Tab>("preview");
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    streamRequest("/api/generate", { prompt, mode }, "تم بناء موقعك! اطلب أي تعديل الآن.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Core streaming loop: reads the response chunk-by-chunk so the code
  // is typed live, then reveals the finished preview.
  async function streamRequest(
    url: string,
    body: Record<string, unknown>,
    doneMsg: string
  ) {
    setLoading(true);
    setError("");
    setTab("code"); // watch the code being written
    let buf = "";
    let lastPreview = 0;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({ error: "فشل الطلب" }));
        throw new Error(d.error || "فشل الطلب");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const clean = cleanHtml(buf);
        setHtml(clean);
        const now = Date.now();
        if (now - lastPreview > 500) {
          setPreviewHtml(clean);
          lastPreview = now;
        }
      }
      const errMatch = buf.match(/<!--OJI_ERROR:([\s\S]*?)-->/);
      if (errMatch) throw new Error(errMatch[1]);

      const finalHtml = cleanHtml(buf);
      setHtml(finalHtml);
      setPreviewHtml(finalHtml);
      sessionStorage.setItem("oji:html", finalHtml);
      setTab("preview"); // reveal the result
      setMessages((m) => [...m, { role: "system", text: doneMsg }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  function sendEdit() {
    const instruction = input.trim();
    if (!instruction || loading || !html) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: instruction }]);
    streamRequest("/api/edit", { html, instruction, mode }, "تم تطبيق التعديل ✓");
  }

  function updateCode(value: string) {
    setHtml(value);
    setPreviewHtml(value);
    sessionStorage.setItem("oji:html", value);
  }

  function download() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oji-site.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  function openNewTab() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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
          <div className="flex rounded-lg border border-[var(--oji-border)] overflow-hidden text-xs">
            <button
              onClick={() => setMode("auto")}
              className={`px-3 py-1.5 ${mode === "auto" ? "bg-[var(--oji-primary)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}
            >
              تلقائي
            </button>
            <button
              onClick={() => setMode("opus")}
              className={`px-3 py-1.5 ${mode === "opus" ? "bg-[var(--oji-accent)] text-[#06121f] font-bold" : "text-[var(--oji-muted)]"}`}
            >
              متقدّم
            </button>
          </div>
          <button onClick={openNewTab} disabled={!html} className="px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-primary)] disabled:opacity-40 transition">
            معاينة ↗
          </button>
          <button onClick={download} disabled={!html} className="px-3 py-1.5 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm disabled:opacity-40 transition">
            تنزيل
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-[340px] shrink-0 border-l border-[var(--oji-border)] bg-[var(--oji-surface)] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--oji-surface-2)] border border-[var(--oji-border)]"
                    : "bg-[var(--oji-primary)]/10 border border-[var(--oji-primary)]/30 text-[var(--oji-text)]"
                }`}
              >
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
              <div className="rounded-2xl px-4 py-2.5 text-sm bg-red-500/10 border border-red-500/40 text-red-300">
                {error}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-[var(--oji-border)]">
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
                placeholder="اطلب تعديلًا: «غيّر الألوان للأزرق» أو «أضف قسم أسعار»..."
                className="w-full h-16 bg-transparent resize-none outline-none px-2 py-1 text-sm placeholder:text-[var(--oji-muted)]"
              />
              <button
                onClick={sendEdit}
                disabled={loading || !input.trim() || !html}
                className="w-full mt-1 py-2 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm disabled:opacity-40 transition"
              >
                إرسال التعديل
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-[var(--oji-bg)]">
          <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--oji-border)]">
            {(["preview", "code"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm flex items-center gap-2 ${tab === t ? "bg-[var(--oji-surface-2)] font-bold" : "text-[var(--oji-muted)] hover:text-white"}`}
              >
                {t === "preview" ? "المعاينة" : "الكود"}
                {t === "code" && loading && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--oji-primary)] animate-pulse" />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            {tab === "preview" ? (
              previewHtml ? (
                <iframe
                  title="preview"
                  srcDoc={previewHtml}
                  className="w-full h-full bg-white"
                  sandbox="allow-scripts allow-forms"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--oji-muted)]">
                  {loading ? "جارٍ بناء موقعك..." : "لا يوجد محتوى بعد"}
                </div>
              )
            ) : (
              <textarea
                value={html}
                onChange={(e) => updateCode(e.target.value)}
                dir="ltr"
                spellCheck={false}
                className="w-full h-full bg-[#0a0f1c] text-[#c8d3e6] font-mono text-xs p-4 outline-none resize-none"
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
