import { NextRequest, NextResponse } from "next/server";
import { client, MODELS } from "@/lib/anthropic";
import { GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "مفتاح ANTHROPIC_API_KEY غير مضبوط" }, { status: 500 });
  }
  if (process.env.APP_ACCESS_PASSWORD) {
    if (req.headers.get("x-oji-key") !== process.env.APP_ACCESS_PASSWORD) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    }
  }
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ai = client.messages.stream({
          model,
          max_tokens: 16000,
          system: GENERATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: `ابنِ هذا الموقع:\n\n${prompt}` }],
        });
        for await (const event of ai) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "خطأ في التوليد";
        controller.enqueue(encoder.encode(`\n<!--OJI_ERROR:${message}-->`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
