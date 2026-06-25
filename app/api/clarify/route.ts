import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/anthropic";
import { MODEL_IDS, DEFAULT_MODEL } from "@/lib/models";
import { CLARIFY_SYSTEM_PROMPT } from "@/lib/prompts";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

export const maxDuration = 30;

// Returns up to 3 clarifying questions (or none) for a vague idea.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ questions: [] });
  }
  const rl = rateLimit(`clarify:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return NextResponse.json({ questions: [] });

  const { prompt, model: reqModel } = await req.json();
  if (!prompt || typeof prompt !== "string" || prompt.length > LIMITS.MAX_PROMPT_CHARS) {
    return NextResponse.json({ questions: [] });
  }
  // A detailed prompt rarely needs clarification — skip to keep things fast.
  if (prompt.trim().length > 240) return NextResponse.json({ questions: [] });

  const model = MODEL_IDS.includes(reqModel) ? reqModel : DEFAULT_MODEL;
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 500,
      system: CLARIFY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    let questions: string[] = [];
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed.questions)) {
        questions = parsed.questions.filter((q: unknown) => typeof q === "string").slice(0, 3);
      }
    }
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ questions: [] });
  }
}
