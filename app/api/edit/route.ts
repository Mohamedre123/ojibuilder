import { NextRequest, NextResponse } from "next/server";
import { client, MODELS, extractHtml } from "@/lib/anthropic";
import { EDIT_SYSTEM_PROMPT } from "@/lib/prompts";
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

    if (process.env.APP_ACCESS_PASSWORD) {
      if (req.headers.get("x-oji-key") !== process.env.APP_ACCESS_PASSWORD) {
        return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
      }
    }

    const rl = rateLimit(`edit:${clientIp(req)}`, 25, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، انتظر قليلًا ثم حاول مجددًا" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const { html, instruction, mode } = await req.json();
    if (!html || !instruction) {
      return NextResponse.json(
        { error: "الكود الحالي وطلب التعديل مطلوبان" },
        { status: 400 }
      );
    }
    if (
      typeof html !== "string" ||
      typeof instruction !== "string" ||
      html.length > LIMITS.MAX_HTML_CHARS ||
      instruction.length > LIMITS.MAX_INSTRUCTION_CHARS
    ) {
      return NextResponse.json({ error: "المحتوى كبير جدًا" }, { status: 413 });
    }

    const model = mode === "opus" ? MODELS.opus : MODELS.auto;

    const msg = await client.messages.create({
      model,
      max_tokens: 16000,
      system: EDIT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `المستند الحالي:\n\n${html}\n\n---\n\nطلب التعديل: ${instruction}`,
        },
      ],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    const updated = extractHtml(text);
    return NextResponse.json({ html: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
