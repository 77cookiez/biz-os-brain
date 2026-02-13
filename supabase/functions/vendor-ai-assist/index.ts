import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Lightweight in-memory rate limiter (per-isolate) ──
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 requests per minute per user

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// ── Payload size limit ──
const MAX_PAYLOAD_BYTES = 4096; // 4 KB

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

    // ── Payload size check ──
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user
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

    // ── Rate limit ──
    if (isRateLimited(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { prompt, context } = JSON.parse(body);

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── SECURITY: Verify requester is an APPROVED vendor ──
    // Use service role to check vendor status without RLS interference
    const admin = createClient(supabaseUrl, serviceKey);

    // Find a workspace for this vendor. If context provides vendorName,
    // we look up the vendor by owner_user_id + approved status.
    const { data: vendorRecord, error: vendorError } = await admin
      .from("booking_vendors")
      .select("id, workspace_id, status")
      .eq("owner_user_id", user.id)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();

    if (vendorError || !vendorRecord) {
      return new Response(
        JSON.stringify({ error: "Only approved vendors can use AI assist" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const vendorName = context?.vendorName || "Vendor";
    const locale = context?.locale || "en";
    const existingServices = context?.existingServices || [];

    const systemPrompt = `You are an AI assistant for vendors on a booking marketplace called Bookivo.
Your job is to help vendors create professional service listings.

The vendor's name is "${vendorName}".
Their current locale is "${locale}".
They have ${existingServices.length} existing services.

When asked to create a service or package, respond with ONLY a valid JSON object (no markdown, no code blocks) in this format:
{
  "suggestions": [
    {
      "type": "service",
      "title_en": "English title",
      "title_ar": "Arabic title",
      "description_en": "English description (2-3 sentences)",
      "description_ar": "Arabic description (2-3 sentences)",
      "suggestedPrice": 500,
      "currency": "USD",
      "duration": 120,
      "addons": [
        { "name_en": "Addon name", "name_ar": "اسم الإضافة", "price": 50 }
      ],
      "terms": "Cancellation terms in English"
    }
  ]
}

If the user asks a general question, respond with:
{
  "message": "Your helpful response here"
}

Always provide both English and Arabic content. Be professional, practical, and industry-aware.
Prices should be realistic for the service type described.`;

    const aiResponse = await fetch(
      "https://api.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiData = await aiResponse.json();
    const content =
      aiData.choices?.[0]?.message?.content || '{"message": "No response"}';

    // Try to parse as JSON
    let parsed;
    try {
      const cleaned = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { message: content };
    }

    // ── Audit log for AI usage ──
    await admin.from("audit_logs").insert({
      workspace_id: vendorRecord.workspace_id,
      actor_user_id: user.id,
      action: "booking.vendor_ai_assist",
      entity_type: "booking_vendor",
      entity_id: vendorRecord.id,
      metadata: {
        prompt_length: prompt.length,
        has_suggestions: !!parsed.suggestions,
      },
    });

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vendor-ai-assist error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
