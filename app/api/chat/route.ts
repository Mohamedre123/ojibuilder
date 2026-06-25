import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/anthropic";
import { MODEL_IDS, DEFAULT_MODEL } from "@/lib/models";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const maxDuration = 60;

const CHAT_PROMPT = `أنت "مساعد oji builder" — وكيل ذكي تتناقش مع العميل حول موقعه.
- تجيب على أسئلته، تنصحه، تقترح أفكارًا وتحسينات، وتشرح الخيارات.
- لا تُخرج كودًا كاملًا — أنت في وضع **النقاش**، تتكلم بالعربية بإيجاز ووضوح.
- إن أراد تنفيذ شيء، انصحه أن يكتب الطلب في وضع "تعديل" ليُطبَّق على الموقع.
- استند إلى الموقع الحالي إن كان مرفقًا.`;

interface Msg { role: "user" | "assistant"; content: string }

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "مفتاح ANTHROPIC_API_KEY غير مضبوط" }, { status: 500 });
  }
  const rl = rateLimit(`chat:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "طلبات كثيرة جدًا" }, { status: 429 });

  const { message, html, history, model: reqModel } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });
  }
  const model = MODEL_IDS.includes(reqModel) ? reqModel : DEFAULT_MODEL;

  const msgs: Msg[] = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.trim()) {
        msgs.push({ role: h.role, content: h.content.slice(0, 2000) });
      }
    }
  }
  const ctx = html ? `\n\n(لمعلوماتك، كود الموقع الحالي مختصرًا:\n${String(html).slice(0, 6000)} )` : "";
  msgs.push({ role: "user", content: message + ctx });
  // Ensure the first message is from the user.
  while (msgs.length && msgs[0].role !== "user") msgs.shift();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ai = client.messages.stream({ model, max_tokens: 1500, system: CHAT_PROMPT, messages: msgs });
        for await (const event of ai) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const m = err instanceof Error ? err.message : "خطأ";
        controller.enqueue(encoder.encode(`\n<!--OJI_ERROR:${m}-->`));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
