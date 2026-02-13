import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { action, workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Verify user is a workspace member
    const { data: membership } = await adminClient
      .from("workspace_members")
      .select("id")
      .eq("user_id", userId)
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "export") {
      // Export all user data from the workspace
      const [tasks, goals, plans, ideas, brainMessages, meaningObjects] = await Promise.all([
        adminClient.from("tasks").select("*").eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("goals").select("*").eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("plans").select("*").eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("ideas").select("*").eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("brain_messages").select("*").eq("workspace_id", workspace_id).eq("user_id", userId).is("deleted_at", null),
        adminClient.from("meaning_objects").select("*").eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
      ]);

      const { data: profile } = await adminClient
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        workspace_id,
        profile,
        tasks: tasks.data || [],
        goals: goals.data || [],
        plans: plans.data || [],
        ideas: ideas.data || [],
        brain_messages: brainMessages.data || [],
        meaning_objects: meaningObjects.data || [],
      };

      // Audit log
      await adminClient.from("audit_logs").insert({
        workspace_id,
        actor_user_id: userId,
        action: "gdpr.data_export",
        entity_type: "user",
        entity_id: userId,
        metadata: { tables_exported: ["tasks", "goals", "plans", "ideas", "brain_messages", "meaning_objects", "profiles"] },
      });

      return new Response(JSON.stringify(exportData), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="data-export-${userId.slice(0, 8)}.json"`,
        },
      });
    }

    if (action === "delete") {
      // Only owners/admins can request deletion
      const { data: workspace } = await adminClient
        .from("workspaces")
        .select("company_id")
        .eq("id", workspace_id)
        .single();

      if (!workspace) {
        return new Response(JSON.stringify({ error: "Workspace not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: callerRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("company_id", workspace.company_id)
        .single();

      // Users can delete their own data; owners/admins can delete any
      const now = new Date().toISOString();

      // Soft-delete all user's content
      await Promise.all([
        adminClient.from("tasks").update({ deleted_at: now }).eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("goals").update({ deleted_at: now }).eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("plans").update({ deleted_at: now }).eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("ideas").update({ deleted_at: now }).eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
        adminClient.from("brain_messages").update({ deleted_at: now }).eq("workspace_id", workspace_id).eq("user_id", userId).is("deleted_at", null),
        adminClient.from("meaning_objects").update({ deleted_at: now }).eq("workspace_id", workspace_id).eq("created_by", userId).is("deleted_at", null),
      ]);

      // Audit log
      await adminClient.from("audit_logs").insert({
        workspace_id,
        actor_user_id: userId,
        action: "gdpr.data_deletion_request",
        entity_type: "user",
        entity_id: userId,
        metadata: { soft_deleted: true },
      });

      return new Response(JSON.stringify({ success: true, message: "Data marked for deletion" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'export' or 'delete'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gdpr-export error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
