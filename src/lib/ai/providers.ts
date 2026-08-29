/**
 * Thin vision-model adapters.
 *
 * Three wire formats cover every provider we use: OpenAI-compatible
 * /chat/completions (OpenAI, Groq, OpenRouter, NVIDIA NIM), Google's
 * generateContent, and Anthropic's /v1/messages. Each adapter takes the same
 * input and returns raw text, which the caller parses as JSON.
 *
 * Nothing here knows anything about dermatology — that lives in triage.ts.
 */

export interface VisionRequest {
  system: string;
  prompt: string;
  /** base64 image payloads, without the data: prefix */
  images: { base64: string; mime: string }[];
  maxTokens?: number;
  /** 0 for the feature-extraction pass; we want repeatable descriptions. */
  temperature?: number;
  signal?: AbortSignal;
}

export type ProviderId = "openai" | "gemini" | "anthropic" | "openrouter" | "groq" | "nvidia";

const TIMEOUT_MS = 45_000;

function withTimeout(signal?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const t = withTimeout(signal);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: t.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
    return JSON.parse(text);
  } finally {
    t.done();
  }
}

/** OpenAI-compatible chat completions. Used by four of the six providers. */
async function openAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  req: VisionRequest,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const content: unknown[] = [{ type: "text", text: req.prompt }];
  for (const img of req.images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mime};base64,${img.base64}` },
    });
  }

  const json = await postJson(
    `${baseUrl}/chat/completions`,
    { Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    {
      model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content },
      ],
      max_completion_tokens: req.maxTokens ?? 1600,
      temperature: req.temperature ?? 0,
      response_format: { type: "json_object" },
    },
    req.signal,
  );

  return json?.choices?.[0]?.message?.content ?? "";
}

async function gemini(apiKey: string, model: string, req: VisionRequest): Promise<string> {
  const parts: unknown[] = [{ text: req.prompt }];
  for (const img of req.images) {
    parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
  }

  const json = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { "x-goog-api-key": apiKey },
    {
      system_instruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: req.temperature ?? 0,
        maxOutputTokens: req.maxTokens ?? 1600,
        responseMimeType: "application/json",
      },
      // Medical imagery trips the default filters; we still want a refusal to
      // surface as an error rather than a silently empty answer.
      safetySettings: [
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
      ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
    },
    req.signal,
  );

  const cand = json?.candidates?.[0];
  if (!cand) throw new Error(`gemini: no candidate (${JSON.stringify(json?.promptFeedback ?? {}).slice(0, 200)})`);
  return (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

async function anthropic(apiKey: string, model: string, req: VisionRequest): Promise<string> {
  const content: unknown[] = [];
  for (const img of req.images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mime, data: img.base64 },
    });
  }
  content.push({ type: "text", text: req.prompt });

  const json = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    {
      model,
      system: req.system,
      max_tokens: req.maxTokens ?? 1600,
      temperature: req.temperature ?? 0,
      messages: [{ role: "user", content }],
    },
    req.signal,
  );

  return (json?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

export interface ModelSpec {
  /** Stable id we store in the DB so an assessment stays reproducible. */
  id: string;
  provider: ProviderId;
  model: string;
  label: string;
}

export function isProviderConfigured(p: ProviderId): boolean {
  switch (p) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "gemini":
      return !!process.env.GEMINI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY;
    case "groq":
      return !!process.env.GROQ_API_KEY;
    case "nvidia":
      return !!process.env.NVIDIA_API_KEY;
  }
}

export async function callVision(spec: ModelSpec, req: VisionRequest): Promise<string> {
  switch (spec.provider) {
    case "openai":
      return openAiCompatible("https://api.openai.com/v1", process.env.OPENAI_API_KEY!, spec.model, req);
    case "groq":
      return openAiCompatible("https://api.groq.com/openai/v1", process.env.GROQ_API_KEY!, spec.model, req);
    case "nvidia":
      return openAiCompatible("https://integrate.api.nvidia.com/v1", process.env.NVIDIA_API_KEY!, spec.model, req);
    case "openrouter":
      return openAiCompatible("https://openrouter.ai/api/v1", process.env.OPENROUTER_API_KEY!, spec.model, req, {
        "HTTP-Referer": "https://skinscan.6x7.gr",
        "X-Title": "SkinScan",
      });
    case "gemini":
      return gemini(process.env.GEMINI_API_KEY!, spec.model, req);
    case "anthropic":
      return anthropic(process.env.ANTHROPIC_API_KEY!, spec.model, req);
  }
}

/** Models sometimes wrap JSON in prose or a fence despite being asked not to. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in model output");
    return JSON.parse(body.slice(start, end + 1));
  }
}
