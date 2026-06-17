import { NextRequest, NextResponse } from "next/server";
import { saveProject } from "@/lib/store";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

export const maxDuration = 30;

function makeId(): string {
  const t = Date.now().toString(36);
  globalThis.__ojiPSeq = ((globalThis.__ojiPSeq as number) || 0) + 1;
  return `p${t}${globalThis.__ojiPSeq.toString(36)}`;
}
declare global {
  // eslint-disable-next-line no-var
  var __ojiPSeq: number | undefined;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`proj:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "طلبات كثيرة جدًا" }, { status: 429 });

  const { id, html, title } = await req.json();
  if (!html || typeof html !== "string" || html.length > LIMITS.MAX_HTML_CHARS) {
    return NextResponse.json({ error: "محتوى غير صالح" }, { status: 400 });
  }
  const projectId = typeof id === "string" && id ? id.replace(/[^a-z0-9-]/gi, "") : makeId();
  try {
    await saveProject(projectId, {
      html,
      title: (typeof title === "string" && title.trim()) || "مشروع بدون اسم",
      updatedAt: Date.now(),
    });
    return NextResponse.json({ id: projectId });
  } catch {
    return NextResponse.json({ error: "تعذّر الحفظ" }, { status: 500 });
  }
}
