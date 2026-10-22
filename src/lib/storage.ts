import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";

export const ALLOWED_IMAGE = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const MAX_UPLOAD = 8 * 1024 * 1024;

export async function putObject(sb: SupabaseClient, path: string, body: Buffer | Blob, contentType: string) {
  const { error } = await sb.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new HttpError(500, `Storage upload failed: ${error.message}`);
  return path;
}

export function extFor(mime: string) {
  return mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/svg+xml" ? "svg" : "png";
}
