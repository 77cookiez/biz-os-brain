# Audit Report — Phase 0 → Phase 3 Consistency

**Date:** 2026-02-11  
**Scope:** ULL, TeamChat, Meaning v2, Insights, Weekly Digest, Decision Intelligence

---

## Found Issues

### P2 Violations — Hardcoded English in UX
- `MessageView.tsx`: "Task created", "Create Task", "Delete", "Welcome to TeamChat" not using i18n
- `TaskCard.tsx`: "Discussed in TeamChat" not using i18n  
- `ChatPage.tsx`: "TeamChat", "Select a conversation or start a new one." not using i18n
- **Missing `chat.*` i18n namespace** in all 3 translation files (en/ar/fr)

### Code Duplication
- `isFromChat()` function duplicated in `insights-get/index.ts` and `decision-signals/index.ts` (acceptable for edge function isolation — no shared module system)

### Minor
- `useChatTaskLinks` fetches ALL workspace tasks to find chat-origin links. Could be optimized with a server-side filter, but not a correctness issue.
- `emerald-500` used for check icon in MessageView — pre-existing, not a design token (cosmetic, non-blocking)

---

## Fixes Applied

1. **Added `chat.*` i18n keys** to `en.json`, `ar.json`, `fr.json`:
   - `chat.title`, `chat.selectThread`, `chat.welcome`, `chat.welcomeSubtitle`
   - `chat.createTask`, `chat.deleteMessage`, `chat.taskCreated`, `chat.discussedInChat`

2. **Replaced all hardcoded English** in:
   - `src/components/chat/MessageView.tsx` → uses `t('chat.*')`
   - `src/components/workboard/TaskCard.tsx` → uses `t('chat.discussedInChat')`
   - `src/pages/chat/ChatPage.tsx` → uses `t('chat.title')` and `t('chat.selectThread')`

3. **Added i18n key consistency test** (`src/test/i18n-keys.test.ts`):
   - Verifies all English keys exist in Arabic and French
   - Detects orphan keys in non-English files
   - Prevents future translation drift

---

## Remaining Known Risks

- `isFromChat()` is duplicated across edge functions (acceptable for Deno isolation)
- `useChatTaskLinks` performance at scale (>500 tasks) — acceptable for current workloads
- Weekly digest notification `onConflict` relies on a composite unique constraint that may not exist as a formal DB constraint (uses `ignoreDuplicates`)
- `emerald-500` hardcoded color in awareness tag icon (cosmetic)

---

## Final Compliance Checklist

| Check | Status |
|---|---|
| **P1: No Meaning, No Content** — all writes use `createMeaningObject` + `guardMeaningInsert` | ✅ PASS |
| **P2: Language is projection** — no hardcoded English in UX paths | ✅ PASS (fixed) |
| **P3: ULL is separate Core System App** — hidden from sidebar, non-removable | ✅ PASS |
| **P4: AI is assistive** — Brain never auto-executes, draft-only output | ✅ PASS |
| **P5: Security** — RLS enforces workspace boundary, thread-member-only chat access | ✅ PASS |
| Meaning v1/v2 union schema works for all read/write paths | ✅ PASS |
| Chat → Task creates NEW meaning object (not reusing message meaning) | ✅ PASS |
| Thread → Goal collects meaning_json from messages | ✅ PASS |
| Awareness links: "Task created" → Workboard, "Discussed in TeamChat" → thread | ✅ PASS |
| Insights computed server-side only (client is renderer) | ✅ PASS |
| `from_chat` definition consistent across `insights-get` and `decision-signals` | ✅ PASS |
| Stale window = 5 days consistently | ✅ PASS |
| Weekly digest idempotent (max 1/week/user via upsert) | ✅ PASS |
| Decision Intelligence: no storage, session-level dismiss, supportive language only | ✅ PASS |
| Digest includes at most 1 signal teaser | ✅ PASS |
| No commands, no ranking people, no performance scoring | ✅ PASS |
| Content locale prioritized over UI locale for ULL projections | ✅ PASS |
| ULL cache cleared on language change | ✅ PASS |
| i18n key consistency test added to prevent future drift | ✅ PASS |
