import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject } from "@/lib/data";
import { MAX_UPLOAD, putObject } from "@/lib/storage";

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

/**
 * Stores the final rendered slide PNGs (produced in the browser from the exact preview DOM,
 * so stored files == preview == downloads). Form fields: slide_<slideId> = PNG blob.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  await getProject(sb, id);
  const form = await req.formData();
  const { data: slides } = await sb.from("slides").select("id").eq("project_id", id);
  const valid = new Set((slides ?? []).map((s) => s.id));
  const stamp = Date.now();
  const saved: { slideId: string; path: string }[] = [];

  for (const [key, val] of form.entries()) {
    if (!key.startsWith("slide_") || !(val instanceof File)) continue;
    const slideId = key.slice(6);
    if (!valid.has(slideId)) throw new HttpError(400, `Unknown slide ${slideId}`);
    if (val.type !== "image/png" || val.size > MAX_UPLOAD) throw new HttpError(400, "Renders must be PNG ≤ 8 MB");
    const path = `${user.id}/projects/${id}/renders/${slideId}-${stamp}.png`;
    await putObject(sb, path, Buffer.from(await val.arrayBuffer()), "image/png");
    await sb.from("slides").update({ render_path: path }).eq("id", slideId);
    await sb.from("generated_assets").insert({ user_id: user.id, project_id: id, slide_id: slideId, kind: "render", storage_path: path, provider: "html-to-image" });
    saved.push({ slideId, path });
  }
  return NextResponse.json({ saved });
});
