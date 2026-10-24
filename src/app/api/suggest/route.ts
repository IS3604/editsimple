import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { chatJSON } from "@/lib/ai/llm";
import { SuggestBriefSchema, SuggestIdeasSchema, briefPrompt, ideasPrompt, systemFor } from "@/lib/ai/prompts";
import { NICHES } from "@/lib/niches";
import { nicheHeadlines } from "@/lib/research/news";

export const maxDuration = 45;

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ideas"),
    niche: z.enum(["medical", "legal"]),
    specialty: z.string().max(80).default(""),
    audience: z.string().max(200).default(""),
  }),
  z.object({
    mode: z.literal("brief"),
    niche: z.enum(["medical", "legal"]),
    specialty: z.string().max(80).default(""),
    topic: z.string().trim().min(3).max(200),
    audience: z.string().max(200).default(""),
    objective: z.string().max(20).default("education"),
  }),
]);

const headlineCache = new Map<string, { at: number; titles: string[] }>();

/** AI recommendations while the user fills the brief. Results are suggestions, never auto-applied. */
export const POST = handle(async (req: Request) => {
  await requireUser();
  const b = Body.parse(await req.json());

  if (b.mode === "ideas") {
    let titles: string[] = [];
    const c = headlineCache.get(b.niche);
    if (c && Date.now() - c.at < 3600_000) titles = c.titles;
    else {
      try {
        titles = (await nicheHeadlines(NICHES[b.niche].newsQueries.slice(0, 3), 15)).map((h) => h.title);
        headlineCache.set(b.niche, { at: Date.now(), titles });
      } catch {
        /* ideas still work without news */
      }
    }
    const out = await chatJSON({
      system: systemFor(b.niche),
      user: ideasPrompt({ niche: b.niche, specialty: b.specialty, audience: b.audience, headlines: titles }),
      schema: SuggestIdeasSchema,
      temperature: 0.85,
    });
    return NextResponse.json(out);
  }

  const out = await chatJSON({
    system: systemFor(b.niche),
    user: briefPrompt(b),
    schema: SuggestBriefSchema,
    temperature: 0.6,
  });
  return NextResponse.json(out);
});
