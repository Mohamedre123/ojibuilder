import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Latest, most capable models for oji builder.
export const MODELS = {
  // High quality generation (mirrors stunning's "Opus" mode).
  opus: "claude-opus-4-8",
  // Fast default (mirrors stunning's "Auto" mode).
  auto: "claude-sonnet-4-6",
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
