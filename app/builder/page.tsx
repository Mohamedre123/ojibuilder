"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ChatMsg {
  role: "user" | "system";
  text: string;
}

type Mode = "auto" | "opus";
type Tab = "preview" | "code";

export default function Builder() {
  const router = useRouter();
  const [html, setHtml] = useState("");
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

  // On mount: pick up the prompt from the landing page and generate.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const savedHtml = sessionStorage.getItem("oji:html");
    const prompt = sessionStorage.getItem("oji:prompt");

    if (savedHtml) {
      setHtml(savedHtml);
      return;
    }
    if (!prompt) {
      router.push("/");
      return;
    }
    setMessages([{ role: "user", text: prompt }]);
    generate(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(prompt: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التوليد");
      setHtml(data.html);
      sessionStorage.setItem("oji:html", data.html);
      setMessages((m) => [...m, { role: "system", text: "تم بناء موقعك! يمكنك الآن طلب أي تعديل." }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  async function sendEdit() {
    const instruction = input.trim();
    if (!instruction || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: instruction }]);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, instruction, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التعديل");
      setHtml(data.html);
      sessionStorage.setItem("oji:html", data.html);
      setMessages((m) => [...m, { role: "system", text: "تم تطبيق التعديل ✓" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  function updateCode(value: string) {
    setHtml(value);
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
      {/* Top bar */}
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
        {/* Chat panel */}
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
                جارٍ العمل على موقعك...
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

        {/* Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--oji-bg)]">
          <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--oji-border)]">
            {(["preview", "code"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm ${tab === t ? "bg-[var(--oji-surface-2)] font-bold" : "text-[var(--oji-muted)] hover:text-white"}`}
              >
                {t === "preview" ? "المعاينة" : "الكود"}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            {tab === "preview" ? (
              html ? (
                <iframe
                  title="preview"
                  srcDoc={html}
                  className="w-full h-full bg-white"
                  sandbox="allow-scripts allow-forms"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--oji-muted)]">
                  {loading ? "جارٍ بناء موقعك لأول مرة..." : "لا يوجد محتوى بعد"}
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
