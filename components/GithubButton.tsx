"use client";

import { useEffect, useState } from "react";
import { ghPush, ghStore, type GhFiles } from "@/lib/github";

// Connect-and-push-to-GitHub control. The client pastes its own Personal
// Access Token (repo scope); it's kept only in this browser (localStorage).
export default function GithubButton({
  files,
  defaultRepo = "oji-site",
  className = "",
}: {
  files: () => GhFiles;
  defaultRepo?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(defaultRepo);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setToken(ghStore.token());
    setRepo(ghStore.repo() || defaultRepo);
    setAuto(ghStore.auto());
  }, [defaultRepo]);

  async function push() {
    const t = token.trim();
    const r = repo.trim();
    if (!t) { setStatus("الصق التوكن أولًا."); return; }
    if (!r) { setStatus("اكتب اسم المستودع."); return; }
    const map = files();
    if (!Object.keys(map).length) { setStatus("لا يوجد محتوى للرفع بعد."); return; }
    setBusy(true);
    setStatus("جارٍ الرفع على GitHub...");
    setUrl("");
    try {
      ghStore.set("token", t);
      ghStore.set("repo", r);
      const res = await ghPush(map, { token: t, repo: r, message: "Update from oji builder" });
      setUrl(res.url);
      setStatus(`تم رفع ${res.count} ملف ✓`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "تعذّر الرفع");
    } finally {
      setBusy(false);
    }
  }

  function toggleAuto() {
    const v = !auto;
    setAuto(v);
    ghStore.set("auto", v ? "1" : "0");
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`px-3 py-1.5 rounded-lg border border-[var(--oji-border)] text-sm hover:border-[var(--oji-accent)] transition whitespace-nowrap ${className}`}
      >
        ⬆️ GitHub
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 left-0 w-72 max-w-[88vw] rounded-xl bg-[var(--oji-surface)] border border-[var(--oji-border)] shadow-2xl p-3 text-right space-y-2">
            <div className="text-sm font-bold">رفع ومزامنة على GitHub</div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              dir="ltr"
              placeholder="GitHub Token (repo scope)"
              className="w-full bg-[var(--oji-surface-2)] border border-[var(--oji-border)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[var(--oji-primary)]"
            />
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              dir="ltr"
              placeholder="repo-name"
              className="w-full bg-[var(--oji-surface-2)] border border-[var(--oji-border)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[var(--oji-primary)]"
            />
            <label className="flex items-center gap-2 text-xs text-[var(--oji-muted)] cursor-pointer">
              <input type="checkbox" checked={auto} onChange={toggleAuto} className="accent-[var(--oji-primary)]" />
              مزامنة تلقائية بعد كل تعديل
            </label>
            <button
              onClick={push}
              disabled={busy}
              className="w-full py-2 rounded-lg font-bold text-sm text-[#06121f] bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] disabled:opacity-50 transition"
            >
              {busy ? "...جارٍ الرفع" : "رفع الآن ⬆️"}
            </button>
            {status && <div className="text-xs text-[var(--oji-muted)]">{status}</div>}
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[var(--oji-accent)] underline break-all" dir="ltr">
                {url}
              </a>
            )}
            <p className="text-[10px] leading-relaxed text-[var(--oji-muted)]">
              أنشئ التوكن من GitHub → Settings → Developer settings → Personal access tokens (صلاحية <b>repo</b>). يُحفظ في متصفحك فقط. بعد الرفع اربط المستودع باستضافة مثل Vercel للنشر التلقائي.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
