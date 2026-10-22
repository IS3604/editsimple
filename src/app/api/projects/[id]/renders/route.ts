import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/http";
import { BUCKET, requireUser } from "@/lib/supabase/server";
import { getProject } from "@/lib/data";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  items: z.array(z.object({ slideId: z.string().uuid(), path: z.string().max(400) })).min(1).max(10),
});

/**
 * Records rendered slide PNGs. The browser uploads the files straight to Supabase Storage
 * (own-folder RLS policy) because a whole deck exceeds Vercel's 4.5 MB request-body limit;
 * this route only verifies and links the stored paths.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  await getProject(sb, id);
  const { items } = Body.parse(await req.json());

  const { data: slides } = await sb.from("slides").select("id").eq("project_id", id);
  const valid = new Set((slides ?? []).map((s) => s.id));
  const prefix = `${user.id}/projects/${id}/renders/`;

  for (const it of items) {
    if (!valid.has(it.slideId)) throw new HttpError(400, `Unknown slide ${it.slideId}`);
    if (!it.path.startsWith(prefix) || it.path.includes("..")) throw new HttpError(400, "Invalid render path");
  }
  // confirm the files exist
  const { data: listed } = await sb.storage.from(BUCKET).list(prefix.slice(0, -1), { limit: 1000 });
  const names = new Set((listed ?? []).map((f) => `${prefix}${f.name}`));
  const missing = items.filter((i) => !names.has(i.path));
  if (missing.length) throw new HttpError(400, `${missing.length} render(s) not found in storage`);

  for (const it of items) {
    await sb.from("slides").update({ render_path: it.path }).eq("id", it.slideId);
    await sb.from("generated_assets").insert({ user_id: user.id, project_id: id, slide_id: it.slideId, kind: "render", storage_path: it.path, provider: "html-to-image" });
  }
  return NextResponse.json({ saved: items.length });
});
