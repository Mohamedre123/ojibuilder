import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 4, // resilience against transient connection errors
  timeout: 280_000,
});

// Models for oji builder. "auto" favors speed; "opus" favors quality.
export const MODELS = {
  // Highest quality (slower) — "متقدّم".
  opus: "claude-opus-4-8",
  // Fast default — "تلقائي". Haiku generates HTML much faster per token.
  auto: "claude-haiku-4-5-20251001",
} as const;

// Strip any stray markdown fences / prose so the iframe only ever sees pure HTML.
export function extractHtml(raw: string): string {
  let out = raw.trim();
  const fence = out.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) out = fence[1].trim();
  const start = out.indexOf("<!DOCTYPE");
  const startAlt = out.indexOf("<!doctype");
  const idx = start !== -1 ? start : startAlt;
  if (idx > 0) out = out.slice(idx);
  return out.trim();
}
