import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

/**
 * Text provider abstraction. Groq and OpenAI both expose an OpenAI-compatible
 * Chat Completions API with JSON mode, so one client covers both.
 * Swap providers with TEXT_PROVIDER; add new ones by returning another {client, model}.
 */
function textClient(prefer?: "groq" | "openai") {
  const p = prefer ?? env.textProvider;
  if (p === "groq" && env.groqKey)
    return {
      client: new OpenAI({ apiKey: env.groqKey, baseURL: "https://api.groq.com/openai/v1", timeout: 45_000 }),
      model: env.groqModel,
      name: "groq",
    };
  if (env.openaiKey)
    return { client: new OpenAI({ apiKey: env.openaiKey, timeout: 60_000 }), model: env.openaiTextModel, name: "openai" };
  if (env.groqKey)
    return {
      client: new OpenAI({ apiKey: env.groqKey, baseURL: "https://api.groq.com/openai/v1", timeout: 45_000 }),
      model: env.groqModel,
      name: "groq",
    };
  throw new HttpError(503, "No text provider configured. Set GROQ_API_KEY or OPENAI_API_KEY.");
}

export async function chatJSON<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
  prefer?: "groq" | "openai";
}): Promise<T> {
  const { client, model } = textClient(opts.prefer);
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat.completions.create({
      model,
      temperature: opts.temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system + "\nRespond with a single valid JSON object only." },
        {
          role: "user",
          content: attempt === 0 ? opts.user : `${opts.user}\n\nYour previous output was invalid: ${lastErr}. Fix it.`,
        },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      const parsed = opts.schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      lastErr = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 600);
    } catch {
      lastErr = "not valid JSON";
    }
  }
  throw new HttpError(502, `Model returned unusable output (${lastErr})`);
}
