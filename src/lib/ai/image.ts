import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export type GeneratedImage = { bytes: Buffer; mime: string; width: number; height: number; provider: string };

/**
 * OpenAI retires image models often (gpt-image-1 shut down 23 Oct 2026; 1-mini / 1.5 follow on 1 Dec 2026).
 * We try the configured model first, then these current ones, so a retirement never breaks generation.
 */
export const IMAGE_FALLBACKS = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2"];

export function imageCandidates(configured: string) {
  return [...new Set([configured, ...IMAGE_FALLBACKS].filter(Boolean))];
}

/** Model is gone or not available to this account → try the next one. */
export function isModelUnavailable(e: unknown) {
  const err = e as { status?: number; code?: string; message?: string };
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.status === 404 ||
    err.code === "model_not_found" ||
    (err.status === 400 && /model|does not exist|not supported|deprecated|retired/.test(msg)) ||
    (err.status === 403 && /model|verif/.test(msg))
  );
}

/** A request option the model doesn't accept (e.g. output_format) → retry with plain params. */
export function isBadParam(e: unknown) {
  const err = e as { status?: number; code?: string; message?: string; param?: string };
  return err.status === 400 && (err.code === "unknown_parameter" || err.code === "invalid_value" || !!err.param || /parameter|output_format|output_compression|quality/i.test(err.message ?? ""));
}

/** OpenAI's safety system refused the prompt (medical/aesthetic words like injections can trip it). */
export function isSafetyRejection(e: unknown) {
  const err = e as { status?: number; code?: string; message?: string };
  return err.status === 400 && (err.code === "moderation_blocked" || /safety system|content policy|moderation/i.test(err.message ?? ""));
}

/** A calm, generic scene that passes safety checks — used when the specific prompt is refused. */
export function safeFallbackPrompt(niche: "medical" | "legal" | string | null | undefined, palette = "") {
  const scene =
    niche === "legal"
      ? "a bright modern law office meeting table with a notebook, pen and a cup of coffee, soft daylight, nobody in frame"
      : "a bright, modern skincare clinic consultation room with a few elegant unbranded skincare bottles on a marble counter and a green plant, soft daylight, nobody in frame";
  return `Realistic editorial photograph of ${scene}. Calm, premium, uncluttered.${palette ? ` Colour mood harmonised with ${palette}.` : ""}`;
}

/** Detects the format from the bytes rather than trusting the request. */
export function sniffMime(b: Buffer) {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return "image/png";
}

/**
 * Image provider abstraction. Only generates text-free backgrounds/illustrations —
 * all slide text is rendered by the app, never by the model.
 */
export async function generateBackground(prompt: string, aspect: "portrait" | "square" | "landscape", fallbackPrompt?: string): Promise<GeneratedImage> {
  try {
    return await generateOnce(prompt, aspect);
  } catch (e) {
    // Refused by the safety system → try once more with a calm, generic scene instead of failing the post.
    if (fallbackPrompt && isSafetyRejection(e)) {
      console.warn("[image] prompt refused by safety system, using fallback scene");
      return generateOnce(fallbackPrompt, aspect);
    }
    throw e;
  }
}

async function generateOnce(prompt: string, aspect: "portrait" | "square" | "landscape"): Promise<GeneratedImage> {
  if (env.imageProvider === "none") throw new HttpError(400, "Image generation is turned off (IMAGE_PROVIDER=none).");
  if (!env.openaiKey) throw new HttpError(503, "Add OPENAI_API_KEY to create images.");

  const client = new OpenAI({ apiKey: env.openaiKey, timeout: 120_000 });
  const size = aspect === "portrait" ? "1024x1536" : aspect === "landscape" ? "1536x1024" : "1024x1024";
  const [w, h] = size.split("x").map(Number);
  const fullPrompt =
    `${prompt}\n\nStrict rules: absolutely no text, letters, numbers, logos, watermarks or UI. ` +
    `Leave generous calm negative space so overlaid typography stays readable. Editorial, high quality.`;

  let lastErr: unknown = null;
  for (const model of imageCandidates(env.openaiImageModel)) {
    // JPEG keeps files ~5× smaller — faster previews and under Vercel's 4.5 MB response cap
    const attempts: Record<string, unknown>[] = [
      // moderation "low" = OpenAI's less strict (still safe) setting, so ordinary skincare/clinic scenes aren't refused
      { model, prompt: fullPrompt, size, n: 1, output_format: "jpeg", output_compression: 88, quality: env.openaiImageQuality, moderation: "low" },
      { model, prompt: fullPrompt, size, n: 1 },
    ];
    for (const params of attempts) {
      try {
        const res = (await client.images.generate(params as unknown as OpenAI.Images.ImageGenerateParams)) as OpenAI.Images.ImagesResponse;
        const item = res.data?.[0];
        let bytes: Buffer | null = null;
        if (item?.b64_json) bytes = Buffer.from(item.b64_json, "base64");
        else if (item?.url) bytes = Buffer.from(await (await fetch(item.url)).arrayBuffer());
        if (!bytes?.length) throw new HttpError(502, "The image service returned no image.");
        return { bytes, mime: sniffMime(bytes), width: w, height: h, provider: `openai:${model}` };
      } catch (e) {
        lastErr = e;
        if (isSafetyRejection(e)) throw e; // handled by generateBackground (fallback scene)
        if (isBadParam(e) && !isModelUnavailable(e) && params.output_format) continue; // retry same model, plain params
        if (isModelUnavailable(e)) break; // next model
        throw e; // auth, quota, content policy… surface it
      }
    }
    console.warn(`[image] ${model} unavailable, trying next`, (lastErr as Error)?.message);
  }
  throw new HttpError(502, `No image model is available to this OpenAI account (${(lastErr as Error)?.message ?? "unknown error"}). Set OPENAI_IMAGE_MODEL to a model your account can use.`);
}
