import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { ALLOWED_IMAGE, MAX_UPLOAD, extFor, putObject } from "@/lib/storage";

/** Logo / image upload → returns the private storage path. */
export const POST = handle(async (req: Request) => {
  const { sb, user } = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "logo");
  if (!(file instanceof File)) throw new HttpError(400, "file is required");
  if (!ALLOWED_IMAGE.includes(file.type)) throw new HttpError(400, "Use PNG, JPEG, WebP or SVG");
  if (file.size > MAX_UPLOAD) throw new HttpError(400, "Max 4 MB");
  const folder = kind === "logo" ? "logos" : "uploads";
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${extFor(file.type)}`;
  await putObject(sb, path, Buffer.from(await file.arrayBuffer()), file.type);
  await sb.from("generated_assets").insert({ user_id: user.id, kind: kind === "logo" ? "logo" : "upload", storage_path: path, provider: "upload" });
  return NextResponse.json({ path });
});
