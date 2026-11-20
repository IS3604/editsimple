// Supabase Edge Function (EditSimple website module, name: eds-site-status).
// Public, read-only: tells the website whether maintenance mode is on.
// Returns {"maintenance": true|false}. Deploy with "Verify JWT" OFF.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "GET") return new Response('{"error":"Method not allowed"}', { status: 405, headers });
  const { data, error } = await db.from("eds_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
  // If the database can't be reached, keep the site up.
  const maintenance = !error && String(data?.value ?? "").toLowerCase() === "true";
  return new Response(JSON.stringify({ maintenance }), { headers });
});
