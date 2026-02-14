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

// ─── Intent Classifier ───
async function classifyIntent(
  message: string,
  conversationContext: Message[],
  apiKey: string,
): Promise<IntentResult> {
  const VALID_INTENTS = ["guide", "suggest", "architect", "design", "simulate", "diagnose", "detect_risk", "strategic_think", "delegate", "clarify", "casual"];
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
    const staleThreshold = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

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

// ─── Prompt Builder ───
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

  // ═══ CORE IDENTITY (unchanged) ═══
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

═══ DAILY BRIEF (OIL-Driven, Non-Intrusive) ═══
Daily Brief is optional, short, and once per day max.
Only provide when: OIL Visibility ≠ Minimal, or user explicitly asks.

DAILY BRIEF STRUCTURE (STRICT — max 5 lines total):
1. Title: "Today's Snapshot"
2. Overall State (1 line from OIL indicators)
3. One Key Signal (optional, only if meaningful)
4. Why It Matters (1 line)
5. Optional Draft Suggestion (ONE only)
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
YOU MUST NEVER EXECUTE ANY DATABASE ACTION. YOU ARE THINK-ONLY.
ALL changes follow: Ask → Draft → Preview → Confirm → Execute (via separate secure endpoint)
ALL suggestions are labeled as DRAFTS.
The user reviews and approves before anything reaches Workboard.
Even in voice or casual commands — NEVER skip confirmation.
You CANNOT create tasks, goals, plans, or ideas directly. You can ONLY propose them.

LANGUAGE: Always respond in ${langLabel}. Match the user's tone naturally.

═══ PROPOSAL OUTPUT CONTRACT ═══
When you propose actionable items (tasks, goals, plans, ideas, updates), you MUST include a structured proposals block at the end of your response in this EXACT format:

\`\`\`BRAIN_PROPOSALS
[
  {
    "id": "<generate a unique UUID>",
    "type": "task",
    "title": "Clear title in English",
    "payload": {
      "description": "Optional description",
      "status": "backlog",
      "due_date": null,
      "is_priority": false
    },
    "required_role": "member"
  }
]
\`\`\`

PROPOSAL RULES:
- id: generate a UUID v4 for each proposal
- type: "task" | "goal" | "plan" | "idea" | "update"
- title: English, concise, actionable
- payload: type-specific fields
- required_role: "member" for personal items, "admin" for team-wide, "owner" for structural changes
- Valid JSON only, English for structured fields
- Natural language response stays in user's language
- You MUST NOT execute proposals yourself.

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

  // ═══ SYSTEM CONTEXT ═══
  prompt += `\n\n═══ SYSTEM CONTEXT ═══`;
  prompt += `\nUser Role: ${userRole}`;
  prompt += `\nInstalled Modules: ${installedAppIds.join(", ") || "brain (core only)"}`;

  // ═══ INTENT AWARENESS ═══
  prompt += `\n\n═══ CURRENT INTENT (classified) ═══`;
  prompt += `\nDetected intent: ${intent.intent} (confidence: ${intent.confidence.toFixed(2)})`;
  prompt += `\nRisk level: ${intent.risk_level}`;
  if (intent.modules_relevant.length > 0) {
    prompt += `\nRelevant modules: ${intent.modules_relevant.join(", ")}`;
  }

  // ═══ BUSINESS CONTEXT ═══
  if (businessContext) {
    prompt += `\n\n═══ BUSINESS CONTEXT ═══
- Business Type: ${businessContext.businessType || "Not specified"}
- Description: ${businessContext.businessDescription || "Not specified"}
- Primary Pain Point: ${businessContext.primaryPain || "Not specified"}
- 90-Day Focus: ${businessContext.ninetyDayFocus?.join(", ") || "Not specified"}
- Team Size: ${businessContext.teamSize || "Solo"}
- Has Team: ${businessContext.hasTeam ? "Yes" : "No"}`;
  }

  // ═══ AVAILABLE ACTIONS (dynamic) ═══
  if (actionRegistry.length > 0) {
    prompt += `\n\n═══ AVAILABLE ACTIONS ═══`;
    prompt += `\nYou may propose actions from this registry. All follow Ask→Draft→Confirm→Execute flow.`;
    for (const a of actionRegistry) {
      prompt += `\n- ${a.key}: ${a.title} — ${a.description} [${a.source_module}]`;
    }
  }

  // ═══ WORKBOARD SNAPSHOT ═══
  if (workContext) {
    const today = new Date().toISOString().split("T")[0];
    const overdue = workContext.tasks.filter(t => t.isOverdue);
    const blocked = workContext.tasks.filter(t => t.status === "blocked");
    const priority = workContext.tasks.filter(t => t.isPriority);
    const inProgress = workContext.tasks.filter(t => t.status === "in_progress");

    prompt += `\n\n═══ CURRENT WORKBOARD SNAPSHOT (${today}) ═══`;
    prompt += `\nTotal open tasks: ${workContext.tasks.length}`;
    prompt += `\nOverdue: ${overdue.length} | Blocked: ${blocked.length} | Priority: ${priority.length} | In Progress: ${inProgress.length}`;

    if (workContext.tasks.length > 0) {
      prompt += `\n\nTASKS:`;
      for (const t of workContext.tasks) {
        let line = `- [${t.status.toUpperCase()}] ${t.title}`;
        if (t.isPriority) line += " ⭐";
        if (t.dueDate) line += ` (due: ${t.dueDate})`;
        if (t.isOverdue) line += " ⚠️ OVERDUE";
        if (t.blockedReason) line += ` [blocked: ${t.blockedReason}]`;
        prompt += `\n${line}`;
      }
    }

    if (workContext.goals.length > 0) {
      prompt += `\n\nACTIVE GOALS:`;
      for (const g of workContext.goals) {
        let line = `- ${g.title}`;
        if (g.dueDate) line += ` (due: ${g.dueDate})`;
        if (g.kpi) line += ` [KPI: ${g.kpi.name} ${g.kpi.current ?? 0}/${g.kpi.target ?? "?"}]`;
        prompt += `\n${line}`;
      }
    }
  }

  // ═══ OIL CONTEXT (injected if available) ═══
  if (oilPromptSection) {
    prompt += oilPromptSection;
  }

  // ═══ PASSIVE INSIGHTS (decision signals) ═══
  if (decisionSignals.length > 0) {
    prompt += `\n\n═══ PASSIVE INSIGHTS (Decision Signals) ═══`;
    prompt += `\nThese are organizational observations. Only mention if directly relevant to the user's current question. Do not spam.`;
    for (const s of decisionSignals) {
      prompt += `\n- [${s.signal_type}] ${s.title}: ${s.explanation} (confidence: ${s.confidence_level})`;
    }
  }

  // ═══ SIMULATION PROTOCOL ═══
  if (intent.intent === "simulate" || intent.requires_simulation) {
    prompt += `\n\n═══ SIMULATION PROTOCOL (Active) ═══
The user wants a "what-if" analysis. Produce a Simulation Report:

STRUCTURE:
1. **Assumptions** — State what you're assuming based on available data
2. **Inputs Used** — List which tasks/goals/OIL indicators/signals you're referencing
3. **Impact Summary** — Model the impact on deadlines, delivery risk, and OIL indicators
4. **Risks & Confidence** — Rate your confidence in this simulation
5. **Disclaimer** — "This is a simulation, not a commitment. No changes have been made."

RULES:
- Do NOT propose execution. Only show what-if results.
- If the user wants to apply changes after seeing the simulation, output a DRAFT proposal.
- Be transparent about data gaps: "I don't have enough data to model X accurately."`;
  }

  // ═══ DIAGNOSE PROTOCOL ═══
  if (intent.intent === "diagnose") {
    prompt += `\n\n═══ DIAGNOSE PROTOCOL (Active) ═══
The user wants root-cause analysis. Structure your response:
1. **Symptoms** — What patterns are observable in the data
2. **Possible Causes** — Ranked by likelihood based on available signals
3. **Recommended Investigation** — What questions to ask or data to check
4. **Draft Action** — One concrete suggestion to address the most likely cause
Keep it calm and evidence-based. Avoid speculation without data.`;
  }

  // ═══ DETECT RISK PROTOCOL ═══
  if (intent.intent === "detect_risk") {
    prompt += `\n\n═══ RISK DETECTION PROTOCOL (Active) ═══
The user wants proactive risk identification. Structure your response:
1. **Current Risk Landscape** — What risks are visible from tasks, goals, OIL indicators
2. **Emerging Risks** — What could develop if current trends continue
3. **Blind Spots** — Areas where you lack data to assess risk
4. **Mitigation Drafts** — 1-2 concrete actions per identified risk
Frame as "areas worth attention" not "problems."`;
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
At the VERY END of every response, you MUST append this block:

\`\`\`BRAIN_META
{"intent":"${intent.intent}","confidence":${intent.confidence.toFixed(2)},"risk_level":"${intent.risk_level}","modules_consulted":${JSON.stringify(intent.modules_relevant)},"simulation_used":${intent.intent === "simulate" || intent.requires_simulation}}
\`\`\`

This is for internal tracking only. Do not reference it in your response text.`;

  return prompt;
}

// ─── Legacy Action Instructions ───
function getActionInstructions(action: string): string | null {
  const map: Record<string, string> = {
    create_plan: `\n\nCURRENT TASK: Help draft a business plan.
Ask maximum 1-2 clarifying questions, then structure the response as a DRAFT:
1. Plan title and type (Sales/Marketing/Operations/Finance/Team/Custom)
2. Clear objectives
3. Weekly breakdown (4 weeks)
4. Key tasks and milestones
Remind the user this is a draft that will be sent to Workboard for review.`,
    setup_business: `\n\nCURRENT TASK: Initial business setup conversation.
Ask about:
1. Business type (trade, services, factory, online, retail, consulting, other)
2. Primary pain point to address first
3. Team size (solo or number of team members)
4. Top 1-3 goals for the next 90 days
Keep it conversational and friendly.`,
    strategic_analysis: `\n\nCURRENT TASK: Strategic Analysis.
Analyze the current state of the business using available OIL indicators, workboard data, and business context.
Provide:
1. A concise assessment of the current situation (2-3 lines)
2. Key risks or gaps detected (if any)
3. 2-3 strategic recommendations as actionable drafts
Focus on what matters most RIGHT NOW. Be specific, not generic.`,
    business_planning: `\n\nCURRENT TASK: Business Planning.
Evaluate the current goals and tasks landscape.
If goals exist: assess progress and suggest a draft action plan to accelerate them.
If no goals exist: ask ONE question about the user's top priority for the next 90 days, then draft a plan.
Structure any plan as:
1. Clear objective
2. 3-5 actionable steps
3. Suggested timeline
All suggestions are DRAFTS for user review.`,
    business_coaching: `\n\nCURRENT TASK: Business Coaching.
Based on the current workboard data and any OIL indicators:
1. Identify ONE specific pattern in the user's work habits
2. Provide ONE actionable tip based on best practices
3. Keep it encouraging and practical — never judgmental
Maximum 5-6 lines total. Be concise and specific.`,
    risk_analysis: `\n\nCURRENT TASK: Risk Analysis.
Focus specifically on delivery risks and potential issues:
1. Analyze overdue tasks, blocked items, and declining indicators
2. Identify the TOP 2-3 risks to the business right now
3. For each risk, suggest one concrete mitigation action
Be direct but not alarming. All suggestions are DRAFTS.`,
    reprioritize: `\n\nCURRENT TASK: Task Reprioritization.
Review the current task list, especially overdue and in-progress items.
Suggest a reprioritized order:
1. What should be done TODAY (max 3 tasks)
2. What can be moved to this week
3. What can be deferred or delegated
Present as a DRAFT plan.`,
    unblock_tasks: `\n\nCURRENT TASK: Resolve Blocked Tasks.
Review any blocked tasks and their blocked reasons.
For each blocked task:
1. Acknowledge the blocker
2. Suggest a practical resolution or workaround
3. If the blocker requires a decision, frame it clearly
Keep suggestions actionable and concise.`,
    set_goals: `\n\nCURRENT TASK: Goal Setting.
Help the user define clear, measurable 90-day goals.
Start by asking about their top business priority right now.
Then help structure 1-3 goals with:
1. Clear title
2. Measurable KPI (if applicable)
3. Target date
Present as DRAFTS.`,
    weekly_checkin: `\n\nCURRENT TASK: Weekly Check-in Summary.
Generate a concise weekly check-in summary (3-4 lines MAXIMUM).
Focus on:
1. Key accomplishments and their impact
2. Most important decisions made
3. One forward-looking recommendation
Do NOT list raw data. Synthesize and provide insight. Be brief.
IMPORTANT: No code blocks, no ULL_MEANING_V1 blocks. Plain text only.`,
    weekly_checkin_ids: `\n\nCURRENT TASK: Problem Solving (IDS — Identify, Discuss, Solve).
Suggest ONE practical, actionable solution in 2-3 lines maximum.
Be specific and concrete — not generic advice.
IMPORTANT: No code blocks. Plain text only.`,
    weekly_checkin_priorities: `\n\nCURRENT TASK: Suggest Next Week Priorities.
Return ONLY 3 numbered lines (1. 2. 3.).
Each line is a specific, actionable task title — no explanations.
Respond in the user's language.
IMPORTANT: No code blocks. Plain text only.`,
    suggest_assignee: `\n\nCURRENT TASK: Suggest the best team member to assign a task to.
Return ONLY a valid JSON object with no markdown or code fences:
{"user_id": "the_user_id", "reason": "One sentence reason in the user's language"}`,
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

    let section = `\n\n═══ ORGANIZATIONAL INTELLIGENCE (OIL — consumed, not computed) ═══`;
    section += `\nYou are receiving this data from OIL. You did NOT compute it. Treat it as advisory context.`;

    const hasDeteriorating = coreIndicators.some((i: any) => i.trend === "down" || i.score < 40);
    const hasImproving = coreIndicators.some((i: any) => i.trend === "up" && i.score > 60);
    const toneDirective = hasDeteriorating
      ? "TONE: Cautious — things need attention. Be supportive, not alarming."
      : hasImproving
        ? "TONE: Encouraging — things are moving well. Acknowledge progress."
        : "TONE: Neutral — stable situation. Be clear and professional.";
    section += `\n${toneDirective}`;

    const styleMap: Record<string, string> = {
      conservative: "Only surface HIGH-confidence insights. Be cautious and understated.",
      advisory: "Provide clear, professional suggestions as DRAFTS. Balanced tone.",
      challenging: "Surface risks earlier. Ask direct probing questions. Be forthright.",
    };
    section += `\nGUIDANCE STYLE: ${styleMap[oil.guidance_style] || styleMap.advisory}`;

    section += `\nDISPLAY RULES:`;
    section += `\n- ONLY mention insights when relevant to the user's question or during daily briefs`;
    section += `\n- Do NOT present raw scores — weave insights naturally into your response`;
    section += `\n- Every insight is a DRAFT suggestion, not a command`;
    section += `\n- NEVER reference any individual person — all insights are team/org level only`;

    if (oil.always_explain_why) section += `\n- ALWAYS explain "why this matters" for every insight`;
    if (oil.leadership_guidance_enabled) {
      section += `\n- Support leadership subtly — shorten learning curves, surface blind spots gently`;
      section += `\n- NEVER imply incompetence or judgment`;
    }
    if (oil.show_best_practice_comparisons) section += `\n- When relevant, say "In similar situations, teams often…"`;
    if (oil.auto_surface_blind_spots) section += `\n- Proactively surface organizational blind spots when detected`;
    if (oil.external_knowledge === "off") section += `\n- Do NOT reference any external best practices or benchmarks`;
    if (oil.exclude_market_news) section += `\n- NEVER include market news — only principles and warnings`;

    if (coreIndicators.length > 0) {
      section += `\n\nCORE INDICATORS (contextual awareness — do not display as numbers):`;
      for (const ind of coreIndicators) {
        section += `\n- ${ind.indicator_key}: ${ind.score}/100 (${ind.trend}) — ${(ind.drivers as string[]).join(", ")}`;
      }
    }

    if (secondaryIndicators.length > 0) {
      section += `\n\nSECONDARY (reference only when user asks):`;
      for (const ind of secondaryIndicators) {
        section += `\n- ${ind.indicator_key}: ${ind.score}/100 (${ind.trend}) — ${(ind.drivers as string[]).join(", ")}`;
      }
    }

    if (memory && memory.length > 0) {
      const minConfidence = oil.guidance_style === "conservative" ? 0.7 : 0.5;
      const filteredMemory = memory.filter((m: any) => m.confidence >= minConfidence);
      if (filteredMemory.length > 0) {
        section += `\n\nORG MEMORY (organizational patterns — never attribute to individuals):`;
        for (const m of filteredMemory) {
          section += `\n- [${m.memory_type}] ${m.statement} (confidence: ${m.confidence})`;
        }
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
    const { messages, businessContext, installedApps, systemContext, workContext, action, userLang, workspaceId } = body;

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

    // ─── Action Validation (dynamic + legacy) ───
    const installedAppIds = installedApps || ["brain"];
    // Always include brain
    if (!installedAppIds.includes("brain")) installedAppIds.push("brain");
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

    // ─── Service Client (for server-side fetches) ───
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ─── Parallel: Intent Classification + OIL + Decision Signals + Role ───
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";

    const [intentResult, oilSection, decisionSignals, userRole] = await Promise.all([
      classifyIntent(lastUserMsg, messages, LOVABLE_API_KEY),
      workspaceId ? buildOILSection(sb, workspaceId) : Promise.resolve(""),
      workspaceId ? fetchDecisionSignals(sb, workspaceId) : Promise.resolve([]),
      workspaceId ? getUserWorkspaceRole(sb, user.id, workspaceId) : Promise.resolve(systemContext?.user_role || "member"),
    ]);

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
