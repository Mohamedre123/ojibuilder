import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const GH = "https://api.github.com";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "oji-builder",
  };
}

// Push generated files to a GitHub repo (creates the repo if missing).
// The client passes its own Personal Access Token (repo scope) — we never store it.
export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    repo?: string;
    files?: Record<string, string>;
    message?: string;
    private?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const token = (body.token || "").trim();
  const repo = (body.repo || "").trim().replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
  const files = body.files || {};
  const message = body.message || "Update from oji builder";

  if (!token) return NextResponse.json({ error: "أدخل GitHub Token (صلاحية repo)" }, { status: 400 });
  if (!repo) return NextResponse.json({ error: "اسم المستودع مطلوب" }, { status: 400 });
  const paths = Object.keys(files);
  if (!paths.length) return NextResponse.json({ error: "لا توجد ملفات للرفع" }, { status: 400 });

  try {
    // 1) Verify token & get the username.
    const userRes = await fetch(`${GH}/user`, { headers: headers(token) });
    if (!userRes.ok) {
      return NextResponse.json(
        { error: userRes.status === 401 ? "التوكن غير صالح أو منتهي" : `تعذّر التحقق من GitHub (${userRes.status})` },
        { status: 400 }
      );
    }
    const login = (await userRes.json()).login as string;

    // 2) Ensure the repo exists (create it if not).
    const repoRes = await fetch(`${GH}/repos/${login}/${repo}`, { headers: headers(token) });
    if (repoRes.status === 404) {
      const create = await fetch(`${GH}/user/repos`, {
        method: "POST",
        headers: { ...headers(token), "Content-Type": "application/json" },
        body: JSON.stringify({ name: repo, private: !!body.private, auto_init: true, description: "أنشئ بواسطة oji builder" }),
      });
      if (!create.ok) {
        const d = await create.json().catch(() => ({}));
        return NextResponse.json({ error: d.message || "تعذّر إنشاء المستودع" }, { status: 400 });
      }
      // auto_init commits a README; give GitHub a tick to settle the default branch.
      await new Promise((r) => setTimeout(r, 1200));
    } else if (!repoRes.ok) {
      return NextResponse.json({ error: `تعذّر الوصول للمستودع (${repoRes.status})` }, { status: 400 });
    }

    // 3) Commit each file (create or update by sha).
    for (const path of paths) {
      const clean = path.replace(/^\/+/, "");
      const getRes = await fetch(`${GH}/repos/${login}/${repo}/contents/${encodeURIComponent(clean).replace(/%2F/g, "/")}`, {
        headers: headers(token),
      });
      let sha: string | undefined;
      if (getRes.ok) {
        const d = await getRes.json();
        sha = Array.isArray(d) ? undefined : d.sha;
      }
      const put = await fetch(`${GH}/repos/${login}/${repo}/contents/${encodeURIComponent(clean).replace(/%2F/g, "/")}`, {
        method: "PUT",
        headers: { ...headers(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          content: Buffer.from(files[path] ?? "", "utf8").toString("base64"),
          ...(sha ? { sha } : {}),
        }),
      });
      if (!put.ok) {
        const d = await put.json().catch(() => ({}));
        return NextResponse.json({ error: `تعذّر رفع ${clean}: ${d.message || put.status}` }, { status: 400 });
      }
    }

    return NextResponse.json({ url: `https://github.com/${login}/${repo}`, login, repo, count: paths.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ في الاتصال بـ GitHub" }, { status: 500 });
  }
}
