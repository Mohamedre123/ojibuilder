import { NextRequest, NextResponse } from "next/server";
import { client, MODELS, extractHtml } from "@/lib/anthropic";
import { EDIT_SYSTEM_PROMPT } from "@/lib/prompts";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "مفتاح ANTHROPIC_API_KEY غير مضبوط في ملف .env.local" },
        { status: 500 }
      );
    }

    const { html, instruction, mode } = await req.json();
    if (!html || !instruction) {
      return NextResponse.json(
        { error: "الكود الحالي وطلب التعديل مطلوبان" },
        { status: 400 }
      );
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
