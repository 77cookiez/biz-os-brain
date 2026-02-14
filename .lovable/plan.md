You are a senior staff full-stack engineer. Implement Phase 2 “Brain Liberation” exactly as specified below. NO UI changes. Backend/logic only. Keep investor-grade minimalism. Maintain Ask→Draft→Preview→Confirm→Execute (NO auto execution). Backwards compatible with current hardcoded action strings.

SCOPE

- Major rewrite: supabase/functions/brain-chat/index.ts

- Enhance: src/hooks/useBrainChat.ts

- Expand: src/hooks/useSmartCapabilities.ts

No new DB tables. No new edge functions. Everything integrated inside brain-chat.

GOALS

1) Add Intent Classification layer that runs BEFORE the main brain response.

2) Expand systemContext payload: installed modules + capabilities, user role, available actions, merged decision signals, recent thread summaries.

3) Replace hardcoded actions validation with dynamic action registry built from installed apps capabilities (but keep legacy 13 actions supported).

4) Add Simulation protocol when intent=simulate.

5) Integrate Passive Insight Engine (decision signals merged into brain-chat context).

6) Cross-module awareness: prompt sections injected only for installed apps.

7) Add internal metadata block BRAIN_META appended to assistant responses (not UI-visible). Frontend extracts it and logs to org_events.

HARD CONSTRAINTS

- No auto-execution. Brain must only propose or draft. Any “execute” must require explicit confirmation workflow (existing).

- No UI changes.

- Graceful fallback: if intent classifier fails, continue old behavior.

- Security: server-side classification only, role checked, meta not exposed to unauthorized.

IMPLEMENTATION DETAILS

A) brain-chat/index.ts (Major rewrite)

A1) Add Intent Classifier (fast)

- Implement classifyIntent({message, conversationContext, systemContext}) -> IntentResult.

- Use a fast model (gemini-2.5-flash-lite) for classification.

- Output MUST be strict JSON:

  {

    "intent": "guide|suggest|architect|design|simulate|diagnose|detect_risk|strategic_think|delegate|clarify|casual",

    "confidence": number (0..1),

    "risk_level": "low|medium|high",

    "modules_relevant": string[],

    "requires_simulation": boolean

  }

- Add robust parsing:

  - Strip code fences

  - JSON.parse with try/catch

  - Validate keys & enums; if invalid, throw to fallback

- Latency target: minimal; no streaming required here.

A2) Build Rich System Context (replace installedApps: string[])

- Create buildSystemContext(workspaceId, userId) that returns:

  {

    user_role: "owner|admin|member",

    installed_modules: [

      { id, name, version?, actions: [{key, title, description, risk?}] }

    ],

    available_actions: [{key, title, description, source_module}],

    recent_activity: {

      tasks_created_7d, tasks_completed_7d, blocked_tasks_count, overdue_count

    },

    decision_signals: { ...merged recent signals... },

    chat_summaries: [{thread_id, summary, last_activity_at}]  // if feasible; else empty

  }

- Use existing patterns for workspace role (getUserWorkspaceRole).

- For installed modules actions:

  - If there is an app manifest/capabilities map already in code, use it.

  - If not, implement a local registry mapping module id -> actions list (Workboard/OIL/Booking/Chat/Brain core).

  - MUST be dynamic: only include actions for installed modules.

- Ensure RLS-safe: only fetch workspace-scoped data.

A3) Action Mapping Engine (dynamic)

- Replace hardcoded action validation with:

  - dynamicRegistry = actions derived from systemContext.installed_modules

  - plus legacyActions (existing 13 strings) for backwards compatibility

- When model returns an action:

  - If in dynamicRegistry OR legacyActions -> accept

  - Else -> coerce to “none” or “draft_only” (do not error hard)

A4) Prompt Builder (composable sections)

- Refactor monolithic system prompt to:

  buildPrompt({

    core_identity,

    non_negotiable_principles,

    system_context_summary,

    intent_section,

    module_sections,

    action_registry_section,

    passive_insights_section,

    simulation_protocol_section (only when intent=simulate)

  })

- Core identity remains unchanged.

- Include only relevant sections:

  - module_sections only for installed modules

  - simulation_protocol only when intent=simulate OR requires_simulation=true

  - passive_insights always present but instructions say “surface only if contextually relevant”

- Action registry section MUST list only available_actions (plus mention legacy supported actions internally but don’t encourage usage).

A5) Decision Signals Integration (Passive Insight Engine)

- Inline fetch decision signals inside brain-chat (reuse logic from decision-signals).

- Add to systemContext and inject prompt section:

  PASSIVE_INSIGHTS:

  - Provide 3–7 top signals with short explanation, confidence, recommended questions to ask user.

  - Instruct Brain: only mention insights if directly helpful to user’s current intent; keep it calm; no spam.

A6) Simulation Protocol

- If intent=simulate:

  - Instruct Brain to produce a “Simulation Report”:

    - Assumptions

    - Inputs used (tasks/goals/OIL/decision signals)

    - Impact summary (deadlines, delivery risk, OIL indicators)

    - Risks + confidence

    - “Not a commitment” disclaimer

  - DO NOT propose execution; only show what-if results.

- If user wants changes applied, Brain must output a Draft (not execute).

A7) BRAIN_META output (internal metadata)

- Append at end of assistant content (always) a fenced block:

  ```BRAIN_META

  {"intent":"...","confidence":0.85,"risk_level":"medium","modules_consulted":["workboard","oil"],"simulation_used":false}

Keep it machine-readable JSON (single object).

Ensure it is ALWAYS appended, even in fallback mode (use best available values).

Ensure frontend can strip it from UI display if currently rendered.

A8) Graceful fallback

If classifier fails: set intent="suggest" confidence=0.4 risk_level="low" modules_relevant=[]

Continue with old prompt path, but still include systemContext + BRAIN_META.

B) src/hooks/useBrainChat.ts (Enhancement)

B1) Build/Send systemContext

Add a builder that fetches:

user role in workspace

installed apps list

map installed apps to actions/capabilities (same registry used server-side if possible; else client sends installed app ids + server builds actions)

recent activity summary (counts only)

Send this as part of brain-chat request payload.

B2) Extract BRAIN_META

Parse assistant response for BRAIN_META ...

Remove it from display text (do not show in UI).

Store meta internally (react-query cache or local state).

Log meta to org_events (OIL ingestion):

event_name: "brain_meta"

payload: meta + workspace_id + message_id

C) src/hooks/useSmartCapabilities.ts (New capability cards)

Add new capabilities with intent mapping and scoring:

Simulate (intent: simulate)

Diagnose (intent: diagnose)

Detect Risks (intent: detect_risk)

Architecture (intent: architect)

Strategic Think (intent: strategic_think)

Score based on workspace state:

if blocked_tasks_count>0 -> boost Diagnose

if overdue_count>0 -> boost Detect Risks

if OIL delivery risk high -> boost Simulate/Detect Risks

Keep UI unchanged (just capability data).

TESTS / VERIFICATION

Ensure brain-chat returns valid response + BRAIN_META always.

Ensure classifier failures do not break chat.

Ensure actions returned are filtered by registry.

Ensure simulate intent uses simulation report format.

Ensure passive insights are not spammy; only show if relevant.

DELIVERABLE

Provide final code changes in the three files.

Provide a short checklist of how to verify locally (manual steps).

Do not change any UI components beyond stripping BRAIN_META from visible text in hook parsing.

Proceed to implement now.