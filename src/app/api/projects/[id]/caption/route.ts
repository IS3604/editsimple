import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject, selectedKeywords } from "@/lib/data";
import { chatJSON } from "@/lib/ai/llm";
import { CaptionSchema, SYSTEM_STRATEGIST, captionPrompt } from "@/lib/ai/prompts";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };
const Platform = z.enum(["instagram", "linkedin"]);

const normTags = (tags: string[]) =>
  [...new Set(tags.map((t) => t.trim().replace(/\s+/g, "")).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)))];

/** Generate (and save) a caption for one platform. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  const project = await getProject(sb, id);
  const { platform } = z.object({ platform: Platform }).parse(await req.json());
  const [{ data: brief }, { data: slides }] = await Promise.all([
    sb.from("content_briefs").select("*").eq("project_id", id).single(),
    sb.from("slides").select("heading,body").eq("project_id", id).order("position"),
  ]);
  if (!brief || !slides?.length) throw new HttpError(400, "Generate slides first");
  const { keywords, hashtags } = await selectedKeywords(sb, id);

  const out = await chatJSON({
    system: SYSTEM_STRATEGIST,
    user: captionPrompt({
      platform,
      topic: brief.topic,
      audience: brief.audience ?? "",
      objective: brief.objective ?? "education",
      tone: brief.tone ?? "",
      language: brief.language ?? "English",
      slides,
      keywords,
      hashtagIdeas: hashtags,
    }),
    schema: CaptionSchema,
    temperature: 0.8,
  });
  const { data, error } = await sb
    .from("captions")
    .upsert({ user_id: user.id, project_id: id, platform, body: out.body.trim(), hashtags: normTags(out.hashtags) }, { onConflict: "project_id,platform" })
    .select("*")
    .single();
  if (error) throw error;
  if (project.stage < 6) await sb.from("projects").update({ stage: 6 }).eq("id", id);
  return NextResponse.json({ caption: data });
});

/** Save user edits. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  await getProject(sb, id);
  const b = z.object({ platform: Platform, body: z.string().max(3000), hashtags: z.array(z.string().max(60)).max(30) }).parse(await req.json());
  const { data, error } = await sb
    .from("captions")
    .upsert({ user_id: user.id, project_id: id, platform: b.platform, body: b.body, hashtags: normTags(b.hashtags) }, { onConflict: "project_id,platform" })
    .select("*")
    .single();
  if (error) throw error;
  return NextResponse.json({ caption: data });
});
