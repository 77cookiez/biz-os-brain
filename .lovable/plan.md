
AI Business Brain – Dedicated Page (Final Spec – ULL Integrated)
Purpose

The AI Business Brain is a thinking and decision-support system, not an execution engine.

It exists to:

Understand business context across all installed apps

Reason, analyze, and advise

Produce draft decisions and plans

Never execute actions or mutate data directly

All execution happens only in downstream apps after explicit confirmation.

Route
/brain


Dedicated full-page Brain Console, separate from Today or dashboards.

Core Principles (Non-Negotiable)

Brain Thinks, It Does Not Execute

No direct creation, update, or deletion of records

No financial or operational execution

No irreversible actions

Draft-First Architecture

Every output is a draft

Drafts must be reviewed and explicitly promoted elsewhere

Decision Flow

Ask → Plan → Dry-Run → Confirm → Execute


The Brain covers Ask → Plan → Dry-Run only.

ULL Is the Source of Linguistic Truth

All language understanding, normalization, and intent extraction flows through ULL

UI language, voice input, and reasoning are decoupled

Page Layout
+------------------------------------------------------+
|  AI Business Brain                                   |
|  Context Awareness Strip                             |
+------------------------------------------------------+
|  Smart Contextual Quick Actions (2–3 max)            |
+------------------------------------------------------+
|                                                      |
|   Reasoning Stream (scrollable, markdown)            |
|                                                      |
+------------------------------------------------------+
|  Decision & Draft Panel (persistent)                 |
+------------------------------------------------------+
|  [Mic] [ Type your message… ] [Send]                 |
+------------------------------------------------------+

1. Context Awareness Strip (Always Visible)

A lightweight, non-numerical context indicator.

Displays:

Connected apps & readiness (icons only)

Data freshness indicator

Brain confidence level (High / Medium / Low)

Action:

Fix context

❌ No metrics, charts, or KPIs.

2. Smart Contextual Quick Actions

Rules:

Max 2–3 items

Generated dynamically from workspace state

Never auto-execute

Behavior:

Clicking a card prefills the input

User must explicitly press Send

3. Reasoning Stream (Not a Chat)

This is not a conversational chat UI.

Response structure:

🧠 Brain Insight

What I understand

Why it matters

What it implies for the business

📌 Key Observations

3–5 concise points

⚠️ Risks Detected (conditional)

💡 Strategic Suggestions

Advisory only

No execution

4. Decision & Draft Panel (Mandatory)

Appears after every Brain response.

Contents:

Objective

Assumptions

Constraints

Options (A / B / C)

Trade-offs

Allowed Actions Only:

Save as Draft

Open Dry-Run Preview

Send Draft to Workboard

Dismiss

❌ No Execute / Apply / Create actions allowed.

5. Input Bar
Text Input

Placeholder:

Ask the Business Brain anything about your business…

6. Voice Input – ULL-Driven (Language-Agnostic)
Key Principle

Voice input language is not hard-coded.
Language handling is delegated to ULL, not the browser.

Voice Flow Architecture
User Speech
   ↓
Browser Speech Recognition (best available locale)
   ↓
Raw Transcript
   ↓
ULL (Universal Language Layer)
   - detect actual language
   - normalize wording
   - correct grammar
   - unify meaning
   - extract intent
   ↓
AI Business Brain reasoning

Voice Behavior Rules

The system attempts to use the closest browser-supported locale matching the current ULL language

If an exact match is unavailable:

A compatible fallback locale is used

The transcript is always processed by ULL for:

Language detection

Normalization

Semantic correction

Confidence Handling

Each transcript carries a confidence score:

high | medium | low

For low confidence:

Brain re-confirms understanding:

“I understood this as: … Is that correct?”

Result

Functional support for all human languages

Browser limitations are abstracted away

ULL remains the single linguistic authority

7. Empty State (First Use Only)

Shown when no messages exist.

Capability Cards:

Strategic Advisor

Business Planning

Business Coaching

Each card opens example prompts, not execution.

8. Memory & Sessions (Recommended)

Conversations stored as sessions

Rename / Pin / Archive

Brain may reference past decisions contextually

What Must NOT Exist on This Page

❌ Dashboards

❌ KPIs

❌ Charts

❌ Task lists

❌ Orders or inventory tables

❌ Financial execution

❌ Auto-creation of records

This page is thinking only.

Technical Notes
New Files

src/pages/brain/BrainPage.tsx

src/hooks/useVoiceInput.ts

Modified Files

Routing (/brain)

Sidebar navigation

i18n (UI text only; logic handled by ULL)

Final Design Truth

ULL understands language.
The Brain understands business.
Execution belongs elsewhere.

