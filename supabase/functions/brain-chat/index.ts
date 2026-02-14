import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───

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
  systemContext?: {
    user_role?: string;
    installed_modules?: { id: string; name: string; actions: { key: string; title: string; description: string; risk?: string }[] }[];
    recent_activity?: { tasks_created_7d: number; tasks_completed_7d: number; blocked_tasks_count: number; overdue_count: number };
  };
  workContext?: { tasks: WorkTask[]; goals: WorkGoal[] };
  action?: string;
  intentOverride?: string;
  userLang?: string;
  workspaceId?: string;
}

interface IntentResult {
  intent: string;
  confidence: number;
  risk_level: string;
  modules_relevant: string[];
  requires_simulation: boolean;
}

// ─── Legacy Actions (backwards compatible) ───
const LEGACY_ACTIONS = [
  "create_plan", "setup_business", "strategic_analysis", "business_planning",
  "business_coaching", "risk_analysis", "reprioritize", "unblock_tasks",
  "set_goals", "weekly_checkin", "weekly_checkin_ids", "weekly_checkin_priorities",
  "suggest_assignee",
];

// ─── Valid Intents ───
const VALID_INTENTS = ["guide", "suggest", "architect", "design", "simulate", "diagnose", "detect_risk", "strategic_think", "delegate", "clarify", "casual"];

// ─── Module Action Registry ───
const MODULE_ACTIONS: Record<string, { name: string; actions: { key: string; title: string; description: string; risk?: string }[] }> = {
  brain: {
    name: "AI Business Brain",
    actions: [
      { key: "create_plan", title: "Create Business Plan", description: "Draft a structured business plan" },
      { key: "strategic_analysis", title: "Strategic Analysis", description: "Analyze business state and provide strategic recommendations" },
      { key: "business_planning", title: "Business Planning", description: "Evaluate goals and suggest action plans" },
      { key: "business_coaching", title: "Business Coaching", description: "Identify patterns and provide coaching tips" },
      { key: "risk_analysis", title: "Risk Analysis", description: "Identify delivery risks and mitigation actions", risk: "medium" },
      { key: "setup_business", title: "Business Setup", description: "Initial business setup conversation" },
      { key: "simulate", title: "Simulate Scenario", description: "Run what-if scenario analysis", risk: "low" },
      { key: "diagnose", title: "Diagnose Issues", description: "Root-cause analysis of business problems" },
    ],
  },
  workboard: {
    name: "Workboard",
    actions: [
      { key: "reprioritize", title: "Reprioritize Tasks", description: "Suggest reprioritized task order" },
      { key: "unblock_tasks", title: "Unblock Tasks", description: "Suggest resolutions for blocked tasks" },
      { key: "set_goals", title: "Set Goals", description: "Help define measurable 90-day goals" },
      { key: "suggest_assignee", title: "Suggest Assignee", description: "Recommend best team member for a task" },
    ],
  },
  oil: {
    name: "Organizational Intelligence Layer",
    actions: [
      { key: "detect_risk", title: "Detect Risks", description: "Proactive risk identification from OIL indicators" },
    ],
  },
  booking: {
    name: "Bookivo",
    actions: [
      { key: "analyze_booking_performance", title: "Booking Performance", description: "Analyze booking metrics and trends" },
      { key: "suggest_pricing", title: "Suggest Pricing", description: "Suggest pricing adjustments based on data" },
    ],
  },
  chat: {
    name: "Team Chat",
    actions: [
      { key: "summarize_thread", title: "Summarize Thread", description: "Summarize a chat thread's key decisions" },
    ],
  },
  leadership: {
    name: "Executive Intelligence",
    actions: [
      { key: "leadership_coaching", title: "Leadership Coaching", description: "AI-powered executive coaching" },
      { key: "team_dynamics", title: "Team Dynamics", description: "Analyze team dynamics and alignment" },
    ],
  },
};

// ─── Fix A: Server-Side Installed Apps Fetch ───
async function fetchInstalledApps(sb: any, workspaceId: string): Promise<string[]> {
  try {
    const { data, error } = await sb
      .from("workspace_apps")
      .select("app_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);
    if (error || !data || data.length === 0) return ["brain"];
    const ids = data.map((r: any) => r.app_id as string);
    if (!ids.includes("brain")) ids.push("brain");
    return ids;
  } catch {
    return ["brain"];
  }
}

// ─── Intent Classifier ───
async function classifyIntent(
  message: string,
  conversationContext: Message[],
  apiKey: string,
): Promise<IntentResult> {
  const VALID_RISK = ["low", "medium", "high"];

  const fallback: IntentResult = {
    intent: "suggest",
    confidence: 0.4,
    risk_level: "low",
    modules_relevant: [],
    requires_simulation: false,
  };

  try {
    const recentContext = conversationContext.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are an intent classifier for an AI business assistant. Classify the user's message into exactly one intent.

Output ONLY valid JSON (no markdown, no code fences):
{"intent":"<one of: guide,suggest,architect,design,simulate,diagnose,detect_risk,strategic_think,delegate,clarify,casual>","confidence":<0.0-1.0>,"risk_level":"<low|medium|high>","modules_relevant":["<module_ids>"],"requires_simulation":<true|false>}

Intent definitions:
- guide: General business guidance, advice, coaching
- suggest: Propose tasks, goals, plans, ideas
- architect: Design systems, processes, workflows
- design: Help structure business models, strategies
- simulate: "What if" scenario analysis, impact modeling
- diagnose: Identify root causes of problems
- detect_risk: Proactive risk identification
- strategic_think: Long-term thinking beyond immediate tasks
- delegate: Task assignment and team coordination
- clarify: Ambiguous input, needs more info
- casual: Greetings, simple questions, off-topic

Module IDs: brain, workboard, oil, booking, chat, leadership

Recent conversation:
${recentContext}`,
          },
          { role: "user", content: message },
        ],
        stream: false,
      }),
    });

    if (!resp.ok) return fallback;

    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";

    // Strip code fences
    content = content.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(content);

    // Validate
    if (!VALID_INTENTS.includes(parsed.intent)) return fallback;
    if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) parsed.confidence = 0.5;
    if (!VALID_RISK.includes(parsed.risk_level)) parsed.risk_level = "low";
    if (!Array.isArray(parsed.modules_relevant)) parsed.modules_relevant = [];
    if (typeof parsed.requires_simulation !== "boolean") parsed.requires_simulation = false;

    return parsed as IntentResult;
  } catch (e) {
    console.warn("Intent classification failed, using fallback:", e);
    return fallback;
  }
}

// ─── Fix B: Resolve Intent (classifier OR override) ───
function resolveIntentOverride(intentOverride: string | undefined): IntentResult | null {
  if (!intentOverride || !VALID_INTENTS.includes(intentOverride)) return null;
  // Map intent to likely relevant modules
  const moduleMap: Record<string, string[]> = {
    simulate: ["brain", "workboard", "oil"],
    diagnose: ["brain", "workboard", "oil"],
    detect_risk: ["oil", "workboard"],
    architect: ["brain"],
    strategic_think: ["brain"],
    delegate: ["workboard"],
  };
  return {
    intent: intentOverride,
    confidence: 0.95,
    risk_level: intentOverride === "detect_risk" ? "medium" : "low",
    modules_relevant: moduleMap[intentOverride] || ["brain"],
    requires_simulation: intentOverride === "simulate",
  };
}

// ─── Decision Signals (inline, reused from decision-signals logic) ───
interface DecisionSignal {
  signal_type: string;
  title: string;
  explanation: string;
  confidence_level: string;
}

async function fetchDecisionSignals(sb: any, workspaceId: string): Promise<DecisionSignal[]> {
  try {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [openTasksRes, completedRes, createdRes, blockedRes, goalsRes] = await Promise.all([
      sb.from("tasks").select("id, title, status, blocked_reason, updated_at, created_at, goal_id")
        .eq("workspace_id", workspaceId).in("status", ["backlog", "planned", "in_progress", "blocked"]).limit(100),
      sb.from("tasks").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).eq("status", "done").gte("completed_at", fourteenDaysAgo),
      sb.from("tasks").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).gte("created_at", fourteenDaysAgo),
      sb.from("tasks").select("id, title, blocked_reason, updated_at")
        .eq("workspace_id", workspaceId).eq("status", "blocked").limit(30),
      sb.from("goals").select("id, title, status, created_at")
        .eq("workspace_id", workspaceId).eq("status", "active").limit(20),
    ]);

    const signals: DecisionSignal[] = [];
    const blocked = blockedRes.data || [];
    const goals = goalsRes.data || [];
    const openTasks = openTasksRes.data || [];
    const createdCount = createdRes.count || 0;
    const completedCount = completedRes.count || 0;

    // Long-blocked tasks
    for (const t of blocked.slice(0, 2)) {
      const days = Math.floor((now.getTime() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      if (days >= 6) {
        signals.push({
          signal_type: "repeated_blocker",
          title: `"${t.title}" blocked for ${days} days`,
          explanation: t.blocked_reason || "No reason specified",
          confidence_level: days >= 10 ? "high" : "medium",
        });
      }
    }

    // Dormant goals
    for (const g of goals.slice(0, 5)) {
      const age = Math.floor((now.getTime() - new Date(g.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (age >= 7) {
        const linked = openTasks.filter((t: any) => t.goal_id === g.id);
        const hasProgress = linked.some((t: any) => t.status === "in_progress" || t.status === "done");
        if (linked.length === 0 || !hasProgress) {
          signals.push({
            signal_type: "dormant_goal",
            title: `Goal "${g.title}" has no progress (${age}d)`,
            explanation: linked.length === 0 ? "No linked tasks" : "All linked tasks are stale",
            confidence_level: age >= 14 ? "high" : "medium",
          });
        }
      }
    }

    // Work imbalance
    if (createdCount >= 5 && completedCount / createdCount < 0.3) {
      signals.push({
        signal_type: "work_imbalance",
        title: `${createdCount} tasks created, ${completedCount} completed (14d)`,
        explanation: `Completion ratio: ${Math.round((completedCount / createdCount) * 100)}%`,
        confidence_level: completedCount / createdCount < 0.15 ? "high" : "medium",
      });
    }

    return signals.slice(0, 7);
  } catch (e) {
    console.warn("Decision signals fetch failed:", e);
    return [];
  }
}

// ─── Build Dynamic Action Registry ───
function buildActionRegistry(installedAppIds: string[]): { key: string; title: string; description: string; source_module: string }[] {
  const actions: { key: string; title: string; description: string; source_module: string }[] = [];
  const seen = new Set<string>();

  for (const appId of installedAppIds) {
    const mod = MODULE_ACTIONS[appId];
    if (!mod) continue;
    for (const a of mod.actions) {
      if (!seen.has(a.key)) {
        seen.add(a.key);
        actions.push({ key: a.key, title: a.title, description: a.description, source_module: appId });
      }
    }
  }

  return actions;
}

// ─── Validate Action ───
function isValidAction(action: string, registry: { key: string }[]): boolean {
  if (LEGACY_ACTIONS.includes(action)) return true;
  return registry.some(a => a.key === action);
}

// ─── Fix F: Prompt Builder (compact structured JSON sections) ───
function buildSystemPrompt(params: {
  langLabel: string;
  businessContext?: ChatRequest["businessContext"];
  installedAppIds: string[];
  workContext?: ChatRequest["workContext"];
  intent: IntentResult;
  action?: string;
  actionRegistry: { key: string; title: string; description: string; source_module: string }[];
  decisionSignals: DecisionSignal[];
  oilPromptSection: string;
  userRole: string;
}): string {
  const { langLabel, businessContext, installedAppIds, workContext, intent, action, actionRegistry, decisionSignals, oilPromptSection, userRole } = params;

  // ═══ CORE IDENTITY (prose — needed for model comprehension) ═══
  let prompt = `You are the AI Business Brain for AiBizos — a unified AI Business Operating System.

═══ CORE IDENTITY ═══
You are an Executive Assistant and thinking partner. NOT a system app. NOT an analytics engine.
You help users think clearly, reduce cognitive load, and turn complexity into calm, actionable drafts.
You support better decisions without replacing human judgment.

═══ WHAT YOU DO ═══
STRATEGIC ADVISOR: Analyze context, advise on strategy, propose draft plans.
DAILY ASSISTANT: Help reorder tasks, reschedule, delegate, clarify, summarize.
LEADERSHIP SUPPORT: Shorten learning curves, surface blind spots gently, provide situational awareness.
INTELLIGENCE ORCHESTRATOR: Reason across all installed modules, classify intent, simulate scenarios, diagnose issues.

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
OIL is a SEPARATE system app. You NEVER replicate OIL logic. You may ONLY consume OIL outputs.
Treat all OIL data as: advisory, probabilistic, and contextual.
When OIL data is available: reference calmly, suggest as drafts only, avoid certainty/judgment/urgency.
Silence is acceptable when there is nothing meaningful to add.

═══ ASSISTANT MODE (Voice & Casual) ═══
DEFAULT interaction mode. Users may speak casually, use voice, partial thoughts, mixed languages, slang.
Response: Short, human, calm, non-technical. Match user tone. Structure: Acknowledge → Draft → Confirm.
OIL in assistant mode: 1 line max if relevant, else nothing.

═══ STRATEGIC MODE (Default for longer questions) ═══
Structure: 1. What I'm seeing (1–2 lines) 2. Why it matters 3. Suggested draft 4. Confirmation question.

═══ DAILY BRIEF (max 5 lines, once/day) ═══
Structure: Title → State → Signal → Why → Draft → Close. No numbers unless necessary. No urgency.

═══ TONE ═══
Calm, clear, professional, human, supportive. Match user tone. Adapt to org health.

═══ EXECUTION FLOW (NON-NEGOTIABLE) ═══
YOU MUST NEVER EXECUTE ANY DATABASE ACTION. YOU ARE THINK-ONLY.
ALL changes follow: Ask → Draft → Preview → Confirm → Execute (via separate secure endpoint).
ALL suggestions are labeled as DRAFTS. Even in voice/casual — NEVER skip confirmation.

═══ GUARDRAILS ═══
NEVER: "You are doing this wrong" | rank people | score individuals | create urgency | override user | anthropomorphize.
INSTEAD: "In similar situations, teams often…" | "A pattern is emerging…"
WHEN IN DOUBT: Be quieter. Be softer. Be optional. Silence > wrong insight.

LANGUAGE: Always respond in ${langLabel}. Match the user's tone naturally.

═══ PROPOSAL OUTPUT CONTRACT ═══
When you propose actionable items, include at end:

\`\`\`BRAIN_PROPOSALS
[{"id":"<uuid>","type":"task|goal|plan|idea|update","title":"English title","payload":{...},"required_role":"member|admin|owner"}]
\`\`\`

Rules: Valid JSON only. English for structured fields. Natural language in user's language. You MUST NOT execute proposals.`;

  // ═══ SYSTEM CONTEXT (compact) ═══
  prompt += `\n\n═══ SYSTEM CONTEXT ═══`;
  prompt += `\nRole: ${userRole} | Modules: ${installedAppIds.join(", ") || "brain"}`;

  // ═══ INTENT AWARENESS ═══
  prompt += `\nIntent: ${intent.intent} (${intent.confidence.toFixed(2)}) | Risk: ${intent.risk_level}`;
  if (intent.modules_relevant.length > 0) {
    prompt += ` | Relevant: ${intent.modules_relevant.join(", ")}`;
  }

  // ═══ BUSINESS CONTEXT (compact) ═══
  if (businessContext) {
    const bc = businessContext;
    prompt += `\n\n═══ BUSINESS ═══`;
    prompt += `\n${JSON.stringify({ type: bc.businessType, desc: bc.businessDescription, pain: bc.primaryPain, focus90d: bc.ninetyDayFocus, teamSize: bc.teamSize, hasTeam: bc.hasTeam })}`;
  }

  // ═══ Fix F: AVAILABLE ACTIONS (compact JSON) ═══
  if (actionRegistry.length > 0) {
    prompt += `\n\n═══ ACTIONS (Ask→Draft→Confirm→Execute) ═══`;
    prompt += `\n${JSON.stringify(actionRegistry.map(a => ({ k: a.key, t: a.title, m: a.source_module })))}`;
  }

  // ═══ Fix F: WORKBOARD SNAPSHOT (compact JSON) ═══
  if (workContext) {
    const today = new Date().toISOString().split("T")[0];
    const summary = {
      date: today,
      total: workContext.tasks.length,
      overdue: workContext.tasks.filter(t => t.isOverdue).length,
      blocked: workContext.tasks.filter(t => t.status === "blocked").length,
      priority: workContext.tasks.filter(t => t.isPriority).length,
      inProgress: workContext.tasks.filter(t => t.status === "in_progress").length,
    };
    // Compact task list: only key fields
    const tasks = workContext.tasks.map(t => {
      const o: any = { s: t.status, t: t.title };
      if (t.isPriority) o.p = true;
      if (t.dueDate) o.d = t.dueDate;
      if (t.isOverdue) o.ov = true;
      if (t.blockedReason) o.br = t.blockedReason;
      return o;
    });
    const goals = workContext.goals.map(g => {
      const o: any = { t: g.title };
      if (g.dueDate) o.d = g.dueDate;
      if (g.kpi) o.kpi = `${g.kpi.name}:${g.kpi.current ?? 0}/${g.kpi.target ?? "?"}`;
      return o;
    });

    prompt += `\n\n═══ WORKBOARD ═══`;
    prompt += `\n${JSON.stringify({ ...summary, tasks, goals })}`;
  }

  // ═══ OIL CONTEXT (injected if available) ═══
  if (oilPromptSection) {
    prompt += oilPromptSection;
  }

  // ═══ Fix F: PASSIVE INSIGHTS (compact JSON) ═══
  if (decisionSignals.length > 0) {
    prompt += `\n\n═══ PASSIVE INSIGHTS (surface only if relevant, no spam) ═══`;
    prompt += `\n${JSON.stringify(decisionSignals.map(s => ({ type: s.signal_type, title: s.title, info: s.explanation, conf: s.confidence_level })))}`;
  }

  // ═══ SIMULATION PROTOCOL ═══
  if (intent.intent === "simulate" || intent.requires_simulation) {
    prompt += `\n\n═══ SIMULATION PROTOCOL ═══
Produce: 1.Assumptions 2.Inputs Used 3.Impact Summary 4.Risks & Confidence 5.Disclaimer("simulation, not commitment").
Do NOT propose execution. Only show what-if. If user wants changes, output a DRAFT.`;
  }

  // ═══ DIAGNOSE PROTOCOL ═══
  if (intent.intent === "diagnose") {
    prompt += `\n\n═══ DIAGNOSE PROTOCOL ═══
Structure: 1.Symptoms 2.Possible Causes (ranked) 3.Recommended Investigation 4.Draft Action. Calm, evidence-based.`;
  }

  // ═══ DETECT RISK PROTOCOL ═══
  if (intent.intent === "detect_risk") {
    prompt += `\n\n═══ RISK DETECTION PROTOCOL ═══
Structure: 1.Current Risks 2.Emerging Risks 3.Blind Spots 4.Mitigation Drafts. Frame as "areas worth attention."`;
  }

  // ═══ ACTION INSTRUCTIONS (legacy actions) ═══
  if (action) {
    const actionInstructions = getActionInstructions(action);
    if (actionInstructions) {
      prompt += actionInstructions;
    }
  }

  // ═══ BRAIN_META INSTRUCTION ═══
  prompt += `\n\n═══ INTERNAL METADATA (MANDATORY) ═══
At the VERY END of every response, append:

\`\`\`BRAIN_META
{"intent":"${intent.intent}","confidence":${intent.confidence.toFixed(2)},"risk_level":"${intent.risk_level}","modules_consulted":${JSON.stringify(intent.modules_relevant)},"simulation_used":${intent.intent === "simulate" || intent.requires_simulation}}
\`\`\`

Internal tracking only. Do not reference it in response text.`;

  return prompt;
}

// ─── Legacy Action Instructions ───
function getActionInstructions(action: string): string | null {
  const map: Record<string, string> = {
    create_plan: `\n\nTASK: Draft a business plan. Ask 1-2 questions, then structure: title, objectives, weekly breakdown (4w), tasks/milestones. DRAFT for review.`,
    setup_business: `\n\nTASK: Business setup. Ask: type, pain point, team size, 90-day goals. Conversational.`,
    strategic_analysis: `\n\nTASK: Strategic Analysis. 1.Current assessment (2-3 lines) 2.Risks/gaps 3.2-3 strategic draft recommendations. Specific, not generic.`,
    business_planning: `\n\nTASK: Business Planning. If goals exist: assess progress, draft acceleration plan. If not: ask ONE priority question, then draft. Structure: objective, 3-5 steps, timeline. DRAFTS.`,
    business_coaching: `\n\nTASK: Coaching. 1.ONE pattern 2.ONE tip. Max 5-6 lines. Encouraging, practical.`,
    risk_analysis: `\n\nTASK: Risk Analysis. 1.Analyze overdue/blocked/declining 2.TOP 2-3 risks 3.One mitigation per risk. Direct, not alarming. DRAFTS.`,
    reprioritize: `\n\nTASK: Reprioritize. 1.TODAY (max 3) 2.This week 3.Defer/delegate. DRAFT plan.`,
    unblock_tasks: `\n\nTASK: Unblock. Per blocked task: 1.Acknowledge 2.Resolution/workaround 3.Frame decisions clearly. Actionable.`,
    set_goals: `\n\nTASK: Goal Setting. Ask top priority. Structure 1-3 goals: title, KPI, target date. DRAFTS.`,
    weekly_checkin: `\n\nTASK: Weekly summary (3-4 lines MAX). 1.Accomplishments 2.Decisions 3.One recommendation. Synthesize, don't list. Plain text only.`,
    weekly_checkin_ids: `\n\nTASK: IDS problem solving. ONE solution, 2-3 lines max. Specific. Plain text only.`,
    weekly_checkin_priorities: `\n\nTASK: Next week priorities. ONLY 3 numbered lines. Specific task titles, no explanations. User's language. Plain text only.`,
    suggest_assignee: `\n\nTASK: Suggest assignee. Return ONLY JSON (no markdown): {"user_id":"the_id","reason":"one sentence in user language"}`,
  };
  return map[action] || null;
}

// ─── Build OIL Section ───
async function buildOILSection(sb: any, workspaceId: string): Promise<string> {
  try {
    const [{ data: oilSettingsRow }, { data: indicators }, { data: memory }] = await Promise.all([
      sb.from("oil_settings").select("*").eq("workspace_id", workspaceId).maybeSingle(),
      sb.from("org_indicators").select("indicator_key, score, trend, drivers").eq("workspace_id", workspaceId),
      sb.from("company_memory").select("memory_type, statement, confidence")
        .eq("workspace_id", workspaceId).eq("status", "active")
        .order("confidence", { ascending: false }).limit(5),
    ]);

    const oil = {
      insights_visibility: oilSettingsRow?.insights_visibility || "minimal",
      guidance_style: oilSettingsRow?.guidance_style || "advisory",
      leadership_guidance_enabled: oilSettingsRow?.leadership_guidance_enabled ?? true,
      show_best_practice_comparisons: oilSettingsRow?.show_best_practice_comparisons ?? true,
      always_explain_why: oilSettingsRow?.always_explain_why ?? true,
      auto_surface_blind_spots: oilSettingsRow?.auto_surface_blind_spots ?? true,
      external_knowledge: oilSettingsRow?.external_knowledge || "conditional",
      exclude_market_news: oilSettingsRow?.exclude_market_news ?? true,
    };

    const coreKeys = ["ExecutionHealth", "DeliveryRisk", "GoalProgress"];
    const coreIndicators = (indicators || []).filter((i: any) => coreKeys.includes(i.indicator_key));
    const secondaryIndicators = (indicators || []).filter((i: any) => !coreKeys.includes(i.indicator_key));
    const hasThresholdCrossed = coreIndicators.some((i: any) => i.score < 40 || i.score > 85 || i.trend === "down");
    const hasHighConfidenceMemory = (memory || []).some((m: any) => m.confidence >= 0.7);

    let shouldInject = false;
    if (oil.insights_visibility === "proactive") {
      shouldInject = coreIndicators.length > 0;
    } else if (oil.insights_visibility === "balanced") {
      shouldInject = hasThresholdCrossed || hasHighConfidenceMemory || coreIndicators.length > 0;
    } else {
      shouldInject = hasThresholdCrossed || hasHighConfidenceMemory;
    }

    if (!shouldInject) return "";

    let section = `\n\n═══ OIL (consumed, not computed) ═══`;

    const hasDeteriorating = coreIndicators.some((i: any) => i.trend === "down" || i.score < 40);
    const hasImproving = coreIndicators.some((i: any) => i.trend === "up" && i.score > 60);
    const tone = hasDeteriorating ? "cautious" : hasImproving ? "encouraging" : "neutral";
    section += `\nTone: ${tone} | Style: ${oil.guidance_style}`;

    const rules: string[] = [];
    if (oil.always_explain_why) rules.push("explain-why");
    if (oil.leadership_guidance_enabled) rules.push("leadership-support");
    if (oil.show_best_practice_comparisons) rules.push("best-practices");
    if (oil.auto_surface_blind_spots) rules.push("blind-spots");
    if (oil.external_knowledge === "off") rules.push("no-external");
    if (oil.exclude_market_news) rules.push("no-market-news");
    if (rules.length > 0) section += `\nRules: ${rules.join(", ")}`;

    if (coreIndicators.length > 0) {
      section += `\nCore: ${JSON.stringify(coreIndicators.map((i: any) => ({ k: i.indicator_key, s: i.score, tr: i.trend, dr: i.drivers })))}`;
    }

    if (secondaryIndicators.length > 0) {
      section += `\nSecondary: ${JSON.stringify(secondaryIndicators.map((i: any) => ({ k: i.indicator_key, s: i.score, tr: i.trend })))}`;
    }

    if (memory && memory.length > 0) {
      const minConfidence = oil.guidance_style === "conservative" ? 0.7 : 0.5;
      const filteredMemory = memory.filter((m: any) => m.confidence >= minConfidence);
      if (filteredMemory.length > 0) {
        section += `\nMemory: ${JSON.stringify(filteredMemory.map((m: any) => ({ type: m.memory_type, stmt: m.statement, conf: m.confidence })))}`;
      }
    }

    return section;
  } catch (oilErr) {
    console.warn("OIL context fetch failed:", oilErr);
    return "";
  }
}

// ─── Get User Workspace Role ───
async function getUserWorkspaceRole(sb: any, userId: string, workspaceId: string): Promise<string> {
  try {
    const { data: ws } = await sb.from("workspaces").select("company_id").eq("id", workspaceId).maybeSingle();
    if (!ws?.company_id) return "member";
    const { data: membership } = await sb.from("company_members")
      .select("role").eq("company_id", ws.company_id).eq("user_id", userId).eq("status", "accepted").maybeSingle();
    return membership?.role || "member";
  } catch {
    return "member";
  }
}

// ═══════════════════════════════════════════════════════════
// ═══ MAIN HANDLER ═══
// ═══════════════════════════════════════════════════════════

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
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as ChatRequest;
    const { messages, businessContext, systemContext, workContext, action, intentOverride, userLang, workspaceId } = body;

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

    // ─── Service Client (for server-side fetches) ───
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ─── Fix A: Server-side installed apps (ignore client-sent installedApps) ───
    const installedAppIds = workspaceId
      ? await fetchInstalledApps(sb, workspaceId)
      : ["brain"];

    // ─── Action Validation (dynamic + legacy) ───
    const actionRegistry = buildActionRegistry(installedAppIds);

    if (action && !isValidAction(action, actionRegistry)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ─── Language Label ───
    const langMap: Record<string, string> = {
      ar: "Arabic (العربية)", fr: "French (Français)", es: "Spanish (Español)",
      de: "German (Deutsch)", hi: "Hindi (हिन्दी)", ur: "Urdu (اردو)",
      zh: "Chinese (中文)", pt: "Portuguese (Português)", ru: "Russian (Русский)",
      ja: "Japanese (日本語)", ko: "Korean (한국어)", tr: "Turkish (Türkçe)",
      it: "Italian (Italiano)", nl: "Dutch (Nederlands)", sw: "Swahili (Kiswahili)",
      th: "Thai (ไทย)", vi: "Vietnamese (Tiếng Việt)", fa: "Persian (فارسی)",
      bn: "Bengali (বাংলা)", he: "Hebrew (עברית)",
    };
    const langLabel = langMap[userLang || ""] || (userLang ? `Language: ${userLang}` : "English");

    // ─── Fix B: Resolve intent (override OR classifier) ───
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";

    // Parallel fetches: intent (only if no override), OIL, signals, role
    const overrideResult = resolveIntentOverride(intentOverride);
    const [classifiedIntent, oilSection, decisionSignals, userRole] = await Promise.all([
      overrideResult ? Promise.resolve(overrideResult) : classifyIntent(lastUserMsg, messages, LOVABLE_API_KEY),
      workspaceId ? buildOILSection(sb, workspaceId) : Promise.resolve(""),
      workspaceId ? fetchDecisionSignals(sb, workspaceId) : Promise.resolve([]),
      workspaceId ? getUserWorkspaceRole(sb, user.id, workspaceId) : Promise.resolve(systemContext?.user_role || "member"),
    ]);

    const intentResult = overrideResult || classifiedIntent;

    // ─── Build System Prompt ───
    const systemPrompt = buildSystemPrompt({
      langLabel,
      businessContext,
      installedAppIds,
      workContext,
      intent: intentResult,
      action,
      actionRegistry,
      decisionSignals,
      oilPromptSection: oilSection,
      userRole,
    });

    // ─── Stream Response ───
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("brain-chat error:", error);
    return new Response(JSON.stringify({
      error: "An error occurred processing your request",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
