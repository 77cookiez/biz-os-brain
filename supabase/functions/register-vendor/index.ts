import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_slug, display_name, bio, email, whatsapp, source_lang } =
      await req.json();

    if (!tenant_slug || !display_name) {
      return new Response(
        JSON.stringify({ error: "tenant_slug and display_name required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role for atomic operations
    const admin = createClient(supabaseUrl, serviceKey);

    // ── SECURITY: Derive workspace_id from tenant_slug server-side ──
    // Never trust workspace_id from the client. Always resolve from slug.
    const { data: tenantSettings, error: tenantError } = await admin
      .from("booking_settings")
      .select("workspace_id, tenant_slug")
      .eq("tenant_slug", tenant_slug)
      .eq("is_live", true)
      .maybeSingle();

    if (tenantError || !tenantSettings) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive tenant" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const workspace_id = tenantSettings.workspace_id;

    // 1. Check if user is already a vendor in this workspace
    const { data: existingVendor } = await admin
      .from("booking_vendors")
      .select("id, status")
      .eq("workspace_id", workspace_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (existingVendor) {
      return new Response(
        JSON.stringify({
          error: "already_registered",
          vendor: existingVendor,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Ensure user is a workspace member (add with 'pending' status — not accepted until vendor is approved)
    const { data: existingMember } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingMember) {
      await admin.from("workspace_members").insert({
        workspace_id,
        user_id: user.id,
        role: "vendor",
        status: "pending",
      });
    }

    // 3. Create meaning object for display name
    const { data: meaningObj, error: moError } = await admin
      .from("meaning_objects")
      .insert({
        workspace_id,
        created_by: user.id,
        source_lang: source_lang || "en",
        type: "generic",
        meaning_json: {
          subject: display_name,
          description: bio || "",
          intent: "vendor_registration",
        },
      })
      .select("id")
      .single();

    if (moError) {
      console.error("meaning_objects insert error:", moError);
      return new Response(
        JSON.stringify({ error: "Failed to create meaning object" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Create vendor record
    const { data: vendor, error: vendorError } = await admin
      .from("booking_vendors")
      .insert({
        workspace_id,
        owner_user_id: user.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (vendorError) {
      console.error("booking_vendors insert error:", vendorError);
      return new Response(
        JSON.stringify({ error: "Failed to create vendor" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Create vendor profile
    const { error: profileError } = await admin
      .from("booking_vendor_profiles")
      .insert({
        workspace_id,
        vendor_id: vendor.id,
        display_name,
        display_name_meaning_object_id: meaningObj.id,
        bio: bio || null,
        email: email || null,
        whatsapp: whatsapp || null,
        source_lang: source_lang || "en",
      });

    if (profileError) {
      console.error("booking_vendor_profiles insert error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to create vendor profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 6. Audit log (non-blocking — errors don't break registration)
    await admin
      .from("audit_logs")
      .insert({
        workspace_id,
        actor_user_id: user.id,
        action: "booking.vendor_registered",
        entity_type: "booking_vendor",
        entity_id: vendor.id,
      })
      .then(({ error }) => {
        if (error) console.error("audit_logs insert error (non-fatal):", error);
      });

    return new Response(
      JSON.stringify({
        success: true,
        vendor_id: vendor.id,
        status: "pending",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("register-vendor error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
