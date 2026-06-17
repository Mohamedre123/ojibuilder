import { NextRequest, NextResponse } from "next/server";
import { client, MODELS, extractHtml } from "@/lib/anthropic";
import { GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "مفتاح ANTHROPIC_API_KEY غير مضبوط" },
        { status: 500 }
      );
    }

    // Optional gate: if APP_ACCESS_PASSWORD is set, require it (header x-oji-key).
    if (process.env.APP_ACCESS_PASSWORD) {
      if (req.headers.get("x-oji-key") !== process.env.APP_ACCESS_PASSWORD) {
        return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
      }
    }

    // Rate limit: 15 generations per minute per IP.
    const rl = rateLimit(`gen:${clientIp(req)}`, 15, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، انتظر قليلًا ثم حاول مجددًا" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const { prompt, mode } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "الوصف مطلوب" }, { status: 400 });
    }
    if (prompt.length > LIMITS.MAX_PROMPT_CHARS) {
      return NextResponse.json({ error: "الوصف طويل جدًا" }, { status: 413 });
    }

    const model = mode === "opus" ? MODELS.opus : MODELS.auto;

    const msg = await client.messages.create({
      model,
      max_tokens: 16000,
      system: GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `ابنِ هذا الموقع:\n\n${prompt}` }],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    const html = extractHtml(text);
    return NextResponse.json({ html });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
