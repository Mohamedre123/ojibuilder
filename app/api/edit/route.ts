import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/anthropic";
import { MODEL_IDS, DEFAULT_MODEL } from "@/lib/models";
import { EDIT_SYSTEM_PROMPT } from "@/lib/prompts";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

// 60s fits Vercel Hobby. On Pro you can raise this to 300.
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
  const rl = rateLimit(`edit:${clientIp(req)}`, 25, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "طلبات كثيرة جدًا، انتظر قليلًا ثم حاول مجددًا" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const { html, instruction, model: reqModel } = await req.json();
  if (!html || !instruction) {
    return NextResponse.json({ error: "الكود الحالي وطلب التعديل مطلوبان" }, { status: 400 });
  }
  if (
    typeof html !== "string" ||
    typeof instruction !== "string" ||
    html.length > LIMITS.MAX_HTML_CHARS ||
    instruction.length > LIMITS.MAX_INSTRUCTION_CHARS
  ) {
    return NextResponse.json({ error: "المحتوى كبير جدًا" }, { status: 413 });
  }

  const model = MODEL_IDS.includes(reqModel) ? reqModel : DEFAULT_MODEL;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let usageIn = 0;
      let usageOut = 0;
      try {
        const ai = client.messages.stream({
          model,
          max_tokens: 16000,
          system: EDIT_SYSTEM_PROMPT,
          messages: [
            { role: "user", content: `المستند الحالي:\n\n${html}\n\n---\n\nطلب التعديل: ${instruction}` },
          ],
        });
        for await (const event of ai) {
          if (event.type === "message_start") {
            usageIn = event.message.usage?.input_tokens ?? 0;
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          } else if (event.type === "message_delta") {
            usageOut = event.usage?.output_tokens ?? usageOut;
          }
        }
        controller.enqueue(encoder.encode(`\n<!--OJI_USAGE:${usageIn},${usageOut}-->`));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "خطأ في التعديل";
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
