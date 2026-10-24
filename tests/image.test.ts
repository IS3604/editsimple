import { beforeEach, describe, expect, it, vi } from "vitest";

const script: Record<string, (() => unknown)[]> = {};
const calls: { model: string; output_format?: string }[] = [];
vi.mock("openai", () => {
  class OpenAI {
    images = {
      generate: async (p: { model: string; output_format?: string }) => {
        calls.push({ model: p.model, output_format: p.output_format });
        const next = script[p.model]?.shift();
        if (!next) throw Object.assign(new Error(`The model '${p.model}' does not exist.`), { status: 400 });
        return next();
      },
    };
    constructor(_: unknown) {}
  }
  return { default: OpenAI };
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]).toString("base64");
const ok = (b64: string) => () => ({ data: [{ b64_json: b64 }] });
const err = (status: number, message: string, extra: object = {}) => () => {
  throw Object.assign(new Error(message), { status, ...extra });
};

async function load(model = "gpt-image-1") {
  vi.resetModules();
  process.env.OPENAI_API_KEY = "test";
  process.env.IMAGE_PROVIDER = "openai";
  process.env.OPENAI_IMAGE_MODEL = model;
  return import("@/lib/ai/image");
}

describe("image generation", () => {
  beforeEach(() => {
    calls.length = 0;
    for (const k of Object.keys(script)) delete script[k];
  });

  it("skips a retired model (the 'gpt-image-1 does not exist' error) and uses the next one", async () => {
    script["gpt-image-1"] = [err(400, "The model 'gpt-image-1' does not exist.")];
    script["gpt-image-2.5-flare"] = [ok(JPEG)];
    const { generateBackground } = await load();
    const img = await generateBackground("a clinic", "portrait");
    expect(img.provider).toBe("openai:gpt-image-2.5-flare");
    expect(img.mime).toBe("image/jpeg");
    expect(img.width).toBe(1024);
    expect(img.height).toBe(1536);
    expect(calls.map((c) => c.model)).toEqual(["gpt-image-1", "gpt-image-2.5-flare"]);
  });

  it("retries without output_format if the model rejects it, and detects PNG", async () => {
    script["gpt-image-2.5-flare"] = [err(400, "Unknown parameter: 'output_format'.", { code: "unknown_parameter", param: "output_format" }), ok(PNG)];
    const { generateBackground } = await load("gpt-image-2.5-flare");
    const img = await generateBackground("x", "landscape");
    expect(img.mime).toBe("image/png");
    expect(img.width).toBe(1536);
    expect(calls).toEqual([{ model: "gpt-image-2.5-flare", output_format: "jpeg" }, { model: "gpt-image-2.5-flare", output_format: undefined }]);
  });

  it("surfaces account problems instead of hiding them", async () => {
    script["gpt-image-2.5-flare"] = [err(401, "Incorrect API key provided")];
    const { generateBackground } = await load("gpt-image-2.5-flare");
    await expect(generateBackground("x", "square")).rejects.toThrow(/Incorrect API key/);
    expect(calls).toHaveLength(1);
  });

  it("explains clearly when no image model is available", async () => {
    const { generateBackground } = await load("gpt-image-1");
    await expect(generateBackground("x", "square")).rejects.toThrow(/No image model is available/);
  });

  it("defaults to a current model when none is configured", async () => {
    const { imageCandidates } = await load("");
    expect(imageCandidates("")[0]).toBe("gpt-image-2.5-flare");
  });
});
