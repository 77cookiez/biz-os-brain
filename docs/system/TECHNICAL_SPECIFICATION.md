# AiBizos — Complete Technical Specification

**Version:** 1.0.0  
**Date:** 2026-02-13  
**Status:** Canonical Reference  
**Purpose:** Full architectural specification for module compliance  

---

## Table of Contents

1. [Core Architecture Overview](#1-core-architecture-overview)
2. [Intelligence Layer](#2-intelligence-layer)
3. [Business Brain](#3-business-brain)
4. [Module System](#4-module-system)
5. [Database Structure](#5-database-structure)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Security Model](#7-security-model)
8. [System Constraints](#8-system-constraints)
9. [Current Limitations](#9-current-limitations)

---

## 1. Core Architecture Overview

### 1.1 System Philosophy

AiBizos is a three-layer AI Business Operating System:

- **Brain Layer** — Thinks (AI strategic advisor, never executes directly)
- **OS Layer** — Orchestrates (routing, contexts, workspace isolation, ULL)
- **App Layer** — Executes (Workboard, Chat, Leadership, future modules)

**Guiding mantra:** "One Brain, One Input, One Dashboard"

The Brain is the primary user entry point. It receives natural language input, reasons about it using workspace context and OIL indicators, and produces structured proposals that the OS routes to the appropriate app for execution — only after explicit user confirmation.

### 1.2 Hard Principles (Non-Negotiable)

| # | Principle | Enforcement |
|---|-----------|-------------|
| 1 | **No Meaning, No Content** | `meaning_object_id NOT NULL` on all content tables; `guardMeaningInsert({ block: true })` at runtime |
| 2 | **Language as Projection** | UI labels use static `i18n` (react-i18next); user-generated content uses ULL meaning objects + `<ULLText>` rendering |
| 3 | **ULL is Always On** | Core system app, non-removable, hidden from marketplace browse |
| 4 | **Assistive AI** | Brain never auto-executes; all mutations follow Ask → Draft → Preview → Confirm → Execute |
| 5 | **Security First** | RLS enforces workspace boundaries on every table; `is_workspace_member()` as the fundamental gate |

### 1.3 Multi-Tenant Model

```
User (auth.users)
 └── Company (companies)
      ├── user_roles (owner | admin | member)
      └── Workspace (workspaces)
           ├── workspace_members (team_role: owner | operations | sales | marketing | finance | custom)
           ├── workspace_apps (installed modules)
           └── All content tables (tasks, goals, plans, ideas, chat_messages, brain_messages, etc.)
```

**Key relationships:**
- A User can belong to multiple Companies
- A Company can have multiple Workspaces
- All content is scoped to `workspace_id`
- Cross-workspace data access is prevented at the database level via RLS

### 1.4 Workspace Structure

**Table: `workspaces`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Auto-generated |
| `company_id` | uuid (FK → companies) | Parent company |
| `name` | text | Workspace display name |
| `default_locale` | text | Default language for the workspace (default: 'en') |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated via trigger |

### 1.5 Membership Model

**Table: `workspace_members`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK) | |
| `user_id` | uuid | References auth.users (no FK to avoid auth schema issues) |
| `team_role` | enum | `owner`, `operations`, `sales`, `marketing`, `finance`, `custom` |
| `custom_role_name` | text | When team_role = 'custom' |
| `email` | text | Persisted for pre-registration identification |
| `invite_status` | text | `pending` or `accepted` |
| `invited_at` | timestamptz | |
| `joined_at` | timestamptz | |

**Invite flow:**
1. Owner/admin sends invite via `invite-member` edge function
2. Email sent via Resend (with manual fallback: copy link, WhatsApp share)
3. `invite_status = 'pending'` until user signs up and joins
4. Upon join: `invite_status = 'accepted'`, `joined_at` set

### 1.6 RBAC Design

**Two-level role system:**

1. **Company Level** (`user_roles` table):
   - `owner` — Full control, billing, company settings
   - `admin` — Manage workspaces, members, settings
   - `member` — Standard access

2. **Workspace Level** (`workspace_members.team_role`):
   - Functional roles: `owner`, `operations`, `sales`, `marketing`, `finance`, `custom`
   - Used for UI context (e.g., Brain AI assignee suggestions) and task assignment

**Permission check functions (SECURITY DEFINER, no RLS recursion):**

```sql
is_workspace_member(_user_id uuid, _workspace_id uuid) → boolean
is_company_member(_user_id uuid, _company_id uuid) → boolean
has_company_role(_user_id uuid, _company_id uuid, _role app_role) → boolean
is_chat_thread_member(_user_id uuid, _thread_id uuid) → boolean
get_workspace_company(_workspace_id uuid) → uuid
get_thread_workspace(_thread_id uuid) → uuid
```

### 1.7 Permission Enforcement Model

| Layer | Mechanism |
|-------|-----------|
| Database | RLS policies using `SECURITY DEFINER` functions |
| Edge Functions | `getUser(token)` validation + workspace membership check |
| Frontend | `ProtectedRoute` component, `AuthContext`, `WorkspaceContext` |
| Brain Execution | HMAC-SHA256 signed proposals with TTL + RBAC check |

### 1.8 Audit Logging Structure

**Table: `audit_logs`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK) | |
| `actor_user_id` | uuid | Who performed the action |
| `action` | text | e.g., `brain_execute_success`, `brain_execute_failure` |
| `entity_type` | text | e.g., `task`, `goal`, `plan` |
| `entity_id` | text | ID of the affected entity |
| `metadata` | jsonb | Additional context (proposal_id, title, error, etc.) |
| `ip_address` | text | Optional |
| `created_at` | timestamptz | |

**RLS:** Only `owner` and `admin` can SELECT. INSERT requires workspace membership.

**OIL-specific audit:** Separate audit via `org_events` with `event_type` prefixed `oil.` (e.g., `oil.compute_completed`, `oil.indicator_updated`, `oil.memory_created`).

---

## 2. Intelligence Layer

### 2.A Universal Language Layer (ULL)

#### 2.A.1 Meaning-First Principle

> "No Meaning, No Content."

All user-generated and AI-generated content is normalized into canonical `meaning_objects` before storage. Human language is treated as a projection layer — rendered on-demand in the user's preferred locale.

**Flow:**
```
User Input → meaning_objects (semantic truth) → ULL projection → User's language
```

#### 2.A.2 `meaning_objects` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK) | |
| `created_by` | uuid | |
| `type` | text | `task`, `goal`, `idea`, `brain_message`, `plan`, `message` (lowercase enforced) |
| `source_lang` | varchar | ISO language code (e.g., 'en', 'ar') |
| `meaning_json` | jsonb | Structured semantic payload (v1 or v2 schema) |
| `deleted_at` | timestamptz | Soft delete |
| `created_at` | timestamptz | |

**Meaning JSON v1 Schema:**
```typescript
{
  version: 'v1',
  type: 'TASK' | 'GOAL' | 'IDEA' | 'BRAIN_MESSAGE' | 'PLAN' | 'MESSAGE',
  intent: string,         // e.g., 'create', 'plan', 'discuss', 'communicate'
  subject: string,        // Primary content (used as translation source)
  description?: string,
  constraints?: Record<string, unknown>,
  metadata?: {
    created_from?: 'user' | 'brain',
    confidence?: number,   // 0.0–1.0
    source?: string,
    source_message_id?: string,
    source_thread_id?: string,
  }
}
```

**Meaning JSON v2 Schema (additive extension, backward compatible):**
```typescript
{
  version: 'v2',
  type: same as v1,
  intent: 'create' | 'complete' | 'discuss' | 'decide' | 'plan' | 'block' | 'communicate',
  subject: string,
  description?: string,
  actors?: string[],       // Involved user IDs
  time?: {
    created_at?: string,
    due_at?: string,
    completed_at?: string | null,
  },
  state?: 'open' | 'in_progress' | 'blocked' | 'done',
  links?: {
    from_message_id?: string,
    to_goal_id?: string,
    from_thread_id?: string,
  },
  signals?: {
    urgency?: number,      // 0.0–1.0
    confidence?: number,   // 0.0–1.0
  },
  metadata?: same as v1
}
```

v1 and v2 objects coexist within the same workspace. System logic is version-aware via `discriminatedUnion`.

#### 2.A.3 Enforcement Rules

| Layer | Mechanism | Status |
|-------|-----------|--------|
| **Database** | `meaning_object_id NOT NULL` + FK constraints on `tasks`, `goals`, `plans`, `ideas`, `brain_messages`, `chat_messages` | ✅ Enforced |
| **Runtime** | `guardMeaningInsert({ block: true })` called before every insert into protected tables | ✅ Enforced |
| **UI** | All content rendered via `<ULLText>` component | ✅ Enforced |
| **CI** | `scripts/ull-compliance-check.sh` regression prevention | ✅ Active |

**Protected tables:** `tasks`, `goals`, `ideas`, `brain_messages`, `plans`, `chat_messages`

**Exempt tables (with rationale):**
- `notifications` — Uses i18n templates, not user-generated content
- `org_events` — Telemetry/metadata only
- `audit_logs` — Internal system records
- `company_memory` — AI-internal statements (OIL generates English statements)

#### 2.A.4 `guardMeaningInsert()` Implementation

```typescript
function guardMeaningInsert(
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[],
  options: { block?: boolean } = { block: true }
): boolean
```

- Checks if `table` is in `MEANING_PROTECTED_TABLES`
- For each row: validates `meaning_object_id` is present
- If `block: true` and missing: **throws Error** (hard block)
- If `block: false` and missing: logs warning, returns `false`

#### 2.A.5 `createMeaningObject()` Implementation

```typescript
async function createMeaningObject(params: {
  workspaceId: string;
  createdBy: string;
  type: MeaningJsonV1['type'];
  sourceLang: string;
  meaningJson: MeaningJsonV1;
}): Promise<string | null>
```

- Validates meaning JSON against Zod schema
- Inserts into `meaning_objects` table with `type` lowercased
- Returns the meaning object ID or `null` on failure

#### 2.A.6 `<ULLText>` Rendering Rules

```tsx
<ULLText
  meaningId={string}        // Phase 1: meaning object ID (preferred)
  table={string}            // Phase 0: legacy table name
  id={string}               // Phase 0: row ID
  field={string}            // Phase 0: field name
  fallback={string}         // Always required: shown while loading
  sourceLang={string}       // Default: 'en'
  className={string}
  as={keyof JSX.IntrinsicElements}  // Default: 'span'
/>
```

**Priority:**
1. If `meaningId` provided → use `getTextByMeaning()` (Phase 1, preferred)
2. If `table/id/field` provided → use `getText()` (Phase 0, legacy)
3. No projection available → render `fallback` as-is

**Translation flow:**
1. Component renders with `fallback` immediately (no loading state)
2. `useULL` hook checks in-memory cache → IndexedDB cache → queues batch request
3. Batch request sent to `ull-translate` edge function (50ms debounce)
4. Response cached in memory + IndexedDB (7-day TTL, workspace-scoped)
5. Component re-renders with translated text

#### 2.A.7 `content_translations` Table (Projection Cache)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `meaning_object_id` | uuid (FK) | |
| `target_lang` | varchar | Target language code |
| `field` | text | Default: 'content' |
| `translated_text` | text | The projected text |
| `created_at` | timestamptz | TTL: 7 days |

#### 2.A.8 Translation Engine

- **Model:** Gemini 2.5 Flash via Lovable AI Gateway
- **Source:** English `subject` field from meaning objects (avoids mixed-language confusion)
- **Protocol:** Output ONLY the target language, concise business tone
- **Edge function:** `ull-translate`
- **Client cache:** IndexedDB with 7-day TTL, workspace-scoped
- **Language change:** Aggressive cache invalidation (clears all caches + pending requests)

#### 2.A.9 Prohibited Behaviors

- ❌ Inserting into protected tables without `meaning_object_id`
- ❌ Rendering user-generated content without `<ULLText>`
- ❌ Storing raw user text as the canonical source of truth
- ❌ Bypassing `guardMeaningInsert()` in any insert path
- ❌ Using direct string interpolation for content display

#### 2.A.10 ULL as Core System App

**Manifest:** `src/apps/ull/manifest.ts`

```typescript
{
  id: 'ull',
  type: 'system',
  required: true,
  removable: false,
  category: 'Core',
  capabilities: ['language:preferences', 'language:render', 'language:translate', 'meaning:contract'],
  settingsRoutes: [
    { path: '/settings/language', scope: 'user' },
    { path: '/settings/workspace/language', scope: 'admin' },
  ],
  docsRoutes: [{ path: '/docs/system/ull' }],
  tables: ['meaning_objects', 'content_translations'],
}
```

#### 2.A.11 Native Translation Exception

Ephemeral AI-generated insights (Decision Intelligence, Strategic Advisor suggestions, OIL guidance drafts) bypass the meaning-object pipeline. These are translated natively by the AI model during generation into the user's target language, reducing overhead for non-persistent content.

---

### 2.B Organizational Intelligence Layer (OIL)

#### 2.B.1 Architecture Overview

OIL is a background system service. It:
- **DOES:** Learn from organizational behavior, surface risk signals, provide contextual memory
- **DOES NOT:** Execute actions, command users, evaluate individuals, produce constant alerts
- **NEVER** talks to users directly — outputs are consumed only by Brain

**Data flow:** `All Apps → OIL Events → OIL Compute → Brain Context`

#### 2.B.2 `org_events` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK) | |
| `event_type` | text | e.g., `task.created`, `task.completed`, `task.blocked`, `task.deleted`, `oil.compute_completed` |
| `object_type` | text | e.g., `task`, `goal`, `oil_system` |
| `meaning_object_id` | uuid (FK, nullable) | Optional link to meaning object |
| `severity_hint` | text | `info` (default), `warning`, `critical` |
| `metadata` | jsonb | Additional context |
| `created_at` | timestamptz | |

**Retention:** 90-day auto-cleanup via `cleanup_old_org_events()` function.

**RLS:** Workspace members can INSERT and SELECT. No UPDATE or DELETE.

#### 2.B.3 `org_indicators` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK) | |
| `indicator_key` | text | One of: `ExecutionHealth`, `DeliveryRisk`, `GoalProgress`, `FinancialPressure`, `TeamAlignment` |
| `score` | integer | 0–100 |
| `trend` | text | `up`, `down`, `stable` |
| `drivers` | jsonb | Array of string explanations |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**2-Tier System:**
- **Core** (always surfaced in briefs): `ExecutionHealth`, `DeliveryRisk`, `GoalProgress`
- **Secondary** (detail views only): `FinancialPressure`, `TeamAlignment`

**Upsert constraint:** `workspace_id + indicator_key` (unique)

#### 2.B.4 `company_memory` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK) | |
| `memory_type` | text | `PROCESS`, `RISK`, `FINANCE`, `OPERATIONS`, `CULTURE` |
| `statement` | text | Organizational-level pattern (never references individuals) |
| `confidence` | numeric | 0.0–1.0 |
| `evidence_refs` | jsonb | Array of supporting evidence |
| `status` | text | `active` (default), `archived` |
| `last_seen_at` | timestamptz | Updated when pattern reinforced |
| `created_at` | timestamptz | |

**Stale memory cleanup:** `cleanup_stale_memory()` archives entries with `confidence < 0.3` and `last_seen_at > 30 days`.

#### 2.B.5 `oil-ingest` Edge Function

**Endpoint:** `POST /functions/v1/oil-ingest`

**Request body:**
```json
{
  "workspace_id": "uuid",
  "events": [
    {
      "event_type": "task.created",
      "object_type": "task",
      "meaning_object_id": "uuid (optional)",
      "severity_hint": "info | warning | critical",
      "metadata": {}
    }
  ]
}
```

**Behavior:**
1. Authenticates user via `getUser(token)`
2. Validates workspace exists
3. Batch inserts into `org_events` (max 100 per request)
4. Returns `{ ingested: N }`
5. Fire-and-forget from client (failures are silent and non-blocking)

#### 2.B.6 `oil-compute` Edge Function

**Endpoints:**
- `GET /functions/v1/oil-compute?workspace_id=xxx` — Returns current indicators + memory
- `POST /functions/v1/oil-compute` with `{ workspace_id, recompute: true }` — Triggers recomputation

**Recompute pipeline:**
1. **Cooldown check:** Minimum 6 hours between runs per workspace
2. **Data gathering:** Last 14 days of `org_events`, all `tasks`, all `goals`
3. **Privacy:** Intentionally excludes `assigned_to`, `created_by`, `actor` fields — org-level only
4. **Deterministic computation** for each indicator:

   **ExecutionHealth (Core):**
   - Base: completion rate = completed / (open + completed)
   - Penalties: -10 per blocked task, -5 per overdue task
   - Range: 0–100

   **DeliveryRisk (Core):**
   - Base: 20
   - +30 if overdue > 3
   - +25 if blocked > 2
   - +15 if rescheduled > 5
   - Range: 0–100

   **GoalProgress (Core):**
   - Average KPI progress across active goals with targets
   - Penalty: -15 per overdue goal
   - Range: 0–100

   **FinancialPressure (Secondary):** Placeholder score 30 — "Finance app not yet active"
   
   **TeamAlignment (Secondary):** Placeholder score 50 — "More data needed"

5. **Trend computation:** Compare new score to previous; `up` if +5, `down` if -5, else `stable`
6. **Upsert indicators** with audit logging for every change
7. **Pattern mining** (gated: min 5 events required):
   - AI prompt (Gemini 2.5 Flash Lite) with event counts and indicator summaries
   - Output: 1–3 organizational patterns with `memory_type` and `confidence`
   - **Sanitization:** Rejects any pattern referencing individuals (regex filter)
   - **Deduplication:** If similar memory exists → reinforce confidence (+0.1, max 1.0)
   - **New memory:** Insert with audit log

#### 2.B.7 `useOIL` Hook

```typescript
function useOIL(): {
  emitEvent: (event: OrgEvent) => void;
  emitEvents: (events: OrgEvent[]) => void;
}
```

- Fire-and-forget event emission
- Automatically includes workspace_id from context
- Authenticates via user session token
- Silent failure — OIL events are non-critical

**Currently emitting from:**
- `useWorkboardTasks`: `task.created`, `task.completed`, `task.blocked`, `task.deleted`
- Status changes emit corresponding events with metadata

#### 2.B.8 Brain Read-Only Contract

The Brain **consumes** OIL data but **never computes** it:

1. `brain-chat` edge function fetches OIL indicators + memory via service role key
2. Data is injected into system prompt as advisory context
3. **Visibility gating** based on `oil_settings`:
   - `minimal`: Only inject when thresholds crossed (score < 40, > 85, or trend = down) or high-confidence memory (≥ 0.7)
   - `balanced`: Inject when any core indicators exist + thresholds/memory
   - `proactive`: Inject whenever any core indicators exist
4. Brain response includes tone directives:
   - Deteriorating → cautious
   - Improving → encouraging
   - Stable → neutral

#### 2.B.9 Leadership Augmentation Rules (Aurelius)

- Purpose: Augment executive intelligence in environments where leaders lack formal training
- Does NOT replace leaders — amplifies judgment, shortens learning curves
- Guidance is always presented as drafts
- Never implies incompetence or compares the user to others
- Phrasing rule: "In similar situations, teams often…" (never "Best practice says…")

#### 2.B.10 `oil_settings` Table (Governance)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `insights_visibility` | text | `minimal` | `minimal`, `balanced`, `proactive` |
| `guidance_style` | text | `advisory` | `conservative`, `advisory`, `challenging` |
| `leadership_guidance_enabled` | boolean | `true` | |
| `show_best_practice_comparisons` | boolean | `true` | |
| `always_explain_why` | boolean | `true` | |
| `auto_surface_blind_spots` | boolean | `true` | |
| `external_knowledge` | text | `conditional` | `off`, `conditional`, `always` |
| `include_industry_benchmarks` | boolean | `false` | |
| `include_operational_best_practices` | boolean | `true` | |
| `exclude_market_news` | boolean | `true` | |
| `show_in_brain_only` | boolean | `true` | |
| `show_indicator_strip` | boolean | `false` | |

**RLS:** Admins/owners can manage (ALL). Workspace members can view (SELECT).

#### 2.B.11 Continuous Knowledge Update Logic

**Primary sources:**
1. Organizational behavior (primary)
2. Historical company memory
3. Conditional external research

**External research triggers:**
- Internal indicators degrade
- Repeated patterns persist
- Strategic gap detected
- User explicitly requests comparison

**AI research is gated** — not triggered proactively.

---

## 3. Business Brain

### 3.1 Brain System Prompt Philosophy

The Brain is an **Executive Assistant and thinking partner**:
- Helps users think clearly, reduce cognitive load
- Supports better decisions without replacing judgment
- Follows two interaction modes:
  - **Assistant Mode** (default for casual/voice): Short, human, calm, non-technical
  - **Strategic Mode** (for longer questions): Structured analysis with drafts

### 3.2 Ask → Plan → Preview → Confirm → Execute Flow

```
User Input (natural language, voice, any language)
     ↓
Brain Processing (brain-chat edge function)
     ↓
AI Response with BRAIN_PROPOSALS block (structured JSON)
     ↓
Frontend parses proposals → Renders ProposalCards
     ↓
User clicks "Confirm" on a proposal
     ↓
Client calls brain-execute-action with action: "sign"
     ↓
Server signs proposals with HMAC-SHA256 (10-min TTL)
     ↓
Client calls brain-execute-action with action: "execute"
     ↓
Server validates: hash + TTL + RBAC + workspace membership
     ↓
Server creates meaning_object → Inserts entity → Audit log
     ↓
Success response → UI updates
```

### 3.3 Proposal Output Contract

Brain responses include a structured `BRAIN_PROPOSALS` block:

```json
[
  {
    "id": "UUID v4",
    "type": "task | goal | plan | idea | update",
    "title": "English, concise, actionable",
    "payload": {
      "description": "Optional",
      "status": "backlog",
      "due_date": null,
      "is_priority": false,
      "goal_id": null,
      "kpi_name": null,
      "kpi_target": null,
      "plan_type": null,
      "entity_type": null,
      "entity_id": null,
      "updates": {}
    },
    "required_role": "member | admin | owner"
  }
]
```

### 3.4 Tool Usage / Action Restrictions

**Allowed actions (passed as `action` parameter to brain-chat):**
- `create_plan` — Draft business plan
- `setup_business` — Initial business setup conversation
- `strategic_analysis` — Analyze current state
- `business_planning` — Evaluate goals landscape
- `business_coaching` — Identify patterns, provide tips
- `risk_analysis` — Focus on delivery risks
- `reprioritize` — Suggest task reprioritization
- `unblock_tasks` — Resolve blocked tasks
- `set_goals` — Help define 90-day goals
- `weekly_checkin` — Generate weekly summary
- `weekly_checkin_ids` — IDS problem solving
- `weekly_checkin_priorities` — Suggest next week priorities
- `suggest_assignee` — Recommend task assignee

### 3.5 No Direct Execution Policy

The Brain **CANNOT**:
- Execute database mutations
- Create tasks, goals, plans, or ideas directly
- Bypass the confirmation gate
- Auto-execute even in voice/casual commands
- Skip the proposal signing step

All Brain output is labeled as **DRAFTS**.

### 3.6 What Brain Can Read

| Data Source | Access Method |
|------------|---------------|
| Business context | Passed in request body from client |
| Installed apps list | Passed in request body from client |
| Current tasks (open, max 30) | Fetched by `useBrainChat.fetchWorkContext()` |
| Active goals (max 10) | Fetched by `useBrainChat.fetchWorkContext()` |
| OIL indicators | Fetched by `brain-chat` edge function via service role |
| OIL memory (top 5) | Fetched by `brain-chat` edge function via service role |
| OIL settings | Fetched by `brain-chat` edge function via service role |

### 3.7 What Brain Cannot Write

| Resource | Restriction |
|----------|------------|
| Any database table | Cannot write directly |
| Tasks/goals/plans/ideas | Only via signed proposals through `brain-execute-action` |
| OIL indicators | Never — OIL computes independently |
| Company memory | Never — only OIL's pattern miner writes |
| Audit logs | Only `brain-execute-action` writes audit logs (not brain-chat) |

### 3.8 Brain Interaction with OIL

1. Brain receives OIL data as system prompt context (read-only)
2. Brain never computes indicators or mines patterns
3. Brain treats all OIL data as advisory, probabilistic, contextual
4. Brain references insights calmly: "Based on recent execution patterns…"
5. Silence is acceptable when nothing meaningful to add
6. Daily Brief format: max 5 lines, once per day, non-repetitive

### 3.9 Brain Guardrails

**Never say:**
- "You are doing this wrong"
- "Best practice says you should…"
- "Most successful companies do X"
- "Your team is underperforming"

**Never do:**
- Rank or score individuals
- Create urgency or fear
- Repeat same warnings
- Override user decisions
- Anthropomorphize ("I feel", "I'm worried")

### 3.10 Brain AI Model

- **Model:** `google/gemini-3-flash-preview`
- **Gateway:** Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
- **Streaming:** Yes (SSE)
- **Message persistence:** Both user and assistant messages persisted to `brain_messages` with meaning objects

---

## 4. Module System

### 4.1 What Is a Module?

A module (app) is a self-contained business capability that integrates with the OS. Modules are registered in `app_registry` and installed per-workspace via `workspace_apps`.

### 4.2 Types

| Type | Examples | Removable | Marketplace Visibility |
|------|----------|-----------|----------------------|
| **System** | ULL, Brain, OIL | No | Hidden (except OIL shows with System badge) |
| **Installable** | Workboard, Chat, Leadership/Aurelius | Yes | Visible |

**System app IDs:** `['ull', 'brain', 'oil']` (defined in `src/lib/systemApps.ts`)

### 4.3 `app_registry` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | e.g., `leadership`, `workboard` |
| `name` | text | Display name |
| `description` | text | |
| `icon` | text | Lucide icon name |
| `pricing` | enum | `free`, `paid`, `subscription` |
| `status` | enum | `active`, `available`, `coming_soon` |
| `capabilities` | text[] | Capability identifiers |
| `actions` | jsonb | AI action definitions |

**RLS:** All authenticated users can SELECT. No INSERT/UPDATE/DELETE from client.

### 4.4 `workspace_apps` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK) | |
| `app_id` | text (FK → app_registry) | |
| `installed_by` | uuid | |
| `installed_at` | timestamptz | |
| `is_active` | boolean | |
| `plan` | text | Default: 'free' |
| `billing_status` | text | Default: 'active' |
| `uninstalled_at` | timestamptz | |

### 4.5 Installation Model

1. User browses Marketplace (`/marketplace`)
2. System apps are excluded from browse view (defined in `HIDDEN_FROM_MARKETPLACE`)
3. User clicks "Install" → inserts into `workspace_apps`
4. `AppInstalledGate` component wraps app routes:
   ```tsx
   <AppInstalledGate appId="leadership">
     <LeadershipPage />
   </AppInstalledGate>
   ```
5. Gate checks `workspace_apps` for active installation
6. If not installed → shows install prompt with redirect to Marketplace

### 4.6 How Modules Integrate

**Sidebar:** Only installed + active + non-system apps appear in the "Apps" section. System apps have dedicated "Business Brain" section.

**Brain capability gating:** `brain-chat` receives `installedApps` list. If an action requires a specific app capability, Brain will recommend activating it.

**Settings:** App-specific settings accessible via `/settings/apps` or `/apps/{id}/settings`.

### 4.7 Module Compliance Requirements

Any new module **MUST:**

1. **ULL compliance:** All user-facing content stored with `meaning_object_id NOT NULL`. Use `createMeaningObject()` + `guardMeaningInsert()` before every insert. Render with `<ULLText>`.
2. **OIL integration:** Emit significant lifecycle events via `useOIL().emitEvent()` (e.g., entity creation, completion, deletion, status changes).
3. **Workspace scoping:** All tables must have `workspace_id` column with RLS via `is_workspace_member()`.
4. **Audit logging:** Log significant state changes to `audit_logs` or `org_events`.
5. **App manifest:** Declare capabilities, routes, and AI actions in a manifest file under `src/apps/{id}/manifest.ts`.
6. **Register in `app_registry`:** Via migration.
7. **Use `AppInstalledGate`** for route protection.
8. **No direct AI execution:** If Brain integration needed, follow the proposal protocol.
9. **i18n for UI labels:** Use `react-i18next` for static labels. Add keys to all language files.
10. **RLS on all tables:** Enforce workspace isolation.

---

## 5. Database Structure

### 5.1 Complete Table Inventory

#### Core System Tables

| Table | Owner | meaning_object_id | RLS |
|-------|-------|--------------------|-----|
| `workspaces` | OS | No | Company members can view; owners can update |
| `workspace_members` | OS | No | Workspace members can view/manage |
| `workspace_apps` | OS | No | Workspace members |
| `companies` | OS | No | Company members; owners update |
| `user_roles` | OS | No | Company members view; owners manage |
| `profiles` | OS | No | Own profile + shared workspace profiles |
| `app_registry` | OS | No | All authenticated users SELECT |
| `audit_logs` | OS | No | Owners/admins SELECT; members INSERT |
| `onboarding_completions` | OS | No | Own user only |

#### Content Tables (ULL-Protected)

| Table | Owner | meaning_object_id | RLS |
|-------|-------|--------------------|-----|
| `tasks` | Workboard | **NOT NULL (FK)** | Workspace members (ALL + SELECT) |
| `goals` | Workboard | **NOT NULL (FK)** | Workspace members (ALL + SELECT) |
| `plans` | Workboard | **NOT NULL (FK)** | Workspace members (ALL + SELECT) |
| `ideas` | Workboard | **NOT NULL (FK)** | Workspace members (ALL + SELECT) |
| `brain_messages` | Brain | **NOT NULL (FK)** | Workspace members INSERT + SELECT |
| `chat_messages` | Chat | **NOT NULL (FK)** | Thread members; meaning object validation on INSERT |

#### ULL Tables

| Table | Owner | RLS |
|-------|-------|-----|
| `meaning_objects` | ULL | Workspace members CREATE/SELECT/UPDATE; no DELETE |
| `content_translations` | ULL | Workspace members via meaning_object join |

#### OIL Tables

| Table | Owner | RLS |
|-------|-------|-----|
| `org_events` | OIL | Workspace members INSERT + SELECT |
| `org_indicators` | OIL | Workspace members INSERT + UPDATE + SELECT |
| `company_memory` | OIL | Workspace members INSERT + UPDATE + SELECT |
| `oil_settings` | OIL | Admins/owners ALL; members SELECT |

#### Chat Tables

| Table | Owner | RLS |
|-------|-------|-----|
| `chat_threads` | Chat | Workspace members CREATE; thread members/creator SELECT; admins DELETE |
| `chat_thread_members` | Chat | Self SELECT/UPDATE; workspace members INSERT; admins DELETE |
| `chat_reactions` | Chat | Thread members via message join |
| `chat_attachments` | Chat | Thread members via message join; uploaders DELETE |
| `chat_audit_logs` | Chat | Workspace members INSERT + SELECT |

#### Enterprise Tables

| Table | Owner | RLS |
|-------|-------|-----|
| `company_risk_scores` | Enterprise | Company admins/owners SELECT only |
| `workspace_risk_scores` | Enterprise | Company admins/owners SELECT only |
| `risk_forecasts` | Enterprise | Admins + workspace members SELECT |
| `risk_snapshots` | Enterprise | Admins + workspace members SELECT |

#### Other Tables

| Table | Owner | RLS |
|-------|-------|-----|
| `business_contexts` | Brain | Workspace members (ALL + SELECT) |
| `ai_action_logs` | Brain | Workspace members CREATE + SELECT; own user UPDATE + DELETE |
| `notifications` | OS | Own user CRUD; workspace members INSERT |
| `digest_preferences` | Insights | Own user CRUD |
| `weekly_digests` | Insights | Own user SELECT + UPDATE; workspace members INSERT |
| `weekly_checkins` | Workboard | Workspace members CREATE + SELECT; creator UPDATE + DELETE |

### 5.2 Key Constraints

**NOT NULL on `meaning_object_id`:**
- `tasks.meaning_object_id` — NOT NULL, FK → `meaning_objects`
- `goals.meaning_object_id` — NOT NULL, FK → `meaning_objects`
- `plans.meaning_object_id` — NOT NULL, FK → `meaning_objects`
- `ideas.meaning_object_id` — NOT NULL, FK → `meaning_objects`
- `brain_messages.meaning_object_id` — NOT NULL, FK → `meaning_objects`
- `chat_messages.meaning_object_id` — NOT NULL, FK → `meaning_objects`

**Unique constraints:**
- `profiles.user_id` — UNIQUE
- `user_roles(user_id, role)` — UNIQUE
- `business_contexts.workspace_id` — UNIQUE (one-to-one)
- `oil_settings.workspace_id` — UNIQUE (one-to-one)
- `org_indicators(workspace_id, indicator_key)` — UNIQUE (upsert target)

### 5.3 Database Functions

| Function | Type | Purpose |
|----------|------|---------|
| `is_workspace_member(uuid, uuid)` | SECURITY DEFINER | Core RLS gate |
| `is_company_member(uuid, uuid)` | SECURITY DEFINER | Company membership check |
| `has_company_role(uuid, uuid, app_role)` | SECURITY DEFINER | Admin/owner check |
| `is_chat_thread_member(uuid, uuid)` | SECURITY DEFINER | Chat access check |
| `get_workspace_company(uuid)` | SECURITY DEFINER | Resolve company from workspace |
| `get_thread_workspace(uuid)` | SECURITY DEFINER | Resolve workspace from thread |
| `handle_new_user()` | Trigger function | Creates profile on auth.users insert |
| `set_company_created_by()` | Trigger function | Sets company creator |
| `update_updated_at_column()` | Trigger function | Auto-update timestamps |
| `cleanup_old_org_events()` | Maintenance | Delete org_events older than 90 days |
| `cleanup_stale_memory()` | Maintenance | Archive low-confidence old memory |

### 5.4 Enums

| Enum | Values |
|------|--------|
| `app_pricing` | `free`, `paid`, `subscription` |
| `app_role` | `owner`, `admin`, `member` |
| `app_status` | `active`, `available`, `coming_soon` |
| `business_type` | `trade`, `services`, `factory`, `online`, `retail`, `consulting`, `other` |
| `plan_type` | `sales`, `marketing`, `operations`, `finance`, `team`, `custom` |
| `risk_level` | `low`, `moderate`, `elevated`, `high`, `critical` |
| `task_status` | `backlog`, `planned`, `in_progress`, `blocked`, `done` |
| `team_role` | `owner`, `operations`, `sales`, `marketing`, `finance`, `custom` |

---

## 6. Frontend Architecture

### 6.1 App Router Structure

```
/auth                          → AuthPage (login/signup)
/onboarding                    → OnboardingPage (company + workspace setup)

/ (ProtectedRoute + OSLayout)
├── /                          → TodayPage (dashboard)
├── /brain                     → BrainPage (AI chat console)
├── /brain/setup               → BusinessSetupPage
├── /insights                  → InsightsPage
├── /insights/archive          → DigestArchivePage
├── /marketplace               → Marketplace
├── /enterprise/risk-dashboard → RiskDashboardPage
│
├── /apps/workboard            → WorkboardLayout (nested)
│   ├── /                      → UnifiedTasksPage
│   ├── /goals                 → WorkboardGoalsPage
│   ├── /calendar              → WorkboardCalendarPage
│   ├── /checkin               → WeeklyCheckinPage
│   └── /brainstorm            → WorkboardBrainstormPage
│
├── /apps/chat                 → ChatPage
├── /apps/leadership           → AppInstalledGate → LeadershipPage
├── /apps/leadership/settings  → AppInstalledGate → LeadershipSettingsPage
│
├── /settings                  → SettingsPage (hub)
│   ├── /account               → AccountSettingsPage
│   ├── /company               → CompanySettingsPage
│   ├── /workspaces            → WorkspacesSettingsPage
│   ├── /team                  → TeamRolesSettingsPage
│   ├── /language              → LanguageSettingsPage
│   ├── /workspace/language    → WorkspaceLanguageSettingsPage
│   ├── /notifications         → NotificationsSettingsPage
│   ├── /appearance            → AppearanceSettingsPage
│   ├── /apps                  → AppsSettingsPage
│   ├── /intelligence          → IntelligenceSettingsPage (OIL governance)
│   └── /privacy               → PrivacySettingsPage (GDPR)
│
├── /docs/system/ull           → ULLDeveloperContractPage
└── *                          → NotFound
```

### 6.2 Context Providers (Nesting Order)

```tsx
<ErrorBoundary>
  <QueryClientProvider>
    <TooltipProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <LanguageProvider>
                <BrainCommandProvider>
                  <AppRoutes />
                  <OnboardingTour />
                </BrainCommandProvider>
              </LanguageProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
</ErrorBoundary>
```

### 6.3 Key Hooks

| Hook | Purpose |
|------|---------|
| `useULL()` | Translation state management: `getText()`, `getTextByMeaning()` |
| `useOIL()` | Emit organizational events: `emitEvent()`, `emitEvents()` |
| `useBrainChat()` | Brain conversation: `sendMessage()`, `messages`, `isLoading` |
| `useBrainExecute()` | Proposal signing + execution: `signProposals()`, `executeProposal()` |
| `useWorkboardTasks()` | Task CRUD with ULL + OIL integration |
| `useBrainWorkboardIntegration()` | Bridge Brain proposals to Workboard |
| `useWorkspace()` | Current workspace, installed apps, business context |
| `useAuth()` | User session, loading state |
| `useLanguage()` | Current UI language, content locale |
| `useOILIndicators()` | Fetch and display OIL indicators |
| `useOILSettings()` | Manage OIL governance settings |
| `useInsights()` | Strategic insights data |
| `useDecisionSignals()` | Decision intelligence signals |
| `useEnterpriseRisk()` | Company-level risk data |
| `useNotifications()` | Notification management |
| `useTeamMembers()` | Workspace member discovery |
| `useChatThreads()` | Chat thread management |
| `useChatMessages()` | Chat message sending/receiving |
| `useChatReactions()` | Emoji reactions |
| `useChatTaskLinks()` | Chat-to-Work integration |
| `useTypingIndicator()` | Real-time typing indicators |
| `useVoiceInput()` | Voice input processing |
| `useSmartCapabilities()` | Dynamic app capability checking |
| `useDigestArchive()` | Weekly digest history |
| `useDigestPreferences()` | Digest notification settings |
| `useAiAssignee()` | AI-suggested task assignment |

### 6.4 Enforcement Wrappers

| Component | Purpose |
|-----------|---------|
| `<ULLText>` | Renders translated content via meaning objects |
| `<AppInstalledGate>` | Blocks access to uninstalled app routes |
| `<ProtectedRoute>` | Requires auth + workspace |
| `<AuthRoute>` | Redirects authenticated users away from login |
| `<OnboardingRoute>` | Redirects users with workspaces away from onboarding |
| `<ErrorBoundary>` | Catches rendering errors |

### 6.5 Layout Philosophy

- **OSLayout:** Sidebar (collapsible) + TopBar + main content area
- **Sidebar:** Brain section (fixed) + dynamic Apps section (installed only) + Marketplace/Settings
- **TopBar:** BrainCommandBar (visible on all screens including mobile) + NotificationBell + language switcher
- **Responsive:** Mobile-first; sidebar becomes sheet overlay on mobile
- **Dark/Light:** Theme provider with system preference detection

### 6.6 i18n

- **Framework:** react-i18next with i18next-browser-languagedetector
- **Supported UI languages:** `en`, `ar`, `fr`, `es`, `de`
- **RTL support:** Synchronized with language selection (Arabic)
- **Content languages:** Any language via ULL (AI translation)
- **User preference:** `profiles.preferred_locale` (UI), `profiles.content_locale` (ULL)
- **Workspace default:** `workspaces.default_locale`

---

## 7. Security Model

### 7.1 RLS Policy Summary

**Standard pattern for workspace-scoped tables:**
```sql
CREATE POLICY "Workspace members can view"
ON public.table_name FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage"
ON public.table_name FOR ALL
USING (is_workspace_member(auth.uid(), workspace_id));
```

**Admin-restricted tables:**
- `audit_logs` SELECT: `has_company_role(owner) OR has_company_role(admin)`
- `oil_settings` ALL: `has_company_role(owner) OR has_company_role(admin)`
- `company_risk_scores` SELECT: `has_company_role(owner) OR has_company_role(admin)`

**Chat security:**
- Thread visibility: creator bypass (`created_by = auth.uid()`) OR thread member
- Message visibility: thread member check via `EXISTS` subquery
- Message deletion: sender OR admin/owner
- Anti-recursion: Direct `user_id = auth.uid()` checks instead of recursive functions

**Meaning objects:**
- INSERT: `is_workspace_member()`
- SELECT: `is_workspace_member()`
- UPDATE: `is_workspace_member()` (and separately: creator-only soft delete)
- DELETE: Prohibited (soft delete via `deleted_at`)

### 7.2 Permission Check Flow

```
Client Request
     ↓
Frontend: AuthContext.user check
     ↓
Frontend: WorkspaceContext.currentWorkspace check
     ↓
Supabase Client: auto-injects JWT in Authorization header
     ↓
Database: RLS policy evaluates using auth.uid()
     ↓
RLS calls SECURITY DEFINER functions (no recursion)
     ↓
Access granted or denied
```

### 7.3 Edge Function Security

| Function | Auth Method | Additional Checks |
|----------|-------------|-------------------|
| `brain-chat` | `getUser(token)` | Input validation (message count, length, action whitelist) |
| `brain-execute-action` | `getUser(token)` | HMAC-SHA256 verification + TTL + RBAC role hierarchy |
| `oil-ingest` | `getUser(token)` | Workspace existence validation |
| `oil-compute` | `getUser(token)` | Cooldown throttling (6h) |
| `ull-translate` | Bearer token | Workspace membership via meaning_object join |
| `invite-member` | Bearer token | Workspace admin/owner check |
| `manage-member` | Bearer token | Role management restrictions |
| `gdpr-export` | Bearer token | Own workspace data only |
| `onboarding-create` | Bearer token | SECURITY DEFINER for initial setup |

**Note:** `verify_jwt = false` in `config.toml` for all functions — JWT validation is handled manually within each function for flexibility.

### 7.4 Brain Execution Security (HMAC Protocol)

1. **Signing:** `brain-execute-action` with `action: "sign"`
   - Verifies user is workspace member
   - Creates HMAC-SHA256 hash: `sign(userId + workspaceId + proposalId + expiresAt)`
   - Sets 10-minute TTL
   - Returns signed proposals

2. **Execution:** `brain-execute-action` with `action: "execute"`
   - Validates expiration (rejects if past TTL)
   - Verifies HMAC hash (rejects if tampered)
   - Checks RBAC: `hierarchy = { owner: 3, admin: 2, member: 1 }`
   - Executes with **user-scoped client** (RLS enforced)
   - Audit logs success/failure via **service client**

3. **Whitelist for updates:**
   - `tasks`: title, description, status, due_date, is_priority, assigned_to, blocked_reason
   - `goals`: title, description, status, due_date, kpi_current
   - `plans`: title, description
   - `ideas`: title, description, status

### 7.5 Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | Yes | User profile images |
| `company-assets` | Yes | Company logos |
| `chat-attachments` | Yes | Chat file attachments |

---

## 8. System Constraints

### 8.1 What Must NEVER Be Broken

1. **Meaning-First rule** — No content entity may exist without `meaning_object_id`
2. **RLS workspace isolation** — Cross-workspace data access must be impossible
3. **Brain non-execution** — Brain must never write to database directly
4. **HMAC proposal integrity** — Proposals must be signed and time-limited
5. **OIL privacy contract** — No individual profiling or performance scoring
6. **Audit trail** — Brain executions and OIL computations must always be logged
7. **System app immutability** — ULL, Brain, OIL cannot be uninstalled or deactivated

### 8.2 Rendering Constraints

- All user-generated content MUST be rendered via `<ULLText>` or equivalent meaning-aware component
- UI labels MUST use `t()` from react-i18next
- No raw text interpolation for content fields
- Fallback text must always be provided (zero-loading-state design)
- Semantic tokens only — no direct Tailwind colors

### 8.3 AI Constraints

- Brain responses in user's language; proposals in English
- Brain never says "I feel", "I'm worried", "Best practice says"
- Brain never ranks individuals or scores employees
- OIL pattern mining rejects patterns referencing individuals (regex filter)
- AI translation uses English `subject` field as source context
- Maximum 50 messages per brain-chat request
- Maximum 10,000 characters per message

### 8.4 Data Mutation Constraints

- All inserts into protected tables go through `guardMeaningInsert({ block: true })`
- Tasks/goals/plans/ideas: `createMeaningObject()` must be called before insert
- Brain-originated mutations: only via signed proposal → `brain-execute-action`
- OIL indicators: upsert only (no delete, no overwrite without trend tracking)
- Company memory: insert or reinforce (no direct update of statements)
- Meaning objects: no hard delete (soft delete via `deleted_at`)
- Chat messages: no UPDATE (immutable once sent)

### 8.5 Expansion Constraints

- New modules MUST comply with ULL (meaning objects required)
- New modules MUST emit OIL events for significant lifecycle changes
- New tables MUST have `workspace_id` + RLS
- New edge functions MUST validate auth via `getUser(token)`
- New AI capabilities MUST use Lovable AI Gateway (no external API keys required for supported models)
- New sidebar entries MUST be gated by `AppInstalledGate` (unless system app)
- New i18n keys MUST be added to all 5 language files

---

## 9. Current Limitations and Known Violations

### 9.1 Incomplete Implementations

| Area | Status | Detail |
|------|--------|--------|
| **FinancialPressure indicator** | Placeholder | Returns static score 30 — "Finance app not yet active" |
| **TeamAlignment indicator** | Placeholder | Returns static score 50 — "More data needed" |
| **OIL trend history** | Missing | Trends are point-in-time comparisons only; no historical trend storage |
| **Real-time OIL updates** | Missing | No Supabase Realtime subscription for indicator changes |
| **Meaning v2 adoption** | Partial | Schema defined but most content still uses v1 |
| **Chat message search** | Missing | No full-text search on chat messages |
| **Chat file preview** | Basic | Attachments stored but preview/download UX is minimal |
| **Notification push** | Missing | In-app only; no push notifications (web or mobile) |
| **Mobile (Capacitor)** | Configured | Capacitor config exists but native builds not validated |
| **Weekly digest CRON** | Configured | Edge function exists but scheduling mechanism unclear |
| **`verify_jwt = false`** | All functions | JWT validation is manual in code; `config.toml` sets all to `false` |

### 9.2 Potential Security Gaps

| Area | Risk | Mitigation |
|------|------|------------|
| `verify_jwt = false` on all edge functions | Functions are accessible without JWT if auth check has bugs | Manual `getUser(token)` in every function |
| `workspace_members.invite_status` dual values | Both `active` and `accepted` used inconsistently | `brain-execute-action` now checks `.in(["active", "accepted"])` |
| No rate limiting on `oil-ingest` | Could be flooded with events | Max 100 events per batch, but no per-user rate limit |
| Storage buckets all public | Uploaded files accessible without auth | Acceptable for avatars/logos; chat attachments may need review |
| No email verification enforcement | Users may sign up without verifying | Supabase auth auto-confirm is NOT enabled; verification depends on auth config |

### 9.3 Architectural Debt

1. **Type casting:** Several hooks use `as any` for Supabase query results due to type generation limitations
2. **Meaning object type casing:** `meaningObject.ts` uses uppercase types (`TASK`), while database stores lowercase (`task`) — normalized at insert time but inconsistent in code
3. **No soft-delete on tasks:** `deleteTask()` uses hard delete instead of setting `deleted_at`
4. **OIL event emission coverage:** Only tasks emit lifecycle events; goals, plans, ideas do not yet emit OIL events
5. **Chat-to-Work:** Implementation exists but bidirectional link UI (task tags in chat, chat links in tasks) may be incomplete
6. **Brain message history:** `useBrainChat()` starts with empty messages on each mount — no historical message loading

---

*This document is the canonical technical specification for AiBizos. All new modules must fully comply with the architecture, enforcement rules, and constraints defined herein.*
