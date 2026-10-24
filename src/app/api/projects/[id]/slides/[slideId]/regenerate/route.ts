import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject, selectedKeywords } from "@/lib/data";
import { chatJSON } from "@/lib/ai/llm";
import { SlideCopySchema, regenerateSlidePrompt, systemFor } from "@/lib/ai/prompts";
import { nicheOf } from "@/lib/niches";
import { marketOf } from "@/lib/markets";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string; slideId: string }> };

/** Regenerate copy for one slide (keeps its background and style). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id, slideId } = await params;
  const { sb } = await requireUser();
  await getProject(sb, id);
  const { instruction } = z.object({ instruction: z.string().max(300).optional() }).parse(await req.json().catch(() => ({})));

  const [{ data: brief }, { data: slides }] = await Promise.all([
    sb.from("content_briefs").select("*").eq("project_id", id).single(),
    sb.from("slides").select("*").eq("project_id", id).order("position"),
  ]);
  const target = slides?.find((s) => s.id === slideId);
  if (!brief || !slides || !target) throw new HttpError(404, "Slide not found");
  const { keywords } = await selectedKeywords(sb, id);

  const copy = await chatJSON({
    system: systemFor(nicheOf(brief.niche), marketOf(brief.market)),
    user: regenerateSlidePrompt({
      niche: nicheOf(brief.niche),
      market: marketOf(brief.market),
      topic: brief.topic,
      audience: brief.audience ?? "",
      tone: brief.tone ?? "",
      language: brief.language ?? "English",
      keywords,
      position: target.position,
      total: slides.length,
      kind: target.kind ?? "statement",
      current: JSON.stringify({ kind: target.kind, kicker: target.kicker, heading: target.heading, body: target.body, items: target.items }),
      neighbours: slides.filter((s) => s.id !== slideId).map((s) => `#${s.position + 1} ${s.heading}`).join(" | "),
      instruction,
    }),
    schema: SlideCopySchema,
    temperature: 0.9,
    effort: "medium",
  });

  const { data, error } = await sb
    .from("slides")
    .update({ kind: copy.kind, role: copy.role, kicker: copy.kicker || null, heading: copy.heading, body: copy.body, items: copy.items, visual_prompt: copy.visual_prompt || target.visual_prompt })
    .eq("id", slideId)
    .select("*")
    .single();
  if (error) throw error;
  return NextResponse.json({ slide: data });
});
