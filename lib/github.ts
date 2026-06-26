export type GhFiles = Record<string, string>;

export interface GhResult {
  url: string;
  login: string;
  repo: string;
  count: number;
}

export async function ghPush(
  files: GhFiles,
  opts: { token: string; repo: string; message?: string; private?: boolean }
): Promise<GhResult> {
  const res = await fetch("/api/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: opts.token, repo: opts.repo, files, message: opts.message, private: opts.private }),
  });
  const data = await res.json().catch(() => ({ error: "استجابة غير صالحة" }));
  if (!res.ok) throw new Error(data.error || "تعذّر الرفع على GitHub");
  return data as GhResult;
}

// Small localStorage-backed store for the client's GitHub connection.
export const ghStore = {
  token: () => (typeof localStorage !== "undefined" ? localStorage.getItem("oji:gh:token") || "" : ""),
  repo: () => (typeof localStorage !== "undefined" ? localStorage.getItem("oji:gh:repo") || "" : ""),
  auto: () => (typeof localStorage !== "undefined" ? localStorage.getItem("oji:gh:auto") === "1" : false),
  set(k: "token" | "repo" | "auto", v: string) {
    try {
      localStorage.setItem("oji:gh:" + k, v);
    } catch {
      /* ignore */
    }
  },
};
