import type { ModelSpec } from "./providers";
import { isProviderConfigured } from "./providers";

/**
 * The ensemble.
 *
 * Single-model skin triage is unreliable in a way that is hard to see from the
 * outside: the model is fluent and confident regardless of whether it is right.
 * Running several independent models and looking at their *disagreement* gives
 * us something a single model cannot — a usable signal for "this one is hard,
 * send it to a human".
 *
 * Order matters: cheaper, faster models first so a partial ensemble under load
 * still returns something sensible.
 */
export const ENSEMBLE: ModelSpec[] = [
  { id: "gemini-flash", provider: "gemini", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gpt-4o", provider: "openai", model: "gpt-4o", label: "GPT-4o" },
  { id: "claude-sonnet", provider: "anthropic", model: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  {
    id: "qwen-vl",
    provider: "openrouter",
    model: "qwen/qwen2.5-vl-72b-instruct",
    label: "Qwen2.5-VL 72B",
  },
];

/** Fallbacks used when a primary model errors, keyed by the model it replaces. */
export const FALLBACKS: Record<string, ModelSpec> = {
  "gemini-flash": { id: "gemini-3-flash", provider: "gemini", model: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  "gpt-4o": { id: "gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", label: "GPT-4o mini" },
  "qwen-vl": {
    id: "llama-vision",
    provider: "openrouter",
    model: "meta-llama/llama-3.2-90b-vision-instruct",
    label: "Llama 3.2 90B Vision",
  },
};

export function availableModels(): ModelSpec[] {
  const models = ENSEMBLE.filter((m) => isProviderConfigured(m.provider));
  // At least two independent opinions, otherwise "agreement" is meaningless and
  // we say so in the UI rather than pretending we ran an ensemble.
  return models;
}

export function modelSetId(models: ModelSpec[]): string {
  return models.map((m) => m.id).sort().join("+") || "none";
}
