import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject, selectedKeywords, setStage } from "@/lib/data";
import { chatJSON } from "@/lib/ai/llm";
import { ContentSchema, contentPrompt, editorPrompt, systemFor } from "@/lib/ai/prompts";
import { readReference } from "@/lib/reference";
import { nicheOf } from "@/lib/niches";
import { TEMPLATES } from "@/lib/themes";
import type { SlideKind } from "@/lib/types";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

const layoutFor = (kind: SlideKind, hasVisual: boolean) => (kind === "hook" ? "center" : hasVisual ? "top" : "top");

/** Stages 2–3: angle + slide copy, then an editor pass that sharpens it. Replaces existing slides. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const started = Date.now();
  const { id } = await params;
  const { sb, user } = await requireUser();
  const project = await getProject(sb, id);
  const { data: brief } = await sb.from("content_briefs").select("*").eq("project_id", id).single();
  if (!brief) throw new HttpError(400, "Project has no brief");
  const niche = nicheOf(brief.niche);

  await setStage(sb, id, project.stage, "generating");
  try {
    const { keywords } = await selectedKeywords(sb, id);
    const ref = brief.reference_url ? await readReference(brief.reference_url) : null;
    const template = TEMPLATES[project.design?.template as keyof typeof TEMPLATES] ?? TEMPLATES.studio;

    let content = await chatJSON({
      system: systemFor(niche),
      user: contentPrompt({
        niche,
        specialty: brief.specialty ?? "",
        topic: brief.topic,
        hook: brief.hook ?? "",
        audience: brief.audience ?? "",
        objective: brief.objective ?? "education",
        tone: brief.tone ?? "warm, clear and expert",
        language: brief.language ?? "English",
        platform: project.platform,
        slideCount: project.slide_count,
        keywords: keywords.length ? keywords : brief.user_keywords,
        templateLabel: template.label,
        referenceNote: ref?.text ?? undefined,
      }),
      schema: ContentSchema,
      temperature: 0.8,
      effort: "medium",
    });

    // Editor pass — skipped if we're close to the function time limit; the draft is still good.
    if (Date.now() - started < 30_000) {
      try {
        content = await chatJSON({
          system: systemFor(niche),
          user: editorPrompt(JSON.stringify(content), niche),
          schema: ContentSchema,
          temperature: 0.4,
          effort: "low",
        });
      } catch (e) {
        console.warn("[content] editor pass skipped", (e as Error).message);
      }
    }

    const slides = content.slides.slice(0, project.slide_count);
    // guarantee structure: first = hook, last = cta
    if (slides[0]) slides[0].kind = "hook";
    if (slides.length > 1) slides[slides.length - 1].kind = "cta";

    await sb.from("content_briefs").update({ strategy: { ...content.strategy, reference: ref?.note ?? null } }).eq("project_id", id);
    await sb.from("slides").delete().eq("project_id", id);
    const { data: inserted, error } = await sb
      .from("slides")
      .insert(
        slides.map((s, i) => ({
          kind: s.kind,
          role: s.role,
          kicker: s.kicker || null,
          heading: s.heading,
          body: s.body,
          items: s.items,
          visual_prompt: s.visual_prompt || null,
          layout: layoutFor(s.kind, !!s.visual_prompt),
          user_id: user.id,
          project_id: id,
          position: i,
          style: {},
        }))
      )
      .select("*");
    if (error) throw error;

    await setStage(sb, id, 3, "generating");
    return NextResponse.json({ strategy: content.strategy, slides: inserted, reference: ref?.note ?? null });
  } catch (e) {
    await setStage(sb, id, project.stage, "failed", e instanceof Error ? e.message.slice(0, 480) : "Content generation failed");
    throw e;
  }
});
