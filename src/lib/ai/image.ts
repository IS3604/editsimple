import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export type GeneratedImage = { bytes: Buffer; mime: string; width: number; height: number; provider: string };

/**
 * Image provider abstraction. Only generates text-free backgrounds/illustrations —
 * all slide text is rendered by the app, never by the model.
 */
export async function generateBackground(prompt: string, aspect: "portrait" | "square" | "landscape"): Promise<GeneratedImage> {
  if (env.imageProvider === "none") throw new HttpError(400, "Image generation disabled (IMAGE_PROVIDER=none).");
  if (!env.openaiKey) throw new HttpError(503, "OPENAI_API_KEY missing — required for IMAGE_PROVIDER=openai.");

  const client = new OpenAI({ apiKey: env.openaiKey, timeout: 120_000 });
  const size = aspect === "portrait" ? "1024x1536" : aspect === "landscape" ? "1536x1024" : "1024x1024";
  const fullPrompt =
    `${prompt}\n\nStrict rules: absolutely no text, letters, numbers, logos, watermarks or UI. ` +
    `Leave generous calm negative space so overlaid typography stays readable. Editorial, high quality.`;

  const gptImage = env.openaiImageModel.startsWith("gpt-image");
  const params: Record<string, unknown> = { model: env.openaiImageModel, prompt: fullPrompt, size, n: 1 };
  // JPEG keeps files ~5× smaller than PNG — faster previews and well under Vercel's 4.5 MB response cap
  if (gptImage) Object.assign(params, { output_format: "jpeg", output_compression: 88, quality: "high" });
  const res = await client.images.generate(params as unknown as OpenAI.Images.ImageGenerateParams);
  const b64 = (res as OpenAI.Images.ImagesResponse).data?.[0]?.b64_json;
  if (b64) {
    const [w, h] = size.split("x").map(Number);
    return { bytes: Buffer.from(b64, "base64"), mime: gptImage ? "image/jpeg" : "image/png", width: w, height: h, provider: `openai:${env.openaiImageModel}` };
  }
  // dall-e models return a URL by default
  const url = (res as OpenAI.Images.ImagesResponse).data?.[0]?.url;
  if (!url) throw new HttpError(502, "Image provider returned no image");
  const img = await fetch(url);
  const [w, h] = size.split("x").map(Number);
  return {
    bytes: Buffer.from(await img.arrayBuffer()),
    mime: img.headers.get("content-type") ?? "image/png",
    width: w,
    height: h,
    provider: `openai:${env.openaiImageModel}`,
  };
}
