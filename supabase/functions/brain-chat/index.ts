import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
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
  action?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, businessContext, installedApps, action } = await req.json() as ChatRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with business context
    let systemPrompt = `You are the AI Business Brain for AiBizos - a unified AI Business Operating System.
Your role is to help businesses plan, think strategically, and coordinate their operations.

CORE PRINCIPLES:
1. You are the ONLY AI assistant in the entire system
2. You think and plan - execution happens through specialized apps
3. Always reference the business context in your responses
4. Keep responses concise, actionable, and business-focused
5. When suggesting actions that require apps, check if they're installed first

LANGUAGE: Always respond in English. You can understand Arabic but respond in English unless the user explicitly requests Arabic.

YOUR CAPABILITIES:
- Strategic planning and goal setting
- Breaking down goals into actionable plans
- Task management and prioritization  
- Weekly check-ins and progress reviews
- Business coaching and recommendations
- Recommending which apps to activate for specific tasks

EXECUTION GATE:
You can plan anything, but can only execute through installed apps.
If an action requires an app that isn't installed, recommend activating it.`;

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

    // Handle specific actions
    if (action) {
      switch (action) {
        case 'weekly_checkin':
          systemPrompt += `\n\nCURRENT TASK: Guide the user through a Weekly Check-in (15 minutes max).
Steps:
1. Ask what was completed this week
2. Identify any blockers and their reasons
3. Define top 3 priorities for next week
4. Note any risks or decisions needed
End with a summary and actionable next steps.`;
          break;
        case 'create_plan':
          systemPrompt += `\n\nCURRENT TASK: Help create a business plan.
Ask maximum 1-2 clarifying questions, then structure the response as:
1. Plan title and type (Sales/Marketing/Operations/Finance/Team/Custom)
2. Clear objectives
3. Weekly breakdown (4 weeks)
4. Key tasks and milestones`;
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
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
