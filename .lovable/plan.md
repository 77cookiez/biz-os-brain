هذا النص الذي أرسلته الآن **ممتاز جدًا** ومطابق للاتفاق بنسبة كبيرة ✅
وأقدر تقول له: **Approved (Phase 1)** بعد **تعديلات طفيفة مهمة** حتى يصير “Meaning-first” مضبوط وما يطلع ثغرات أو ازدواجية.

أعطيك أدناه **نسخة معدّلة جاهزة للنسخ** (نفس المحتوى تقريبًا لكن مع 6 تحسينات حاسمة):

* ✅ تثبيت أن ULL = **System App منفصل**
* ✅ إصلاح API: `workspaceId` vs `tenantId` + RLS
* ✅ توحيد كتابة/تحديث المعنى (create/update) بدل create فقط
* ✅ منع “meaningJson” يدخل يدويًا من الكلاينت بدون ضبط (مخاطر)
* ✅ تحديد شكل “Meaning Block” الذي يخرجه Brain (لتسهيل الاستخراج)
* ✅ إضافة قيود/تحقق (Validation + Zod) + edge-case للحقول

انسخ التالي كنسخة Approved:

---

# Phase 1 — Meaning-First Enforcement (Approved)

## Summary

Phase 1 enforces: **No Meaning, No Content**.
Every new task, goal, idea, and brain message must create a `meaning_object` first, then link to it. Original text becomes **input evidence + fallback only**. ULL projection upgrades from “translate text” to “render meaning”.

**Important:** ULL is a **separate Core System App** inside AI Business OS. No other module implements translation/meaning logic.

---

## What Changes (and What Does NOT)

**Changes:**

* All write paths (tasks, goals, ideas, brain messages) create a `meaning_object` first, then link it
* `ull-translate` edge function upgraded to resolve from `meaning_object_id` (meaning_json) instead of raw text
* `useULL` hook and `ULLText` updated to use `meaning_object_id` as the primary key
* Brain chat produces **structured meaning blocks** alongside natural language
* Brain → Workboard integration creates meaning objects when confirming drafts
* Update paths create meaning objects lazily for legacy records and can also update meaning when content edits occur

**Does NOT change:**

* UI layout/UX (invisible upgrade)
* Existing legacy data behavior (records without `meaning_object_id` continue via fallback)
* Static UI translations (react-i18next stays)

---

## Technical Details

### 1) Shared Meaning Utility (Server-first)

Create: `src/lib/meaningObject.ts`

Provide TWO functions (not create only):

```ts
async function createMeaningObject(params: {
  tenantId: string;          // use tenant/workspace consistently
  createdBy: string;
  type: 'TASK' | 'GOAL' | 'IDEA' | 'BRAIN_MESSAGE';
  sourceLang: string;
  meaningJson: MeaningJsonV1;
  sourceText?: string;       // optional evidence for fallback/debug
}): Promise<string>

async function updateMeaningObject(params: {
  tenantId: string;
  meaningObjectId: string;
  updatedBy: string;
  meaningJson: MeaningJsonV1;
  sourceText?: string;
}): Promise<void>
```

**Rule:** meaning objects are created/updated in one place (this file) to prevent drift.

> Note: if possible, prefer calling these from server actions / edge functions (not directly from client) for security and consistency with RLS.

---

### 1.1 Meaning JSON v1 (Validated)

Define a strict schema (zod) in the same file:

```ts
type MeaningJsonV1 = {
  version: 'v1';
  type: 'TASK' | 'GOAL' | 'IDEA' | 'BRAIN_MESSAGE';
  intent: string;
  subject: string;
  description?: string;
  constraints?: Record<string, unknown>;
  metadata?: {
    created_from?: 'user' | 'brain';
    confidence?: number;
    source?: string;
  };
};
```

Validation:

* `version` required
* `type/intent/subject` required
* `confidence` bounded (0..1)

---

## 2) Write Path Changes (Meaning-first)

### 2.1 `useWorkboardTasks.ts` — `createTask()`

* Create meaning object first (`type=TASK`)
* Insert task with `meaning_object_id`
* Store `source_lang` as already done

### 2.1b `updateTask()`

* If task has no `meaning_object_id`: create meaning object from current text and link
* If task has meaning id: update meaning object (meaning_json) when title/description edits occur

Apply same pattern to:

* Goals create/update
* Ideas create/update
* Brain messages create/update

---

## 3) ULL Projection Upgrade (Meaning-based)

### 3.1 `ULLText` component

Primary prop:

```tsx
<ULLText meaningId="..." fallback="..." />
```

Backward compatible props remain optional for Phase 0:

* table/id/field/text/sourceLang

**Fallback chain:**

1. meaningId render → 2) cache → 3) original text → 4) safe placeholder

### 3.2 `useULL` hook

Add:

* `getTextByMeaning(meaningId, fallback?)`
* Cache key: `meaning_object_id:target_lang`

Keep legacy `getText()` for Phase 0 compatibility.

### 3.3 `ull-translate` edge function

Accept both modes:

**Preferred (Phase 1):**

```json
{ "meaning_object_id": "...", "target_lang": "ar" }
```

Flow:

1. cache lookup by (meaning_object_id + target_lang)
2. fetch meaning_json from meaning_objects (tenant-scoped)
3. project meaning → language via AI
4. cache in content_translations
5. return translated_text

**Legacy (Phase 0 fallback):**

```json
{ "texts": [...], "target_lang": "ar" }
```

---

## 4) Brain Output Contract (Structured Meaning Blocks)

### 4.1 brain-chat edge function

System prompt update (conceptual):

* Respond naturally in `user_lang`
* When proposing tasks/action items/goals, output a **machine-readable Meaning Block** in addition to the natural text.

Define one canonical block format for extraction:

````text
```ULL_MEANING_V1
[
  { "version":"v1","type":"TASK","intent":"...","subject":"...","description":"...","constraints":{...},"metadata":{"created_from":"brain","confidence":0.85} }
]
````

```

Rules:
- The block must be valid JSON
- Must not include language-specific phrasing requirements
- The natural language response remains user-facing; block is for structured extraction

### 4.2 `BrainCommandBar.tsx` — extraction
- First try to parse `ULL_MEANING_V1` JSON blocks
- If found, use these meaning objects directly to create linked tasks/goals
- If not found, fallback to existing regex extraction (temporary)

---

## 5) Lazy Migration for Existing Data (No Bulk Migration)

- No bulk backfill
- On first edit of legacy record:
  - create meaning object from text
  - link record
- On later edits:
  - update meaning object

---

## 6) Security / RLS / Tenant Isolation

- Every meaning_objects and content_translations access is tenant/workspace scoped
- Ensure edge functions enforce:
  - membership
  - tenantId matching
- Meaning blocks from Brain are treated as untrusted input until validated (zod)

---

## 7) Files to Create

| File | Purpose |
|------|---------|
| `src/lib/meaningObject.ts` | create/update meaning objects + validation |

---

## 8) Files to Modify

(قائمة ملفاتك كما هي ✅)  
مع إضافة: ensure update paths handle meaning updates.

---

## 9) Success Criteria

- 100% of new content has `meaning_object_id`
- Editing legacy content creates meaning objects lazily
- ULL resolves projections from meaning objects (default path)
- Brain outputs structured meaning blocks reliably
- Changing user language does not alter stored data
- No UI regression

---

### قرار الأبروف
✅ **Approved for Phase 1** بهذه الصيغة.

---

إذا تبي أعطيك أيضًا **رسالة “Approval” قصيرة** ترسلها له (سطرين)، قلّي.
```
