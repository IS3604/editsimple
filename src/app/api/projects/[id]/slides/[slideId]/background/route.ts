import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject } from "@/lib/data";
import { generateBackground } from "@/lib/ai/image";
import { ALLOWED_IMAGE, MAX_UPLOAD, extFor, putObject } from "@/lib/storage";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string; slideId: string }> };

/**
 * POST JSON {prompt?}  → generate a text-free background with the image provider
 * POST multipart file  → user-supplied background
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id, slideId } = await params;
  const { sb, user } = await requireUser();
  const project = await getProject(sb, id);
  const { data: slide } = await sb.from("slides").select("*").eq("id", slideId).eq("project_id", id).maybeSingle();
  if (!slide) throw new HttpError(404, "Slide not found");

  let bytes: Buffer, mime: string, provider: string, prompt: string | null = null, w: number | null = null, h: number | null = null;

  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "file is required");
    if (!ALLOWED_IMAGE.includes(file.type) || file.type === "image/svg+xml") throw new HttpError(400, "Use PNG, JPEG or WebP");
    if (file.size > MAX_UPLOAD) throw new HttpError(400, "Max 4 MB");
    bytes = Buffer.from(await file.arrayBuffer());
    mime = file.type;
    provider = "upload";
  } else {
    const body = z.object({ prompt: z.string().max(800).optional() }).parse(await req.json().catch(() => ({})));
    const { data: brief } = await sb.from("content_briefs").select("strategy").eq("project_id", id).maybeSingle();
    const d = project.design ?? {};
    // Match the generated image's aspect to the frame it fills on the slide, so nothing important is cropped.
    const fullBleed = slide.layout === "center" || slide.kind === "hook";
    const aspect: "portrait" | "square" | "landscape" =
      slide.layout === "split" ? "portrait" : fullBleed ? (project.size === "1080x1080" ? "square" : "portrait") : "landscape";
    const composition = fullBleed
      ? "Composition: main subject in the upper-middle third, lower 40% darker and low-detail (text sits there). Keep the subject fully inside the frame with margin on all sides."
      : aspect === "landscape"
      ? "Composition: wide landscape frame, subject centred horizontally and vertically, fully visible with comfortable margins; nothing important near the edges."
      : "Composition: tall frame, subject centred, fully visible with margin on all sides.";
    prompt = [
      brief?.strategy?.visual_direction ? `Series style (keep consistent across slides): ${brief.strategy.visual_direction}.` : "",
      `Scene: ${body.prompt ?? slide.visual_prompt ?? slide.heading}.`,
      `Colour palette harmonised with ${d.colors?.background ?? ""} and ${d.colors?.accent ?? ""}; modern editorial photography or refined 3D illustration, natural light, high detail.`,
      composition,
    ].join(" ");
    const img = await generateBackground(prompt, aspect);
    ({ bytes, mime, provider } = img);
    w = img.width;
    h = img.height;
  }

  const path = `${user.id}/projects/${id}/backgrounds/${slideId}-${Date.now()}.${extFor(mime)}`;
  await putObject(sb, path, bytes, mime);
  await sb.from("generated_assets").insert({ user_id: user.id, project_id: id, slide_id: slideId, kind: provider === "upload" ? "upload" : "background", storage_path: path, provider, prompt, width: w, height: h });
  const { data, error } = await sb.from("slides").update({ background_path: path }).eq("id", slideId).select("*").single();
  if (error) throw error;
  return NextResponse.json({ slide: data });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id, slideId } = await params;
  const { sb } = await requireUser();
  await getProject(sb, id);
  const { data, error } = await sb.from("slides").update({ background_path: null }).eq("id", slideId).eq("project_id", id).select("*").single();
  if (error) throw error;
  return NextResponse.json({ slide: data });
});
