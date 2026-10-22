import { handle, HttpError } from "@/lib/http";
import { BUCKET, requireUser } from "@/lib/supabase/server";

/** Streams a private storage object after verifying it belongs to the caller (plus RLS on storage). */
export const GET = handle(async (req: Request) => {
  const { sb, user } = await requireUser();
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!path || path.includes("..") || !path.startsWith(`${user.id}/`)) throw new HttpError(403, "Forbidden");
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new HttpError(404, "Not found");
  return new Response(data, {
    headers: { "Content-Type": data.type || "application/octet-stream", "Cache-Control": "private, max-age=3600" },
  });
});
