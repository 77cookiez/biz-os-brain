# ULL Compliance Certificate v1.0

**System:** AiBizos — AI Business Operating System  
**Certificate Date:** 2026-02-13  
**Version:** 1.0  
**Auditor:** System ULL Compliance Engine  
**Status:** ✅ FULLY ULL-COMPLIANT  

---

## 1. Scope of Enforcement

### 1.1 Governing Principle

> **No Meaning, No Content.**

All user-generated and AI-generated content MUST have a corresponding `meaning_object_id` before it can be stored. Human language is a projection layer — the canonical semantic truth lives in `meaning_objects`.

ULL is **ALWAYS ON**. It applies to all existing modules and all future modules by default. No exemption may be granted without formal amendment to this certificate.

### 1.2 Meaning-Protected Tables

| Table | `meaning_object_id` | NOT NULL | FK → `meaning_objects` | Guard Protected | `source_lang` |
|---|---|---|---|---|---|
| `tasks` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `goals` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `plans` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ideas` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `brain_messages` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `chat_messages` | ✅ | ✅ | ✅ | ✅ | ✅ |

### 1.3 Exempt Tables

| Table | Rationale |
|---|---|
| `notifications` | Event metadata only. Text is rendered via i18n templates (`t('notification.type.key')`) with variable interpolation from `data_json`. No raw dynamic user text is stored. |
| `org_events` | System-generated telemetry. `meaning_object_id` is nullable and used only for optional cross-referencing. Not user-visible content. |
| `audit_logs` | Internal system audit trail. Not rendered to users as content. |
| `chat_audit_logs` | Internal chat audit trail. Not rendered to users as content. |
| `content_translations` | Downstream projection cache. Derives from `meaning_objects` — not a source of truth. |
| `company_memory` | AI-internal knowledge graph. System-generated statements not directly rendered to users. |
| `weekly_checkins` | Aggregated snapshot data. Individual content items (tasks, goals) already have their own meaning objects. |
| `weekly_digests` | System-generated summary. `narrative_text` is AI-rendered in the user's language at generation time (native translation exception). |

---

## 2. Insert Path Compliance

All insert paths call `createMeaningObject()` first, then `guardMeaningInsert(table, payload, { block: true })` before the database insert.

### 2.1 Task Insert Paths

| Insert Location | File | `createMeaningObject` | `guardMeaningInsert` |
|---|---|---|---|
| Workboard task creation | `useWorkboardTasks.ts` | ✅ | ✅ |
| Team task creation | `TeamTasksPage.tsx` | ✅ | ✅ |
| Unified task creation | `UnifiedTasksPage.tsx` | ✅ | ✅ |
| Brain dialog task creation | `AddTaskDialog.tsx` | ✅ | ✅ |
| Chat-to-Work task creation | `useChatToWork.ts` | ✅ | ✅ |
| Weekly Checkin task creation | `WeeklyCheckinPage.tsx` | ✅ | ✅ |

### 2.2 Goal Insert Paths

| Insert Location | File | `createMeaningObject` | `guardMeaningInsert` |
|---|---|---|---|
| Goals page creation | `GoalsPage.tsx` | ✅ | ✅ |
| Workboard goals creation | `WorkboardGoalsPage.tsx` | ✅ | ✅ |
| Chat-to-Work goal creation | `useChatToWork.ts` | ✅ | ✅ |

### 2.3 Other Content Insert Paths

| Insert Location | File | `createMeaningObject` | `guardMeaningInsert` |
|---|---|---|---|
| Plan creation | `GoalsPage.tsx` | ✅ | ✅ |
| Idea creation (Brainstorm) | `WorkboardBrainstormPage.tsx` | ✅ | ✅ |
| Brain message persist | `useBrainChat.ts` | ✅ | ✅ |
| Chat message send | `useChatMessages.ts` | ✅ | ✅ |

### 2.4 Guard Configuration

```typescript
// src/lib/meaningGuard.ts
const MEANING_PROTECTED_TABLES = [
  'tasks', 'goals', 'ideas', 'brain_messages', 'plans', 'chat_messages'
] as const;

// Default: block = true (throws Error on violation)
guardMeaningInsert(table, payload, { block: true });
```

---

## 3. UI Rendering Compliance

All user-visible content from meaning-protected tables is rendered through `<ULLText>` components.

### 3.1 ULLText Coverage

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

### 3.2 Static UI Labels (i18n — NOT ULL)

Static interface text (buttons, headers, navigation, settings labels) uses `react-i18next` with `t()` keys. This is correct and intentional — ULL applies only to dynamic user/AI content.

---

## 4. Runtime Enforcement

### 4.1 Database-Level Enforcement

- All meaning-protected tables have `meaning_object_id` as `NOT NULL`
- All meaning-protected tables have FK constraints to `meaning_objects(id)`
- Inserts without `meaning_object_id` are rejected at the database level

### 4.2 Runtime Guard Enforcement

- `guardMeaningInsert()` runs with `block: true` by default
- Throws a hard error: `[ULL Guard] Blocked insert into "${table}" — meaning_object_id is required.`
- Covers all 6 meaning-protected tables

### 4.3 CI Regression Prevention

Script: `scripts/ull-compliance-check.sh`

Checks:
1. `meaningGuard.ts` covers all required tables
2. All insert paths include `guardMeaningInsert` calls
3. Suspicious `.insert({ title:` patterns without `meaning_object_id`
4. Content-rendering pages use `ULLText`

Exit code 1 on any violation.

---

## 5. Notifications Strategy

**Decision: i18n Template Rendering (Option 2)**

Notifications use structured `type` keys (e.g., `digest_ready`, `task_assigned`) stored in the `type` column. The `title` and `body` fields contain i18n-resolvable keys. At render time, the `NotificationBell` component resolves these through `t()` with variable interpolation from `data_json`.

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

## 7. Future Module Requirements

Any new module or app added to AiBizos MUST:

1. Create `meaning_objects` before storing user/AI content
2. Include `meaning_object_id NOT NULL` FK in content tables
3. Call `guardMeaningInsert()` before all inserts
4. Render content via `<ULLText>` components
5. Populate `source_lang` correctly
6. Be added to `MEANING_PROTECTED_TABLES` in `meaningGuard.ts`

**No exceptions. ULL is a permanent system law.**

---

## 8. Regression Prevention Plan

### 8.1 Code Search Patterns

The following patterns in `src/` (excluding tests) indicate potential violations:

```
.insert({ title:        → must have meaning_object_id nearby
.insert({ content:      → must have meaning_object_id nearby
.from('tasks').insert   → must call guardMeaningInsert before
.from('goals').insert   → must call guardMeaningInsert before
.from('ideas').insert   → must call guardMeaningInsert before
.from('plans').insert   → must call guardMeaningInsert before
.from('brain_messages') → must call guardMeaningInsert before
.from('chat_messages')  → must call guardMeaningInsert before
```

### 8.2 Build-Time Enforcement

Run `scripts/ull-compliance-check.sh` in CI pipeline. Non-zero exit code blocks merge.

### 8.3 Future Modules Policy

Every PR introducing a new content entity must:
- Add the table to `MEANING_PROTECTED_TABLES`
- Include `createMeaningObject` in the insert path
- Use `<ULLText>` for rendering
- Update this certificate

---

## 9. Certification

| Check | Status |
|---|---|
| All core content tables enforce `meaning_object_id NOT NULL` | ✅ |
| All core content tables have FK to `meaning_objects` | ✅ |
| All insert paths call `createMeaningObject()` first | ✅ |
| All insert paths call `guardMeaningInsert({ block: true })` | ✅ |
| All UI content renders via `<ULLText>` | ✅ |
| `notifications` exempt with documented rationale | ✅ |
| `org_events` exempt with documented rationale | ✅ |
| CI regression script in place | ✅ |
| Runtime guard default = `block: true` | ✅ |
| Source language tracked on all content tables | ✅ |
| IndexedDB cache workspace-scoped | ✅ |
| Translation cache cleared on language change | ✅ |

### Verdict

## ✅ FULLY ULL-COMPLIANT

**Auditor:** System ULL Compliance Engine  
**Date:** 2026-02-13  
**Certificate Version:** 1.0  
**Next Review:** Upon addition of any new content module

---

*This certificate is a permanent architectural record. ULL enforcement is non-negotiable and applies to all future development.*
