import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * OIL Event Ingest — receives organizational events from any app.
 *
 * Events are tenant-scoped, linked to meaning_object_id, and contain
 * no personal judgment. They are the raw input for OIL's pattern mining.
 *
 * POST body:
 * {
 *   workspace_id: string,
 *   events: Array<{
 *     event_type: string,      // e.g. "task.created", "goal.abandoned", "invoice.overdue"
 *     object_type: string,     // e.g. "task", "goal", "invoice"
 *     meaning_object_id?: string,
 *     severity_hint?: "info" | "warning" | "critical",
 *     metadata?: Record<string, any>
 *   }>
 * }
 */

interface OrgEvent {
  event_type: string;
  object_type: string;
  meaning_object_id?: string;
  severity_hint?: string;
  metadata?: Record<string, unknown>;
}

interface IngestRequest {
  workspace_id: string;
  events: OrgEvent[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── Auth Check ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as IngestRequest;
    const { workspace_id, events } = body;

    if (!workspace_id || !events || events.length === 0) {
      return new Response(
        JSON.stringify({ error: "workspace_id and events[] are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (events.length > 100) {
      return new Response(
        JSON.stringify({ error: "Maximum 100 events per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── CRITICAL: Workspace access guard (canonical pattern from brain-chat) ───
    // Step 1: Resolve workspace → company_id (404 if not found)
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("company_id")
      .eq("id", workspace_id)
      .maybeSingle();

    if (wsErr || !ws?.company_id) {
      return new Response(
        JSON.stringify({ error: "Workspace not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Verify user membership via user_roles (403 if not member)
    const { data: membership, error: memErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("company_id", ws.company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr || !membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert events
    const rows = events.map((e) => ({
      workspace_id,
      event_type: e.event_type,
      object_type: e.object_type,
      meaning_object_id: e.meaning_object_id || null,
      severity_hint: e.severity_hint || "info",
      metadata: e.metadata || {},
    }));

    const { error: insertError } = await supabase
      .from("org_events")
      .insert(rows);

    if (insertError) {
      console.error("OIL ingest error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to ingest events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ingested: events.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("oil-ingest error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
