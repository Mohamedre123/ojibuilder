import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/anthropic";
import { MODEL_IDS, DEFAULT_MODEL } from "@/lib/models";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

export const maxDuration = 30;

const SUGGEST_PROMPT = `أنت مساعد في "oji builder". يصلك كود موقع HTML حالي.
اقترح **من 3 إلى 5 تحسينات محدّدة وعملية** مناسبة لهذا الموقع بالذات (مثل: قسم ناقص، تحسين بصري، ميزة مفيدة) — كل اقتراح جملة قصيرة قابلة للتنفيذ مباشرةً كأمر تعديل.
أخرج **JSON فقط**: {"suggestions": ["...", "..."]} بدون أي نص آخر.`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ suggestions: [] });
  const rl = rateLimit(`suggest:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ suggestions: [] });

  const { html, model: reqModel } = await req.json();
  if (!html || typeof html !== "string") return NextResponse.json({ suggestions: [] });
  const model = MODEL_IDS.includes(reqModel) ? reqModel : DEFAULT_MODEL;

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 500,
      system: SUGGEST_PROMPT,
      messages: [{ role: "user", content: `الموقع الحالي:\n${html.slice(0, LIMITS.MAX_HTML_CHARS)}` }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    let suggestions: string[] = [];
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions.filter((s: unknown) => typeof s === "string").slice(0, 5);
      }
    }
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
