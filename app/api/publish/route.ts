import { NextRequest, NextResponse } from "next/server";
import { savePublished } from "@/lib/store";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

export const maxDuration = 30;

function makeId(): string {
  // Time + counter based, no Math.random needed.
  const t = Date.now().toString(36);
  return `s${t}${(globalThis.__ojiSeq = ((globalThis.__ojiSeq as number) || 0) + 1).toString(36)}`;
}
declare global {
  // eslint-disable-next-line no-var
  var __ojiSeq: number | undefined;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`publish:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "طلبات كثيرة جدًا" }, { status: 429 });

  const { html, id } = await req.json();
  if (!html || typeof html !== "string" || html.length > LIMITS.MAX_HTML_CHARS) {
    return NextResponse.json({ error: "محتوى غير صالح" }, { status: 400 });
  }
  const siteId = (typeof id === "string" && id) ? id.replace(/[^a-z0-9-]/gi, "") : makeId();
  try {
    await savePublished(siteId, html);
    return NextResponse.json({ id: siteId, path: `/s/${siteId}` });
  } catch {
    return NextResponse.json({ error: "تعذّر النشر" }, { status: 500 });
  }
}
