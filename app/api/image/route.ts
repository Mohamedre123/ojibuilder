import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Image/banner generation via Google Gemini ("Nano Banana"). Returns a hosted
// URL (Vercel Blob) when configured, otherwise a base64 data URL. Never logs
// or returns the API key. Set GEMINI_API_KEY in the environment.
export const maxDuration = 60;

const DEFAULT_MODELS = [
  "gemini-3-pro-image-preview", // Nano Banana 2 / Pro
  "gemini-2.5-flash-image", // Nano Banana (GA)
  "gemini-2.5-flash-image-preview",
];

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "مفتاح GEMINI_API_KEY غير مضبوط" }, { status: 500 });
  }
  const rl = rateLimit(`img:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "طلبات كثيرة، انتظر قليلًا" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } });
  }

  let body: { prompt?: string; aspect?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const desc = String(body.prompt || "").slice(0, 800).trim();
  if (!desc) return NextResponse.json({ error: "وصف الصورة مطلوب" }, { status: 400 });

  const aspect = typeof body.aspect === "string" ? body.aspect : "";
  const prompt = `${desc}. تصميم احترافي عالي الجودة مناسب لموقع ويب، ألوان متناسقة، إضاءة نظيفة، بدون نصوص مكتوبة إلا إذا طُلب صراحةً${aspect ? `، بنسبة أبعاد ${aspect}` : ""}.`;

  const models = [process.env.GEMINI_IMAGE_MODEL, ...DEFAULT_MODELS].filter(Boolean) as string[];
  let lastErr = "";

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = data?.error?.message || `فشل الطلب (${res.status})`;
        // Model not found / not enabled → try the next candidate.
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
      const inline = img?.inlineData || img?.inline_data;
      if (!inline?.data) {
        lastErr = "لم تُرجَع صورة";
        continue;
      }
      const mime = inline.mimeType || inline.mime_type || "image/png";
      const b64 = inline.data as string;

      // Prefer hosting on Vercel Blob so the HTML stays small; fall back to data URL.
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const { put } = await import("@vercel/blob");
          const buf = Buffer.from(b64, "base64");
          const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
          const { url: blobUrl } = await put(`oji-images/${crypto.randomUUID()}.${ext}`, buf, {
            access: "public",
            contentType: mime,
          });
          return NextResponse.json({ url: blobUrl });
        } catch {
          // fall through to data URL
        }
      }
      return NextResponse.json({ url: `data:${mime};base64,${b64}` });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "خطأ في الاتصال";
    }
  }

  return NextResponse.json({ error: lastErr || "تعذّر إنشاء الصورة" }, { status: 502 });
}
