import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const maxDuration = 30;

// Fetches a public URL and returns a compact text summary to seed generation.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`extract:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "طلبات كثيرة جدًا" }, { status: 429 });
  }

  let { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "الرابط مطلوب" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ojibuilder/1.0)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`تعذّر الوصول للرابط (${res.status})`);
    const raw = await res.text();

    const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
    const desc = (raw.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "").trim();
    const headings = Array.from(raw.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .slice(0, 25);
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);

    const summary = `العنوان: ${title}\nالوصف: ${desc}\nأبرز العناوين: ${headings.join(" | ")}\n\nمقتطف من المحتوى: ${text}`;
    return NextResponse.json({ summary, title });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر قراءة الرابط";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
