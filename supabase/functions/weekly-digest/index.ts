import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INSIGHTS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/insights-get`;
const BRAIN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/brain-chat`;

interface DigestPayload {
  workspace_id: string;
  user_id: string;
  content_locale?: string;
  send_email?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { workspace_id, user_id, content_locale, send_email } =
      (await req.json()) as DigestPayload;

    if (!workspace_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id and user_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check digest preferences
    const { data: prefs } = await supabase
      .from("digest_preferences")
      .select("*")
      .eq("user_id", user_id)
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    // Default is enabled if no prefs row exists
    if (prefs && !prefs.enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "digest_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute week range
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // Check if digest already exists for this week
    const { data: existingDigest } = await supabase
      .from("weekly_digests")
      .select("id")
      .eq("user_id", user_id)
      .eq("workspace_id", workspace_id)
      .eq("week_start", weekStartStr)
      .maybeSingle();

    if (existingDigest) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already_generated", digest_id: existingDigest.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Fetch insights
    const insightsResp = await fetch(INSIGHTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ workspace_id, window_days: 7 }),
    });

    if (!insightsResp.ok) {
      console.error("Failed to fetch insights:", await insightsResp.text());
      return new Response(
        JSON.stringify({ error: "Failed to fetch insights data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insights = await insightsResp.json();
    const { weekly, blockers, decisions } = insights;

    // Step 2: Build compact stats
    const stats = {
      tasks_created: weekly.tasks_created,
      tasks_completed: weekly.tasks_completed,
      tasks_blocked: weekly.tasks_blocked,
      tasks_from_chat: weekly.tasks_from_chat,
      goals_created: weekly.goals_created,
    };

    // Top 2 blockers
    const allBlockers = [
      ...blockers.blocked_tasks.map((b: any) => ({ ...b, type: "blocked", sort: 0 })),
      ...blockers.stale_tasks.map((b: any) => ({ ...b, type: "stale", sort: 1 })),
    ]
      .sort((a: any, b: any) => {
        if (a.sort !== b.sort) return a.sort - b.sort;
        return (b.days_inactive || 0) - (a.days_inactive || 0);
      })
      .slice(0, 2);

    const blockersSummary = allBlockers.map((b: any) => ({
      task_id: b.task_id,
      meaning_object_id: b.meaning_object_id,
      type: b.type,
      days_inactive: b.days_inactive || 0,
    }));

    const decisionsSummary = {
      tasks_from_chat_count: decisions.tasks_created_from_chat.length,
      goals_from_chat_count: decisions.goals_created_from_chat.length,
    };

    // Step 3: Generate narrative via Brain (optional)
    let narrativeText: string | null = null;
    const targetLang = content_locale || "en";

    const isEmpty =
      stats.tasks_created === 0 &&
      stats.tasks_completed === 0 &&
      stats.tasks_blocked === 0;

    if (isEmpty) {
      // Light digest for empty weeks
      const emptyMessages: Record<string, string> = {
        en: "Nothing major happened this week — but you're all set for the next one.",
        ar: "لم يحدث شيء كبير هذا الأسبوع — لكنك جاهز للأسبوع القادم.",
        fr: "Rien de majeur cette semaine — mais vous êtes prêt pour la prochaine.",
        es: "Nada importante esta semana — pero estás listo para la próxima.",
      };
      narrativeText = emptyMessages[targetLang] || emptyMessages.en;
    } else {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const factSheet = [
            `Week: ${weekStartStr} to ${weekEndStr}`,
            `Tasks created: ${stats.tasks_created}`,
            `Tasks completed: ${stats.tasks_completed}`,
            `Tasks blocked: ${stats.tasks_blocked}`,
            `Tasks from chat: ${stats.tasks_from_chat}`,
            `Goals created: ${stats.goals_created}`,
            `Top blockers: ${allBlockers.length}`,
          ].join("\n");

          const brainResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a concise business insights narrator. Given ONLY the factual data below, write a single short paragraph (2-3 sentences max) summarizing the week.
Rules:
- Do NOT invent facts or numbers not in the data
- Do NOT add advice, recommendations, or action items
- Do NOT add greetings or sign-offs
- Write in ${targetLang}
- Keep it neutral, warm, and motivating
- This is a summary, not analysis

Data:
${factSheet}`,
                },
                {
                  role: "user",
                  content: "Summarize this week in a brief paragraph.",
                },
              ],
              stream: false,
            }),
          });

          if (brainResp.ok) {
            const brainData = await brainResp.json();
            narrativeText =
              brainData.choices?.[0]?.message?.content?.trim() || null;
          }
        }
      } catch (e) {
        console.error("Brain narrative generation failed:", e);
        // Non-fatal — digest still works without narrative
      }
    }

    // Step 4: Store digest
    const { data: digest, error: insertError } = await supabase
      .from("weekly_digests")
      .insert({
        user_id,
        workspace_id,
        week_start: weekStartStr,
        week_end: weekEndStr,
        stats,
        blockers_summary: blockersSummary,
        decisions_summary: decisionsSummary,
        narrative_text: narrativeText,
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store digest:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store digest" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 5: Send email if enabled
    const shouldEmail = send_email !== false && (!prefs || prefs.email !== false);
    if (shouldEmail && !isEmpty) {
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          // Get user email
          const { data: { user } } = await supabase.auth.getUser();
          const userEmail = user?.email;

          if (userEmail) {
            const { Resend } = await import("npm:resend@2.0.0");
            const resend = new Resend(RESEND_API_KEY);

            const bulletPoints = [
              stats.tasks_completed > 0
                ? `✅ ${stats.tasks_completed} tasks completed`
                : null,
              stats.tasks_created > 0
                ? `📝 ${stats.tasks_created} tasks created`
                : null,
              stats.tasks_blocked > 0
                ? `🚧 ${stats.tasks_blocked} tasks blocked`
                : null,
              decisionsSummary.tasks_from_chat_count +
                decisionsSummary.goals_from_chat_count >
              0
                ? `💬 ${decisionsSummary.tasks_from_chat_count + decisionsSummary.goals_from_chat_count} decisions from conversations`
                : null,
            ]
              .filter(Boolean)
              .map((b) => `<li style="margin-bottom:8px;">${b}</li>`)
              .join("");

            const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a; background: #fafafa;">
  <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e5e5;">
    <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600;">Your week at a glance 👀</h2>
    <p style="margin: 0 0 24px 0; font-size: 13px; color: #666;">${weekStartStr} — ${weekEndStr}</p>
    
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #333;">Here's a quick snapshot of how things moved this week.</p>
    
    <ul style="list-style: none; padding: 0; margin: 0 0 24px 0; font-size: 15px;">
      ${bulletPoints}
    </ul>

    ${narrativeText ? `<p style="margin: 0 0 24px 0; font-size: 14px; color: #555; font-style: italic; border-left: 3px solid #e5e5e5; padding-left: 12px;">${narrativeText}</p>` : ""}

    <a href="https://biz-os-brain.lovable.app/insights" 
       style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
      View full insights →
    </a>
  </div>
  
  <p style="text-align: center; font-size: 12px; color: #999; margin-top: 24px;">
    AI Business OS — Weekly Digest
  </p>
</body>
</html>`;

            await resend.emails.send({
              from: "AI Business OS <noreply@updates.lovable.app>",
              to: [userEmail],
              subject: "Here's how your week went 👀",
              html: emailHtml,
            });
          }
        }
      } catch (emailErr) {
        console.error("Email send failed (non-fatal):", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true, digest }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("weekly-digest error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate digest" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
