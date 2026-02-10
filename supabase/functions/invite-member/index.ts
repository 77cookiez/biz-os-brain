import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

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
        email: email.toLowerCase(),
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to add member", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send invite email via Resend
    const roleName = team_role === 'custom' ? (custom_role_name || 'Team Member') : 
      team_role.charAt(0).toUpperCase() + team_role.slice(1);
    const origin = req.headers.get('origin') || 'https://biz-os-brain.lovable.app';
    
    let emailSent = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const inviter = inviter_name || 'Your team';
        const company = company_name || 'the team';

        await resend.emails.send({
          from: "AiBizOS <onboarding@resend.dev>",
          to: [email],
          subject: `${inviter} invited you to join ${company} on AiBizOS`,
          html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">AiBizOS</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">AI-Powered Business Operating System</p>
</td></tr>
<tr><td style="padding:32px;">
<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">You're Invited! 🎉</h2>
<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
<strong>${inviter}</strong> has invited you to join <strong>${company}</strong> on AiBizOS.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
<td style="background:#f0f0ff;border:1px solid #e0e0ff;border-radius:8px;padding:12px 16px;">
<span style="color:#6366f1;font-size:13px;font-weight:500;">📋 Your Role:</span>
<span style="color:#18181b;font-size:14px;font-weight:600;margin-left:8px;">${roleName}</span>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td align="center">
<a href="${origin}/auth" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
Accept Invitation →</a></td></tr></table>
<div style="background:#fafafa;border-radius:8px;padding:20px;margin:0 0 24px;">
<p style="margin:0 0 12px;color:#18181b;font-size:14px;font-weight:600;">Getting Started:</p>
<p style="margin:0 0 8px;color:#52525b;font-size:13px;">1️⃣ Click the button above to sign up</p>
<p style="margin:0 0 8px;color:#52525b;font-size:13px;">2️⃣ Complete your profile</p>
<p style="margin:0;color:#52525b;font-size:13px;">3️⃣ Start collaborating with your team</p></div>
<p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">If you didn't expect this invitation, you can safely ignore this email.</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
<p style="margin:0;color:#a1a1aa;font-size:11px;">Sent by AiBizOS • AI-Powered Business Operating System</p>
</td></tr></table></td></tr></table></body></html>`,
        });
        emailSent = true;
        console.log("Invite email sent via Resend to:", email);
      } catch (emailErr) {
        console.error("Resend email error (non-fatal):", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
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
