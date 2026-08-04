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
  legacy?: boolean; // shown under "موديلات أخرى" instead of the main row
}

export const MODELS: ModelOption[] = [
  // ---- current generation ----
  { id: "claude-opus-5", label: "Opus 5", tagline: "الأقوى — أفضل جودة للمواقع والتطبيقات المعقّدة", inPrice: 5, outPrice: 25, speed: "💎 الأقوى", badge: "💎" },
  { id: "claude-sonnet-5", label: "Sonnet 5", tagline: "جودة قريبة من Opus بسعر أقل", inPrice: 3, outPrice: 15, speed: "🚀 سريع وقوي", badge: "✨" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", tagline: "الأسرع والأوفر", inPrice: 1, outPrice: 5, speed: "⚡ أسرع", badge: "⚡" },
  // ---- previous generations (اختيارية) ----
  { id: "claude-opus-4-8", label: "Opus 4.8", tagline: "الجيل السابق من Opus", inPrice: 5, outPrice: 25, speed: "💎 قوي", badge: "💎", legacy: true },
  { id: "claude-opus-4-7", label: "Opus 4.7", tagline: "Opus أقدم", inPrice: 5, outPrice: 25, speed: "💎 قوي", badge: "💎", legacy: true },
  { id: "claude-opus-4-6", label: "Opus 4.6", tagline: "Opus أقدم", inPrice: 5, outPrice: 25, speed: "💎 قوي", badge: "💎", legacy: true },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", tagline: "الجيل السابق من Sonnet", inPrice: 3, outPrice: 15, speed: "🚀 سريع", badge: "⚖️", legacy: true },
  // ملاحظة: claude-fable-5 غير مُضاف عمدًا — يتطلب احتفاظ بيانات 30 يومًا (لا يعمل تحت ZDR)
  // وسعره أعلى بكثير ($10/$50)، فيسبّب أخطاء على الحسابات التي لا تدعمه.
];

export const MAIN_MODELS = MODELS.filter((m) => !m.legacy);
export const LEGACY_MODELS = MODELS.filter((m) => m.legacy);

export const DEFAULT_MODEL = "claude-haiku-4-5";

// Models where thinking is ON by default server-side. Our routes stream a full
// document within a 60s function limit, so thinking would eat the token budget
// and risk truncation — disable it (allowed at the default `high` effort).
const THINKS_BY_DEFAULT = new Set(["claude-opus-5", "claude-sonnet-5"]);

// Extra request params to merge into messages.stream() for a given model.
export function modelParams(id: string): Record<string, unknown> {
  return THINKS_BY_DEFAULT.has(id) ? { thinking: { type: "disabled" } } : {};
}
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
