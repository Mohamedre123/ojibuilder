// Selectable Claude models with accurate pricing (USD per 1M tokens).
// Source: claude-api reference. Used for the model picker + cost estimates.
export interface ModelOption {
  id: string;
  label: string;
  tagline: string;
  inPrice: number; // $ / 1M input tokens
  outPrice: number; // $ / 1M output tokens
  speed: string; // user-facing speed hint
  badge: string;
}

export const MODELS: ModelOption[] = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5", tagline: "الأسرع والأوفر", inPrice: 1, outPrice: 5, speed: "⚡ أسرع", badge: "⚡" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", tagline: "توازن السرعة والجودة", inPrice: 3, outPrice: 15, speed: "🚀 سريع", badge: "⚖️" },
  { id: "claude-opus-4-8", label: "Opus 4.8", tagline: "جودة عالية", inPrice: 5, outPrice: 25, speed: "💎 متقدّم", badge: "💎" },
  { id: "claude-fable-5", label: "Fable 5", tagline: "الأقوى على الإطلاق", inPrice: 10, outPrice: 50, speed: "🌟 الأقوى", badge: "🚀" },
];

export const DEFAULT_MODEL = "claude-haiku-4-5";
export const MODEL_IDS = MODELS.map((m) => m.id);

export function findModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}

export function estimateCost(inTokens: number, outTokens: number, modelId: string): string {
  const m = findModel(modelId);
  if (!m) return "";
  const cost = (inTokens / 1e6) * m.inPrice + (outTokens / 1e6) * m.outPrice;
  const total = (inTokens + outTokens).toLocaleString("en-US");
  return `${total} توكن · ~$${cost.toFixed(4)}`;
}
