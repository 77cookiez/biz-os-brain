import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const { email, workspace_id, team_role, custom_role_name, inviter_name, company_name } = await req.json();

    if (!email || !workspace_id || !team_role) {
      return new Response(
        JSON.stringify({ error: "email, workspace_id, and team_role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is owner/admin of the workspace's company
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
      .eq("user_id", callerId)
      .eq("company_id", workspace.company_id)
      .single();

    if (!callerRole || !["owner", "admin"].includes(callerRole.role)) {
      return new Response(
        JSON.stringify({ error: "Only owners and admins can invite members" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the user by email
    let targetUser = null;
    let page = 1;
    while (true) {
      const { data: pageData, error: pageError } =
        await adminClient.auth.admin.listUsers({ page, perPage: 50 });
      if (pageError || !pageData?.users?.length) break;
      const found = pageData.users.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (found) { targetUser = found; break; }
      if (pageData.users.length < 50) break;
      page++;
    }

    // If user not found, auto-invite them via Supabase (creates account + sends email)
    if (!targetUser) {
      const roleName = team_role === 'custom' ? (custom_role_name || 'Team Member') : 
        team_role.charAt(0).toUpperCase() + team_role.slice(1);
      
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: {
            invited_by: inviter_name || 'Your team',
            company_name: company_name || 'the team',
            team_role: roleName,
          },
          redirectTo: `${req.headers.get('origin') || supabaseUrl}/auth`,
        });

      if (inviteError) {
        console.error("Invite error:", inviteError);
        return new Response(
          JSON.stringify({ error: "invite_failed", message: "Failed to send invitation email. " + inviteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetUser = inviteData.user;
    }

    // Check if already a member
    const { data: existing } = await adminClient
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", targetUser.id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "already_member", message: "This user is already a member of this workspace." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also ensure user has a role in the company
    const { data: existingCompanyRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", targetUser.id)
      .eq("company_id", workspace.company_id)
      .maybeSingle();

    if (!existingCompanyRole) {
      await adminClient.from("user_roles").insert({
        user_id: targetUser.id,
        company_id: workspace.company_id,
        role: "member",
      });
    }

    // Determine if this is a new (invited) or existing user
    const isNewUser = !targetUser.confirmed_at;

    // Add to workspace_members
    const { error: insertError } = await adminClient
      .from("workspace_members")
      .insert({
        workspace_id,
        user_id: targetUser.id,
        team_role: team_role,
        custom_role_name: team_role === "custom" ? custom_role_name || null : null,
        invite_status: isNewUser ? "pending" : "accepted",
        joined_at: isNewUser ? null : new Date().toISOString(),
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to add member", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          user_id: targetUser.id,
          email: targetUser.email,
          full_name:
            targetUser.user_metadata?.full_name || targetUser.email?.split("@")[0],
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
