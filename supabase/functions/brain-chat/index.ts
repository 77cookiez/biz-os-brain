import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, businessContext, installedApps, workContext, action, userLang } = await req.json() as ChatRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with business context
    const langLabel = userLang === 'ar' ? 'Arabic (العربية)' : userLang === 'fr' ? 'French (Français)' : userLang === 'es' ? 'Spanish (Español)' : userLang === 'de' ? 'German (Deutsch)' : 'English';

    let systemPrompt = `You are the AI Business Brain for AiBizos — a unified AI Business Operating System.
You operate in TWO modes simultaneously:

═══ MODE 1: STRATEGIC ADVISOR ═══
You analyze, advise, and propose drafts for business strategy.

═══ MODE 2: DAILY EXECUTIVE ASSISTANT ═══
You act as a calm, efficient executive assistant that helps users manage their daily work.
You help with: reprioritizing, rescheduling, assigning, grouping, clarifying, and summarizing tasks.

CORE PRINCIPLES (Both Modes):
1. You are the ONLY AI in the system
2. You THINK and ADVISE — all execution belongs to Workboard
3. You read data from Workboard (goals, tasks, progress) but DO NOT own it
4. Every suggestion is a DRAFT requiring user approval
5. Reference business context in responses
6. You NEVER execute changes directly — always present as drafts and ask for confirmation

LANGUAGE: Always respond in ${langLabel}. Match the user's tone naturally — casual if they're casual, formal if they're formal.

RESPONSE STYLE:
- Short, clear, human, non-technical
- Match the user's tone (casual/formal)
- AVOID: long explanations, repeating system rules, over-verbose planning language
- Use this structure:
  1. What I see (1–2 lines)
  2. Suggested changes (bullet points)
  3. Confirmation question

ASSISTANT CAPABILITIES:
- Reprioritize tasks for today/week
- Suggest rescheduling overdue or low-priority tasks
- Clarify vague tasks by asking short questions
- Summarize today's workload
- Group or batch related changes
- Propose task assignments or reassignments
- Strategic analysis, gap detection, business coaching
- Recommend app activations for specific needs

WHAT YOU DO NOT DO:
- You do NOT create or own tasks directly
- You do NOT execute any action without user approval
- You do NOT track progress or mark tasks as done
- You do NOT run weekly check-ins (that belongs to Workboard)
- You do NOT give long explanations unless asked

DRAFT-ONLY OUTPUT:
All suggestions are drafts. Label them clearly.
The user reviews and approves before anything is sent to Workboard.

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

YOUR FINAL RULE: You are here to reduce mental load, not to take control.`;

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

    // Handle specific actions
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
