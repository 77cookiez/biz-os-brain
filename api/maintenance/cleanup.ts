// Vercel Serverless Function — proxies to Supabase Edge Function maintenance-cleanup
// Protected by CRON_SECRET (Vercel cron sends Authorization: Bearer <CRON_SECRET>)

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: "CRON_SECRET not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Accept secret via Authorization header (Vercel cron) or x-cron-secret header
  const authHeader = req.headers.get("authorization") || "";
  const cronHeader = req.headers.get("x-cron-secret") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (bearerToken !== cronSecret && cronHeader !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, code: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const maintenanceKey = process.env.MAINTENANCE_KEY;

  if (!supabaseUrl || !maintenanceKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or MAINTENANCE_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/maintenance-cleanup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-maintenance-key": maintenanceKey,
      },
      body: JSON.stringify({}),
    });

    const body = await resp.json();
    return new Response(JSON.stringify(body), {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "Edge function call failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
