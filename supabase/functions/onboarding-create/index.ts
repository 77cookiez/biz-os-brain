import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type OnboardingCreateRequest = {
  companyName: string;
  workspaceName: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Backend is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.slice("Bearer ".length);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = authData.user;

    const body = (await req.json()) as Partial<OnboardingCreateRequest>;
    const companyName = (body.companyName ?? "").trim();
    const workspaceName = (body.workspaceName ?? "").trim();

    if (!companyName || !workspaceName) {
      return new Response(JSON.stringify({ error: "Missing companyName or workspaceName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({ id: companyId, name: companyName, created_by: user.id })
      .select("*")
      .single();

    if (companyError) throw companyError;

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: user.id,
      company_id: company.id,
      role: "owner",
    });

    if (roleError) throw roleError;

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .insert({ id: workspaceId, company_id: company.id, name: workspaceName, default_locale: "en" })
      .select("*")
      .single();

    if (workspaceError) throw workspaceError;

    const { error: memberError } = await admin.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: user.id,
      team_role: "owner",
      invite_status: "accepted",
      joined_at: new Date().toISOString(),
    });

    if (memberError) throw memberError;

    const { error: contextError } = await admin.from("business_contexts").insert({
      workspace_id: workspace.id,
      setup_completed: false,
    });

    if (contextError) throw contextError;

    const { error: appError } = await admin.from("workspace_apps").insert({
      workspace_id: workspace.id,
      app_id: "brain",
      is_active: true,
      installed_by: user.id,
    });

    if (appError) throw appError;

    return new Response(JSON.stringify({ company, workspace }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("onboarding-create error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
