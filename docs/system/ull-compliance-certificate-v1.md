# ULL Compliance Certificate v1.0

**System:** AiBizos — AI Business Operating System  
**Date:** 2026-02-13  
**Version:** 1.0  
**Status:** ✅ FULLY ULL-COMPLIANT  

---

## 1. Governing Principle

> **No Meaning, No Content.**

All user-generated and AI-generated content MUST have a corresponding `meaning_object_id` before it can be stored. Human language is a projection layer — the canonical semantic truth lives in `meaning_objects`.

ULL is **ALWAYS ON**. It applies to all existing modules and all future modules by default. No exemption may be granted without formal amendment to this certificate.

---

## 2. Tables — Database-Level Enforcement

### 2.1 Meaning-Protected Tables (NOT NULL + FK enforced)

| Table | `meaning_object_id` | NOT NULL | FK → `meaning_objects` | Guard Protected |
|---|---|---|---|---|
| `tasks` | ✅ | ✅ | ✅ | ✅ |
| `goals` | ✅ | ✅ | ✅ | ✅ |
| `plans` | ✅ | ✅ | ✅ | ✅ |
| `ideas` | ✅ | ✅ | ✅ | ✅ |
| `brain_messages` | ✅ | ✅ | ✅ | ✅ |
| `chat_messages` | ✅ | ✅ | ✅ | ✅ |

### 2.2 Exempt Tables (with rationale)

| Table | Rationale |
|---|---|
| `notifications` | Event metadata only. Text is rendered via i18n templates (`t('notification.type.key')`) with variable interpolation. No raw dynamic user text is stored in `title`/`body` — they use structured type keys resolved at render time. |
| `org_events` | System-generated telemetry. `meaning_object_id` is nullable and used only for optional cross-referencing. Not user-visible content. |
| `audit_logs` | Internal system audit trail. Not rendered to users as content. |
| `content_translations` | Downstream projection cache. Derives from `meaning_objects` — not a source of truth. |
| `company_memory` | AI-internal knowledge graph. Statements are system-generated and not directly rendered to users. |

---

## 3. Insert Paths — Runtime Guard Coverage

All insert paths call `createMeaningObject()` first, then `guardMeaningInsert(table, payload, { block: true })` before the database insert.

| Insert Location | File | `createMeaningObject` | `guardMeaningInsert` |
|---|---|---|---|
| Task creation (Workboard) | `useWorkboardTasks.ts` | ✅ | ✅ |
| Task creation (Team) | `TeamTasksPage.tsx` | ✅ | ✅ |
| Task creation (Unified) | `UnifiedTasksPage.tsx` | ✅ | ✅ |
| Task creation (Brain dialog) | `AddTaskDialog.tsx` | ✅ | ✅ |
| Task creation (Chat-to-Work) | `useChatToWork.ts` | ✅ | ✅ |
| Task creation (Weekly Checkin) | `WeeklyCheckinPage.tsx` | ✅ | ✅ |
| Goal creation (Goals page) | `GoalsPage.tsx` | ✅ | ✅ |
| Goal creation (Workboard) | `WorkboardGoalsPage.tsx` | ✅ | ✅ |
| Goal creation (Chat-to-Work) | `useChatToWork.ts` | ✅ | ✅ |
| Plan creation | `GoalsPage.tsx` | ✅ | ✅ |
| Idea creation (Brainstorm) | `WorkboardBrainstormPage.tsx` | ✅ | ✅ |
| Brain message persist | `useBrainChat.ts` | ✅ | ✅ |
| Chat message send | `useChatMessages.ts` | ✅ | ✅ |

### Guard Configuration

```typescript
// src/lib/meaningGuard.ts
const MEANING_PROTECTED_TABLES = [
  'tasks', 'goals', 'ideas', 'brain_messages', 'plans', 'chat_messages'
] as const;

// Default: block = true (throws Error on violation)
guardMeaningInsert(table, payload, { block: true });
```

---

## 4. UI Rendering — ULLText Coverage

All user-visible content from meaning-protected tables is rendered through `<ULLText>` components.

| Page/Component | Entity | Fields via ULLText |
|---|---|---|
| `UnifiedTasksPage` | Tasks | title, description |
| `TeamTasksPage` | Tasks | title |
| `TodayPage` | Tasks | title |
| `WorkboardCalendarPage` | Tasks | title |
| `TaskCard` | Tasks | title |
| `WorkboardGoalsPage` | Goals | title, description |
| `GoalsPage` | Goals | title, description, SelectItem |
| `GoalsPage` | Plans | title, description |
| `WorkboardBrainstormPage` | Ideas | title, description |
| `InsightsPage` | Blockers/Decisions | title |
| `StepGoalReview` | Goals (checkin) | title |
| Chat message rendering | Messages | via meaning_json projection |
| Brain message rendering | Brain messages | via content + meaning |

### Static UI Labels (i18n — NOT ULL)

Static interface text (buttons, headers, navigation, settings labels) uses `react-i18next` with `t()` keys. This is correct and intentional — ULL applies only to dynamic user/AI content.

---

## 5. Notifications Strategy

**Decision: Option 2 — i18n Template Rendering**

Notifications use structured `type` keys (e.g., `digest_ready`, `task_assigned`) stored in the `type` column. The `title` and `body` fields contain i18n-resolvable keys or pre-rendered text from edge functions. At render time, the `NotificationBell` component resolves these through `t()` with variable interpolation from `data_json`.

**Rationale:** Notifications are system-generated events, not user-authored content. They do not require semantic preservation across languages — they are ephemeral alerts rendered in the user's UI language.

---

## 6. Translation Pipeline

```
User Input (any language)
    ↓
meaning_objects (canonical semantic truth)
    ↓
ull-translate Edge Function (Gemini 2.5 Flash)
    ↓
content_translations (projection cache, 7-day TTL)
    ↓
ULLText / useULL (renders in user's content locale)
```

**Cache Strategy:**
- Client-side: IndexedDB with 7-day TTL, workspace-scoped
- Server-side: `content_translations` table with `(meaning_object_id, target_lang, field)` unique constraint
- Invalidation: Full cache clear on language change

---

## 7. Regression Prevention

### CI Script: `scripts/ull-compliance-check.sh`

A regression check script runs in CI to detect potential ULL violations. See `scripts/ull-compliance-check.sh` for implementation.

### Runtime Guard

The `guardMeaningInsert()` function runs with `block: true` by default, throwing a hard error if any insert into a meaning-protected table lacks `meaning_object_id`.

---

## 8. Future Module Requirements

Any new module or app added to AiBizos MUST:

1. Create `meaning_objects` before storing user/AI content
2. Include `meaning_object_id NOT NULL` FK in content tables
3. Call `guardMeaningInsert()` before all inserts
4. Render content via `<ULLText>` components
5. Populate `source_lang` correctly
6. Be added to `MEANING_PROTECTED_TABLES` in `meaningGuard.ts`

**No exceptions. ULL is a permanent system law.**

---

## 9. Certification

| Check | Status |
|---|---|
| All core content tables enforce `meaning_object_id NOT NULL` | ✅ |
| All insert paths call `createMeaningObject()` first | ✅ |
| All insert paths call `guardMeaningInsert({ block: true })` | ✅ |
| All UI content renders via `<ULLText>` | ✅ |
| `notifications` exempt with documented rationale | ✅ |
| `org_events` exempt with documented rationale | ✅ |
| CI regression script in place | ✅ |
| Runtime guard default = `block: true` | ✅ |

### Verdict

## ✅ FULLY ULL-COMPLIANT

**Signed:** AiBizos ULL Compliance Officer  
**Date:** 2026-02-13  
**Certificate Version:** 1.0
