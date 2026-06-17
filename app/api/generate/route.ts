import { NextRequest, NextResponse } from "next/server";
import { client, MODELS } from "@/lib/anthropic";
import { SHELL_SYSTEM_PROMPT, PAGE_SYSTEM_PROMPT } from "@/lib/prompts";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "مفتاح ANTHROPIC_API_KEY غير مضبوط" }, { status: 500 });
  }
  if (process.env.APP_ACCESS_PASSWORD) {
    if (req.headers.get("x-oji-key") !== process.env.APP_ACCESS_PASSWORD) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    }
  }
  const rl = rateLimit(`gen:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "طلبات كثيرة جدًا، انتظر قليلًا ثم حاول مجددًا" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const { prompt, mode, step, pageId, pageTitle, context, image, lang } = await req.json();
  if (!prompt || typeof prompt !== "string" || prompt.length > LIMITS.MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: "الوصف مطلوب أو طويل جدًا" }, { status: 400 });
  }

  const model = mode === "opus" ? MODELS.opus : MODELS.auto;
  const langNote =
    lang === "en"
      ? "\n\nاجعل كل محتوى الموقع باللغة الإنجليزية و<html lang=\"en\" dir=\"ltr\">."
      : "";

  let system: string;
  let userContent: string;
  if (step === "page") {
    system = PAGE_SYSTEM_PROMPT;
    userContent = `وصف الموقع الأصلي: ${prompt}\n\nالهيكل الحالي للموقع (للاتساق في الألوان والطابع):\n${String(context || "").slice(0, LIMITS.MAX_HTML_CHARS)}\n\n---\nابنِ المحتوى الداخلي للصفحة ذات data-page="${pageId}" وعنوانها "${pageTitle}".${langNote}`;
  } else {
    system = SHELL_SYSTEM_PROMPT;
    userContent = image
      ? `ابنِ هيكل موقع وصفحة رئيسية مستوحاة من هذا التصميم/الصورة المرفقة، مع تحسينه وجعله احترافيًا. ملاحظات إضافية: ${prompt}${langNote}`
      : `ابنِ هيكل الموقع والصفحة الرئيسية لهذا الطلب:\n\n${prompt}${langNote}`;
  }

  // Optional image input (vision) for the shell step.
  type Block =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };
  const userBlocks: Block[] = [];
  if (image && image.data && image.mediaType && step !== "page") {
    userBlocks.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  userBlocks.push({ type: "text", text: userContent });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ai = client.messages.stream({
          model,
          max_tokens: 8000,
          system,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: [{ role: "user", content: userBlocks as any }],
        });
        for await (const event of ai) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
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
