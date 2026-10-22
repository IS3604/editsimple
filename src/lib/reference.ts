import "server-only";
import { fetchT } from "@/lib/http";

/**
 * Best-effort, public-page-only reference reader. Instagram/LinkedIn posts usually require login,
 * in which case we return null and the UI says the reference couldn't be read (no scraping workarounds).
 */
export async function readReference(url: string): Promise<{ ok: boolean; text: string | null; note: string }> {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return { ok: false, text: null, note: "Unsupported URL" };
    if (/(^|\.)instagram\.com$|(^|\.)linkedin\.com$/.test(u.hostname))
      return { ok: false, text: null, note: "Instagram/LinkedIn posts require login; not fetched. Describe the reference style in the topic or theme instead." };
    const r = await fetchT(url, { timeoutMs: 8000, headers: { "User-Agent": "EditSimpleBot/0.1 (+reference reader)" } });
    if (!r.ok) return { ok: false, text: null, note: `Reference returned HTTP ${r.status}` };
    const html = (await r.text()).slice(0, 400_000);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
    const body = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
    return { ok: true, text: `${title}. ${desc}. ${body}`.slice(0, 1800), note: "Reference read" };
  } catch {
    return { ok: false, text: null, note: "Reference could not be fetched" };
  }
}
