import { NextRequest, NextResponse } from "next/server";
import { client, MODELS, extractHtml } from "@/lib/anthropic";
import { GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "مفتاح ANTHROPIC_API_KEY غير مضبوط في ملف .env.local" },
        { status: 500 }
      );
    }

    const { prompt, mode } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "الوصف مطلوب" }, { status: 400 });
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
