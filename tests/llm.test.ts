import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Fake OpenAI-compatible client: behaviour scripted per model name.
const script: Record<string, (() => unknown)[]> = {};
const calls: string[] = [];
vi.mock("openai", () => {
  class OpenAI {
    chat = {
      completions: {
        create: async (params: { model: string }) => {
          calls.push(params.model);
          const next = script[params.model]?.shift();
          if (!next) throw Object.assign(new Error(`no script for ${params.model}`), { status: 500 });
          return next();
        },
      },
    };
    constructor(_: unknown) {}
  }
  return { default: OpenAI };
});

const ok = (content: string) => () => ({ choices: [{ message: { content } }] });
const fail = (status: number) => () => {
  throw Object.assign(new Error(`HTTP ${status}`), { status });
};

async function load() {
  vi.resetModules();
  process.env.GROQ_API_KEY = "test";
  process.env.GROQ_MODEL = "retired-model";
  process.env.OPENAI_API_KEY = "";
  process.env.TEXT_PROVIDER = "groq";
  return import("@/lib/ai/llm");
}

const Schema = z.object({ title: z.string() });

describe("chatJSON", () => {
  beforeEach(() => {
    calls.length = 0;
    for (const k of Object.keys(script)) delete script[k];
  });

  it("falls back to the next model when a model is retired (404)", async () => {
    script["retired-model"] = [fail(404)];
    script["openai/gpt-oss-120b"] = [ok('{"title":"Works"}')];
    const { chatJSON } = await load();
    await expect(chatJSON({ system: "s", user: "u", schema: Schema })).resolves.toEqual({ title: "Works" });
    expect(calls).toEqual(["retired-model", "openai/gpt-oss-120b"]);
  });

  it("retries once with the validation error when JSON doesn't match the schema", async () => {
    script["retired-model"] = [ok('{"wrong":1}'), ok('```json\n{"title":"Fixed"}\n```')];
    const { chatJSON } = await load();
    await expect(chatJSON({ system: "s", user: "u", schema: Schema })).resolves.toEqual({ title: "Fixed" });
  });

  it("gives a readable error when every model fails", async () => {
    script["retired-model"] = [fail(503)];
    script["openai/gpt-oss-120b"] = [fail(503)];
    script["openai/gpt-oss-20b"] = [fail(429)];
    const { chatJSON } = await load();
    await expect(chatJSON({ system: "s", user: "u", schema: Schema })).rejects.toThrow(/Text generation failed/);
  });

  it("does not hide non-retryable errors (e.g. bad API key)", async () => {
    script["retired-model"] = [fail(401)];
    const { chatJSON } = await load();
    await expect(chatJSON({ system: "s", user: "u", schema: Schema })).rejects.toThrow(/HTTP 401/);
    expect(calls).toHaveLength(1);
  });

  it("parses fenced JSON", async () => {
    const { parseLoose } = await load();
    expect(parseLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseLoose("not json")).toThrow();
  });
});
