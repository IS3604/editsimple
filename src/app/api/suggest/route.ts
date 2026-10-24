import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { chatJSON } from "@/lib/ai/llm";
import { SuggestBriefSchema, SuggestIdeasSchema, briefPrompt, ideasPrompt, systemFor } from "@/lib/ai/prompts";
import { NICHES } from "@/lib/niches";
import { MARKET_CODES, type MarketCode } from "@/lib/markets";
import { nicheHeadlines } from "@/lib/research/news";

export const maxDuration = 45;

const common = {
  niche: z.enum(["medical", "legal"]),
  market: z.enum(MARKET_CODES as [MarketCode, ...MarketCode[]]).default("US"),
  specialty: z.string().max(80).default(""),
  audience: z.string().max(200).default(""),
  clientNotes: z.string().max(600).default(""),
};

const SuggestBody = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("ideas"), ...common }),
  z.object({ mode: z.literal("brief"), ...common, topic: z.string().trim().min(3).max(200), objective: z.string().max(20).default("education") }),
]);

const headlineCache = new Map<string, { at: number; titles: string[] }>();

/** AI recommendations while the editor fills the brief. Suggestions only — never auto-applied. */
export const POST = handle(async (req: Request) => {
  await requireUser();
  const b = SuggestBody.parse(await req.json());

  if (b.mode === "ideas") {
    const key = `${b.niche}:${b.market}`;
    let titles: string[] = [];
    const c = headlineCache.get(key);
    if (c && Date.now() - c.at < 3600_000) titles = c.titles;
    else {
      try {
        titles = (await nicheHeadlines(NICHES[b.niche].newsQueries.slice(0, 3), 15, b.market)).map((h) => h.title);
        headlineCache.set(key, { at: Date.now(), titles });
      } catch {
        /* ideas still work without news */
      }
    }
    const out = await chatJSON({
      system: systemFor(b.niche, b.market),
      user: ideasPrompt({ ...b, headlines: titles }),
      schema: SuggestIdeasSchema,
      temperature: 0.85,
    });
    return NextResponse.json(out);
  }

  const out = await chatJSON({
    system: systemFor(b.niche, b.market),
    user: briefPrompt(b),
    schema: SuggestBriefSchema,
    temperature: 0.6,
  });
  return NextResponse.json(out);
});
