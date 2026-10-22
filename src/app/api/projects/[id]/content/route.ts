import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject, selectedKeywords, setStage } from "@/lib/data";
import { chatJSON } from "@/lib/ai/llm";
import { ContentSchema, SYSTEM_STRATEGIST, contentPrompt } from "@/lib/ai/prompts";
import { readReference } from "@/lib/reference";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/** Stages 2–3: content strategy + slide-by-slide copy. Replaces existing slides. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  const project = await getProject(sb, id);
  const { data: brief } = await sb.from("content_briefs").select("*").eq("project_id", id).single();
  if (!brief) throw new HttpError(400, "Project has no brief");

  await setStage(sb, id, project.stage, "generating");
  try {
    const { keywords } = await selectedKeywords(sb, id);
    const ref = brief.reference_url ? await readReference(brief.reference_url) : null;

    const content = await chatJSON({
      system: SYSTEM_STRATEGIST,
      user: contentPrompt({
        topic: brief.topic,
        industry: brief.industry ?? "",
        audience: brief.audience ?? "",
        objective: brief.objective ?? "education",
        tone: brief.tone ?? "clear and confident",
        language: brief.language ?? "English",
        platform: project.platform,
        slideCount: project.slide_count,
        keywords: keywords.length ? keywords : brief.user_keywords,
        theme: project.design?.theme ?? "minimalist",
        referenceNote: ref?.text ?? undefined,
      }),
      schema: ContentSchema,
      temperature: 0.75,
    });

    const slides = content.slides.slice(0, project.slide_count);
    await sb.from("content_briefs").update({ strategy: { ...content.strategy, reference: ref?.note ?? null } }).eq("project_id", id);
    await sb.from("slides").delete().eq("project_id", id);
    const { data: inserted, error } = await sb
      .from("slides")
      .insert(slides.map((s, i) => ({ ...s, kicker: s.kicker || null, user_id: user.id, project_id: id, position: i, style: {} })))
      .select("*");
    if (error) throw error;

    await setStage(sb, id, 3, "generating");
    return NextResponse.json({ strategy: content.strategy, slides: inserted, reference: ref?.note ?? null });
  } catch (e) {
    await setStage(sb, id, project.stage, "failed", e instanceof Error ? e.message.slice(0, 480) : "Content generation failed");
    throw e;
  }
});
