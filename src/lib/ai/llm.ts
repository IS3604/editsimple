import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

/**
 * Text provider abstraction. Groq and OpenAI both expose an OpenAI-compatible
 * Chat Completions API with JSON mode, so one client covers both.
 * Candidates are tried in order; a retired/unavailable model (404) or provider outage
 * falls through to the next candidate instead of failing the whole pipeline.
 */
type Candidate = { client: OpenAI; model: string; name: "groq" | "openai" };

// Groq retires models often (llama-3.3-70b-versatile shut down Aug 2026). Keep fallbacks current.
const GROQ_FALLBACKS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

function candidates(prefer?: "groq" | "openai"): Candidate[] {
  const groq = env.groqKey ? new OpenAI({ apiKey: env.groqKey, baseURL: "https://api.groq.com/openai/v1", timeout: 60_000 }) : null;
  const openai = env.openaiKey ? new OpenAI({ apiKey: env.openaiKey, timeout: 60_000 }) : null;
  const groqList: Candidate[] = groq
    ? [...new Set([env.groqModel, ...GROQ_FALLBACKS])].map((model) => ({ client: groq, model, name: "groq" as const }))
    : [];
  const openaiList: Candidate[] = openai ? [{ client: openai, model: env.openaiTextModel, name: "openai" }] : [];
  const order = (prefer ?? env.textProvider) === "openai" ? [...openaiList, ...groqList] : [...groqList, ...openaiList];
  if (!order.length) throw new HttpError(503, "No text provider configured. Set GROQ_API_KEY or OPENAI_API_KEY.");
  return order;
}

export const isSkippable = (e: unknown) => {
  const status = (e as { status?: number })?.status;
  return status === 404 || status === 400 || status === 429 || status === 503 || (status ?? 0) >= 500;
};

export function parseLoose(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

export async function chatJSON<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
  prefer?: "groq" | "openai";
  /** reasoning depth for gpt-oss models; "medium" for writing, "low" for quick helpers */
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  let lastErr = "";
  for (const c of candidates(opts.prefer)) {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const params: Record<string, unknown> = {
          model: c.model,
          temperature: opts.temperature ?? 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: opts.system + "\nRespond with a single valid JSON object only." },
            { role: "user", content: attempt === 0 ? opts.user : `${opts.user}\n\nYour previous output was invalid: ${lastErr}. Fix it.` },
          ],
        };
        // gpt-oss models on Groq are reasoning models — low effort keeps them fast
        if (c.name === "groq" && c.model.startsWith("openai/gpt-oss")) params.reasoning_effort = opts.effort ?? "low";
        const res = await c.client.chat.completions.create(params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
        const raw = res.choices[0]?.message?.content ?? "";
        try {
          const parsed = opts.schema.safeParse(parseLoose(raw));
          if (parsed.success) return parsed.data;
          lastErr = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 600);
        } catch {
          lastErr = "not valid JSON";
        }
      }
    } catch (e) {
      lastErr = `${c.name}:${c.model} → ${(e as Error).message}`;
      console.warn("[llm] candidate failed", lastErr);
      if (!isSkippable(e)) throw e;
    }
  }
  throw new HttpError(502, `Text generation failed (${lastErr})`);
}
