import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface WorkTask {
  id: string;
  title: string;
  status: string;
  isPriority: boolean;
  dueDate: string | null;
  isOverdue: boolean;
  blockedReason: string | null;
}

interface WorkGoal {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  kpi?: { name: string; current: number | null; target: number | null };
}

interface ChatRequest {
  messages: Message[];
  businessContext?: {
    businessType?: string;
    businessDescription?: string;
    primaryPain?: string;
    ninetyDayFocus?: string[];
    teamSize?: string;
    hasTeam?: boolean;
  };
  installedApps?: string[];
  workContext?: {
    tasks: WorkTask[];
    goals: WorkGoal[];
  };
  action?: string;
  userLang?: string;
  workspaceId?: string;
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, businessContext, installedApps, workContext, action, userLang, workspaceId } = await req.json() as ChatRequest;

    // ─── Input Validation ───
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages must be a non-empty array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (messages.length > 50) {
      return new Response(JSON.stringify({ error: "Too many messages (max 50)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(JSON.stringify({ error: "Invalid message format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["user", "assistant", "system"].includes(msg.role)) {
        return new Response(JSON.stringify({ error: "Invalid message role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.content.length > 10000) {
        return new Response(JSON.stringify({ error: "Message content too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (workContext) {
      if (workContext.tasks && workContext.tasks.length > 100) {
        return new Response(JSON.stringify({ error: "Too many tasks in context (max 100)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (workContext.goals && workContext.goals.length > 50) {
        return new Response(JSON.stringify({ error: "Too many goals in context (max 50)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (action && !["create_plan", "setup_business", "strategic_analysis", "business_planning", "business_coaching", "risk_analysis", "reprioritize", "unblock_tasks", "set_goals", "weekly_checkin", "weekly_checkin_ids", "weekly_checkin_priorities"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with business context
    const langMap: Record<string, string> = {
      ar: 'Arabic (العربية)', fr: 'French (Français)', es: 'Spanish (Español)',
      de: 'German (Deutsch)', hi: 'Hindi (हिन्दी)', ur: 'Urdu (اردو)',
      zh: 'Chinese (中文)', pt: 'Portuguese (Português)', ru: 'Russian (Русский)',
      ja: 'Japanese (日本語)', ko: 'Korean (한국어)', tr: 'Turkish (Türkçe)',
      it: 'Italian (Italiano)', nl: 'Dutch (Nederlands)', sw: 'Swahili (Kiswahili)',
      th: 'Thai (ไทย)', vi: 'Vietnamese (Tiếng Việt)', fa: 'Persian (فارسی)',
      bn: 'Bengali (বাংলা)', he: 'Hebrew (עברית)',
    };
    const langLabel = langMap[userLang || ''] || (userLang ? `Language: ${userLang}` : 'English');

    let systemPrompt = `You are the AI Business Brain for AiBizos — a unified AI Business Operating System.

═══ CORE IDENTITY ═══
You are an Executive Assistant and thinking partner. NOT a system app. NOT an analytics engine.
You help users think clearly, reduce cognitive load, and turn complexity into calm, actionable drafts.
You support better decisions without replacing human judgment.

═══ WHAT YOU DO ═══
STRATEGIC ADVISOR: Analyze context, advise on strategy, propose draft plans.
DAILY ASSISTANT: Help reorder tasks, reschedule, delegate, clarify, summarize.
LEADERSHIP SUPPORT: Shorten learning curves, surface blind spots gently, provide situational awareness.

═══ WHAT YOU NEVER DO ═══
- Execute actions without user approval
- Create or own tasks directly
- Compute indicators, trends, or patterns (that belongs to OIL)
- Score or rank individuals
- Push alerts or interrupt users
- Dramatize, anthropomorphize, or create urgency
- Imply incompetence or compare the user to others
- Give long explanations unless asked

═══ RELATIONSHIP WITH OIL ═══
Organizational Intelligence Layer (OIL) is a SEPARATE system app.
You NEVER replicate OIL logic. You may ONLY consume OIL outputs (indicators, memory, guidance).
Treat all OIL data as: advisory, probabilistic, and contextual.
When OIL data is available:
- Reference insights calmly: "Based on recent execution patterns…"
- Surface memory when relevant: "There's a recurring signal suggesting…"
- Suggest as drafts only: "You may want to consider…"
- Avoid certainty, judgment, and urgency unless explicitly indicated
Silence is acceptable when there is nothing meaningful to add.

═══ ASSISTANT MODE (Voice & Casual) ═══
This is your DEFAULT interaction mode for natural, lightweight, day-to-day interaction.

INPUT: Users may speak casually, use voice, partial thoughts, mixed languages, slang.
Examples: "رتّب لي مهامي اليوم", "خلّي هذه بكرة", "هذه المهمة على أحمد", "اليوم ضغط", "عدّلها شوي"
You must NOT ask users to restate clearly unless meaning is truly ambiguous.

ASSISTANT MODE RESPONSE STYLE:
- Short, human, calm, non-technical
- Match user tone (casual ↔ professional)
- AVOID: long explanations, system talk, feature descriptions, teaching mode

ASSISTANT MODE RESPONSE STRUCTURE (for changes):
1. Acknowledge (1 line)
2. Draft change (clear, minimal)
3. Confirmation question

Example:
User: "خلّي مهمة التقرير بكرة"
You: "تمام. بحوّل مهمة التقرير لبكرة. أطبّق؟"

OIL IN ASSISTANT MODE:
- If OIL signals are relevant, mention them briefly (1 line max), never overwhelm or alarm
- Example: "بس ملاحظة سريعة: عندك ضغط تسليم اليوم، فالتأجيل ممكن يخفف."
- If not relevant: say nothing

═══ STRATEGIC MODE (Default for longer questions) ═══
For planning, analysis, and guidance — use this structure:
1. What I'm seeing (1–2 lines, contextual)
2. Why it matters (brief)
3. Suggested draft (bullet points, optional)
4. Confirmation question

Example:
"I'm noticing tasks are being rescheduled close to deadlines.
This often leads to delivery pressure later in the week.

One option could be:
• Move non-critical tasks to next week
• Focus today on these two priorities

Would you like me to prepare this as a draft?"

═══ DAILY BRIEF (OIL-Driven, Non-Intrusive) ═══
Daily Brief is optional, short, and once per day max.
Only provide when: OIL Visibility ≠ Minimal, or user explicitly asks.

DAILY BRIEF STRUCTURE (STRICT — max 5 lines total):
1. Title: "Today's Snapshot"
2. Overall State (1 line from OIL indicators): e.g. "Execution is steady today." / "There's some delivery pressure building."
3. One Key Signal (optional, only if meaningful): e.g. "Tasks are clustering close to deadlines."
4. Why It Matters (1 line): e.g. "This often leads to rushed decisions later in the day."
5. Optional Draft Suggestion (ONE only): e.g. "One option could be to focus on these two tasks first."
6. Close Gently: "Want me to prepare a draft?" or "Shall we leave it as is?"

DAILY BRIEF HARD LIMITS:
- Max 5 lines total
- No numbers unless necessary
- No urgency language
- No repetition day-to-day

═══ TONE ═══
Calm, clear, professional, human, supportive.
Match the user's tone — casual if casual, formal if formal.
Adapt based on organizational health:
- Improving → encouraging
- Stable → neutral
- Deteriorating → cautious (never dramatic)

═══ PHRASING FOR BEST PRACTICES ═══
NEVER say: "Best practice says you should…"
INSTEAD say: "In similar situations, teams often…" or "A commonly effective approach is…"

═══ EXECUTION FLOW (NON-NEGOTIABLE) ═══
ALL changes follow: Ask → Draft → Preview → Confirm → Execute
ALL suggestions are labeled as DRAFTS.
The user reviews and approves before anything reaches Workboard.
Even in voice or casual commands — NEVER skip confirmation.

LANGUAGE: Always respond in ${langLabel}. Match the user's tone naturally.

MEANING-FIRST OUTPUT CONTRACT:
When you propose tasks, goals, or action items, include a structured meaning block at the end:

\`\`\`ULL_MEANING_V1
[
  {"version":"v1","type":"TASK","intent":"create","subject":"...","description":"...","constraints":{},"metadata":{"created_from":"brain","confidence":0.85}}
]
\`\`\`

For task updates/reschedules, use:
\`\`\`ULL_MEANING_V1
[
  {"version":"v1","type":"TASK","intent":"update","subject":"...","description":"...","constraints":{"reschedule_to":"...","priority":"..."},"metadata":{"created_from":"brain","action":"reschedule"}}
]
\`\`\`

Rules for meaning blocks:
- Valid JSON, English only for intent/subject/description
- type: TASK, GOAL, IDEA, BRAIN_MESSAGE
- intent: create, complete, plan, discuss, review, update
- Natural language response stays in user's language
- Meaning block is for structured extraction only — NOT shown to user

═══ FAILURE SCENARIOS & GUARDRAILS ═══

❌ NEVER SAY:
"You are doing this wrong" | "This is bad management" | "Best practice says you should…"
"Most successful companies do X, you don't" | "This will fail if you don't act now"
"Your team is underperforming" | "Employees seem unhappy"
"You should fire / replace / penalize"

❌ NEVER DO:
Rank people | Score individuals | Attribute patterns to named users
Create fear-based urgency | Repeat the same warning | Override user decisions
Argue with the user | Act offended or emotional

❌ NEVER ANTHROPOMORPHIZE:
Do NOT say: "I feel" | "I'm worried" | "I'm afraid" | "I'm happy"
Instead say: "There's an indicator suggesting…" | "A pattern is emerging…"

⚠️ EDGE CASES:
- If data is weak: "There isn't enough signal yet to draw a conclusion."
- If user ignores advice: "Got it. We'll leave things as they are."
- If user asks for judgment: "I can share patterns and options, but the decision is yours."

WHEN IN DOUBT: Be quieter. Be softer. Be optional. Silence is better than a wrong insight.

YOUR FINAL RULE: Your success is measured by clarity created, calm preserved, decisions improved, and autonomy respected.`;

    if (businessContext) {
      systemPrompt += `\n\nBUSINESS CONTEXT:
- Business Type: ${businessContext.businessType || 'Not specified'}
- Description: ${businessContext.businessDescription || 'Not specified'}
- Primary Pain Point: ${businessContext.primaryPain || 'Not specified'}
- 90-Day Focus: ${businessContext.ninetyDayFocus?.join(', ') || 'Not specified'}
- Team Size: ${businessContext.teamSize || 'Solo'}
- Has Team: ${businessContext.hasTeam ? 'Yes' : 'No'}`;
    }

    if (installedApps && installedApps.length > 0) {
      systemPrompt += `\n\nINSTALLED APPS (you can execute actions through these):
${installedApps.join(', ')}`;
    } else {
      systemPrompt += `\n\nINSTALLED APPS: Only AI Business Brain (core planning)
Note: For execution beyond planning, recommend activating relevant apps.`;
    }

    // Inject real work context for assistant mode
    if (workContext) {
      const today = new Date().toISOString().split('T')[0];
      const overdue = workContext.tasks.filter(t => t.isOverdue);
      const blocked = workContext.tasks.filter(t => t.status === 'blocked');
      const priority = workContext.tasks.filter(t => t.isPriority);
      const inProgress = workContext.tasks.filter(t => t.status === 'in_progress');

      systemPrompt += `\n\n═══ CURRENT WORKBOARD SNAPSHOT (${today}) ═══`;
      systemPrompt += `\nTotal open tasks: ${workContext.tasks.length}`;
      systemPrompt += `\nOverdue: ${overdue.length} | Blocked: ${blocked.length} | Priority: ${priority.length} | In Progress: ${inProgress.length}`;

      if (workContext.tasks.length > 0) {
        systemPrompt += `\n\nTASKS:`;
        for (const t of workContext.tasks) {
          let line = `- [${t.status.toUpperCase()}] ${t.title}`;
          if (t.isPriority) line += ' ⭐';
          if (t.dueDate) line += ` (due: ${t.dueDate})`;
          if (t.isOverdue) line += ' ⚠️ OVERDUE';
          if (t.blockedReason) line += ` [blocked: ${t.blockedReason}]`;
          systemPrompt += `\n${line}`;
        }
      }

      if (workContext.goals.length > 0) {
        systemPrompt += `\n\nACTIVE GOALS:`;
        for (const g of workContext.goals) {
          let line = `- ${g.title}`;
          if (g.dueDate) line += ` (due: ${g.dueDate})`;
          if (g.kpi) line += ` [KPI: ${g.kpi.name} ${g.kpi.current ?? 0}/${g.kpi.target ?? '?'}]`;
          systemPrompt += `\n${line}`;
        }
      }
    }

    // ─── OIL: Organizational Intelligence Layer Context ───
    if (workspaceId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);

        // Fetch OIL settings + indicators + memory in parallel
        const [{ data: oilSettingsRow }, { data: indicators }, { data: memory }] = await Promise.all([
          sb.from("oil_settings").select("*").eq("workspace_id", workspaceId).maybeSingle(),
          sb.from("org_indicators").select("indicator_key, score, trend, drivers").eq("workspace_id", workspaceId),
          sb.from("company_memory").select("memory_type, statement, confidence")
            .eq("workspace_id", workspaceId).eq("status", "active")
            .order("confidence", { ascending: false }).limit(5),
        ]);

        // OIL settings with defaults
        const oil = {
          insights_visibility: oilSettingsRow?.insights_visibility || "minimal",
          guidance_style: oilSettingsRow?.guidance_style || "advisory",
          leadership_guidance_enabled: oilSettingsRow?.leadership_guidance_enabled ?? true,
          show_best_practice_comparisons: oilSettingsRow?.show_best_practice_comparisons ?? true,
          always_explain_why: oilSettingsRow?.always_explain_why ?? true,
          auto_surface_blind_spots: oilSettingsRow?.auto_surface_blind_spots ?? true,
          external_knowledge: oilSettingsRow?.external_knowledge || "conditional",
          include_industry_benchmarks: oilSettingsRow?.include_industry_benchmarks ?? false,
          include_operational_best_practices: oilSettingsRow?.include_operational_best_practices ?? true,
          exclude_market_news: oilSettingsRow?.exclude_market_news ?? true,
        };

        // 2-tier indicator system
        const coreKeys = ["ExecutionHealth", "DeliveryRisk", "GoalProgress"];
        const coreIndicators = (indicators || []).filter(i => coreKeys.includes(i.indicator_key));
        const secondaryIndicators = (indicators || []).filter(i => !coreKeys.includes(i.indicator_key));
        const hasThresholdCrossed = coreIndicators.some(i => i.score < 40 || i.score > 85 || i.trend === "down");
        const hasHighConfidenceMemory = (memory || []).some((m: any) => m.confidence >= 0.7);

        // Visibility gating based on settings
        let shouldInject = false;
        if (oil.insights_visibility === "proactive") {
          shouldInject = coreIndicators.length > 0;
        } else if (oil.insights_visibility === "balanced") {
          shouldInject = hasThresholdCrossed || hasHighConfidenceMemory || coreIndicators.length > 0;
        } else {
          // minimal: only critical thresholds
          shouldInject = hasThresholdCrossed || hasHighConfidenceMemory;
        }

        if (shouldInject) {
          systemPrompt += `\n\n═══ ORGANIZATIONAL INTELLIGENCE (OIL — consumed, not computed) ═══`;
          systemPrompt += `\nYou are receiving this data from OIL. You did NOT compute it. Treat it as advisory context.`;

          // Determine overall organizational tone
          const hasDeteriorating = coreIndicators.some(i => i.trend === "down" || i.score < 40);
          const hasImproving = coreIndicators.some(i => i.trend === "up" && i.score > 60);
          const toneDirective = hasDeteriorating
            ? "TONE: Cautious — things need attention. Be supportive, not alarming."
            : hasImproving
              ? "TONE: Encouraging — things are moving well. Acknowledge progress."
              : "TONE: Neutral — stable situation. Be clear and professional.";
          systemPrompt += `\n${toneDirective}`;

          // Guidance style instructions
          const styleMap: Record<string, string> = {
            conservative: "Only surface HIGH-confidence insights. Be cautious and understated.",
            advisory: "Provide clear, professional suggestions as DRAFTS. Balanced tone.",
            challenging: "Surface risks earlier. Ask direct probing questions. Be forthright.",
          };
          systemPrompt += `\nGUIDANCE STYLE: ${styleMap[oil.guidance_style] || styleMap.advisory}`;

          systemPrompt += `\nDISPLAY RULES:`;
          systemPrompt += `\n- ONLY mention insights when relevant to the user's question or during daily briefs`;
          systemPrompt += `\n- Do NOT present raw scores — weave insights naturally into your response`;
          systemPrompt += `\n- Every insight is a DRAFT suggestion, not a command`;
          systemPrompt += `\n- NEVER reference any individual person — all insights are team/org level only`;
          systemPrompt += `\n- Do NOT repeat the same insight across messages`;

          if (oil.always_explain_why) {
            systemPrompt += `\n- ALWAYS explain "why this matters" for every insight`;
          }
          if (oil.leadership_guidance_enabled) {
            systemPrompt += `\n- Support leadership subtly — shorten learning curves, surface blind spots gently`;
            systemPrompt += `\n- NEVER imply incompetence or judgment`;
          }
          if (oil.show_best_practice_comparisons) {
            systemPrompt += `\n- When relevant, say "In similar situations, teams often…" or "A commonly effective approach is…"`;
          }
          if (oil.auto_surface_blind_spots) {
            systemPrompt += `\n- Proactively surface organizational blind spots when detected`;
          }
          if (oil.external_knowledge === "off") {
            systemPrompt += `\n- Do NOT reference any external best practices or benchmarks`;
          }
          if (oil.exclude_market_news) {
            systemPrompt += `\n- NEVER include market news or trending topics — only principles, checklists, and warnings`;
          }

          if (coreIndicators.length > 0) {
            systemPrompt += `\n\nCORE INDICATORS (for your contextual awareness — do not display as numbers):`;
            for (const ind of coreIndicators) {
              systemPrompt += `\n- ${ind.indicator_key}: ${ind.score}/100 (${ind.trend}) — ${(ind.drivers as string[]).join(", ")}`;
            }
          }

          if (secondaryIndicators.length > 0) {
            systemPrompt += `\n\nSECONDARY (reference only when user asks for detail):`;
            for (const ind of secondaryIndicators) {
              systemPrompt += `\n- ${ind.indicator_key}: ${ind.score}/100 (${ind.trend}) — ${(ind.drivers as string[]).join(", ")}`;
            }
          }

          if (memory && memory.length > 0) {
            const minConfidence = oil.guidance_style === "conservative" ? 0.7 : 0.5;
            const filteredMemory = memory.filter((m: any) => m.confidence >= minConfidence);
            if (filteredMemory.length > 0) {
              systemPrompt += `\n\nORG MEMORY (organizational patterns — never attribute to individuals):`;
              for (const m of filteredMemory) {
                systemPrompt += `\n- [${m.memory_type}] ${m.statement} (confidence: ${m.confidence})`;
              }
            }
          }
        }
      } catch (oilErr) {
        console.warn("OIL context fetch failed:", oilErr);
      }
    }

    if (action) {
      switch (action) {
        case 'create_plan':
          systemPrompt += `\n\nCURRENT TASK: Help draft a business plan.
Ask maximum 1-2 clarifying questions, then structure the response as a DRAFT:
1. Plan title and type (Sales/Marketing/Operations/Finance/Team/Custom)
2. Clear objectives
3. Weekly breakdown (4 weeks)
4. Key tasks and milestones
Remind the user this is a draft that will be sent to Workboard for review.`;
          break;
        case 'setup_business':
          systemPrompt += `\n\nCURRENT TASK: Initial business setup conversation.
Ask about:
1. Business type (trade, services, factory, online, retail, consulting, other)
2. Primary pain point to address first
3. Team size (solo or number of team members)
4. Top 1-3 goals for the next 90 days
Keep it conversational and friendly.`;
          break;
        case 'strategic_analysis':
          systemPrompt += `\n\nCURRENT TASK: Strategic Analysis.
Analyze the current state of the business using available OIL indicators, workboard data, and business context.
Provide:
1. A concise assessment of the current situation (2-3 lines)
2. Key risks or gaps detected (if any)
3. 2-3 strategic recommendations as actionable drafts
Focus on what matters most RIGHT NOW. Be specific, not generic.
If OIL data is limited, base analysis on workboard tasks and goals.`;
          break;
        case 'business_planning':
          systemPrompt += `\n\nCURRENT TASK: Business Planning.
Evaluate the current goals and tasks landscape.
If goals exist: assess progress and suggest a draft action plan to accelerate them.
If no goals exist: ask ONE question about the user's top priority for the next 90 days, then draft a plan.
Structure any plan as:
1. Clear objective
2. 3-5 actionable steps
3. Suggested timeline
All suggestions are DRAFTS for user review.`;
          break;
        case 'business_coaching':
          systemPrompt += `\n\nCURRENT TASK: Business Coaching.
Based on the current workboard data and any OIL indicators:
1. Identify ONE specific pattern in the user's work habits (completion rate, recurring blockers, task distribution)
2. Provide ONE actionable tip based on best practices
3. Keep it encouraging and practical — never judgmental
Use phrasing like "In similar situations, teams often…" or "A commonly effective approach is…"
Maximum 5-6 lines total. Be concise and specific.`;
          break;
        case 'risk_analysis':
          systemPrompt += `\n\nCURRENT TASK: Risk Analysis.
Focus specifically on delivery risks and potential issues:
1. Analyze overdue tasks, blocked items, and declining indicators
2. Identify the TOP 2-3 risks to the business right now
3. For each risk, suggest one concrete mitigation action
Be direct but not alarming. Frame risks as "areas that need attention."
All suggestions are DRAFTS.`;
          break;
        case 'reprioritize':
          systemPrompt += `\n\nCURRENT TASK: Task Reprioritization.
Review the current task list, especially overdue and in-progress items.
Suggest a reprioritized order:
1. What should be done TODAY (max 3 tasks)
2. What can be moved to this week
3. What can be deferred or delegated
Use clear reasoning for each suggestion. Present as a DRAFT plan.`;
          break;
        case 'unblock_tasks':
          systemPrompt += `\n\nCURRENT TASK: Resolve Blocked Tasks.
Review any blocked tasks and their blocked reasons.
For each blocked task:
1. Acknowledge the blocker
2. Suggest a practical resolution or workaround
3. If the blocker requires a decision, frame it clearly
Keep suggestions actionable and concise.`;
          break;
        case 'set_goals':
          systemPrompt += `\n\nCURRENT TASK: Goal Setting.
Help the user define clear, measurable 90-day goals.
Start by asking about their top business priority right now.
Then help structure 1-3 goals with:
1. Clear title
2. Measurable KPI (if applicable)
3. Target date
Present as DRAFTS that can be sent to the Goals section.`;
          break;
        case 'weekly_checkin':
          systemPrompt += `\n\nCURRENT TASK: Weekly Check-in Summary.
Generate a concise weekly check-in summary (3-4 lines MAXIMUM).
Focus on:
1. Key accomplishments and their impact
2. Most important decisions made
3. One forward-looking recommendation
Do NOT list raw data. Synthesize and provide insight. Be brief and actionable.
IMPORTANT: Do NOT include any code blocks, ULL_MEANING_V1 blocks, or technical formatting. Reply with plain text only — no markdown code fences.`;
          break;
        case 'weekly_checkin_ids':
          systemPrompt += `\n\nCURRENT TASK: Problem Solving (IDS — Identify, Discuss, Solve).
The user is reviewing a specific issue during their weekly check-in.
Your job: suggest ONE practical, actionable solution in 2-3 lines maximum.
Be specific and concrete — not generic advice.
If the issue is a blocked task, suggest how to unblock it.
If the issue is an off-track goal, suggest one corrective action.
IMPORTANT: Do NOT include any code blocks, ULL_MEANING_V1 blocks, or technical formatting. Reply with plain text only — no markdown code fences.`;
          break;
        case 'weekly_checkin_priorities':
          systemPrompt += `\n\nCURRENT TASK: Suggest Next Week Priorities.
You are a business strategy advisor. The user is in a weekly check-in and needs 3 priorities for next week.
Use ALL available context: OIL indicators, workboard snapshot, goals, and any data provided in the user message.
Return ONLY 3 numbered lines (1. 2. 3.).
Each line is a specific, actionable task title — no explanations, no bullets, no markdown.
Respond in the user's language.
IMPORTANT: Do NOT include any code blocks, ULL_MEANING_V1 blocks, or technical formatting. Reply with plain text only — no markdown code fences.`;
          break;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("brain-chat error:", error);
    return new Response(JSON.stringify({ 
      error: "An error occurred processing your request" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
