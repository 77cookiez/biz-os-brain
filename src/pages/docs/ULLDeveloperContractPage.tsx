import { ArrowLeft, Shield, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

const CONTRACT_MD = `
## What is ULL?

The **Universal Language Layer (ULL)** is a core system app that abstracts human language away from system logic. It treats language as a *projection layer* rather than the source of truth.

The OS never depends on English or any human language as canonical truth. Instead, it normalizes all inputs into a **Canonical Meaning Representation (CMR)** stored in \`meaning_objects\`.

---

## Core Rule: No Meaning, No Content

> **Every piece of user-generated content must have a corresponding \`meaning_object\` before it can be stored.**

This is enforced at runtime by the **Meaning Guard** (\`src/lib/meaningGuard.ts\`). Any insert into a meaning-protected table (\`tasks\`, \`goals\`, \`ideas\`, \`brain_messages\`, \`plans\`) without a \`meaning_object_id\` will trigger a console warning.

---

## Data Model

### \`meaning_objects\` (canonical truth)

| Column | Description |
|--------|-------------|
| \`id\` | UUID primary key |
| \`workspace_id\` | Tenant isolation |
| \`created_by\` | User who created it |
| \`type\` | \`task\`, \`goal\`, \`idea\`, \`brain_message\`, \`plan\`, \`generic\` |
| \`source_lang\` | Language the meaning was originally expressed in |
| \`meaning_json\` | Structured canonical representation (MeaningJsonV1) |

### Domain tables reference meaning

All content tables (\`tasks\`, \`goals\`, \`ideas\`, \`plans\`, \`brain_messages\`) have:

- \`meaning_object_id\` → FK to \`meaning_objects.id\`
- \`source_lang\` → Original language of the content

### \`content_translations\` (projection cache)

| Column | Description |
|--------|-------------|
| \`meaning_object_id\` | FK to meaning_objects |
| \`target_lang\` | The projected language code |
| \`field\` | Which field (\`content\`, \`title\`, \`description\`) |
| \`translated_text\` | The cached projection |

Unique constraint: \`(meaning_object_id, target_lang, field)\`

---

## MeaningJsonV1 Schema

\`\`\`json
{
  "version": "v1",
  "type": "TASK | GOAL | IDEA | BRAIN_MESSAGE | PLAN",
  "intent": "create | plan | discuss",
  "subject": "The main topic (required)",
  "description": "Optional longer description",
  "constraints": {},
  "metadata": {
    "created_from": "user | brain",
    "confidence": 0.95,
    "source": "optional source identifier"
  }
}
\`\`\`

---

## Rendering in UI

### ULLText Component

\`\`\`tsx
import { ULLText } from '@/components/ull/ULLText';

// Render with meaning-based translation
<ULLText meaningId={task.meaning_object_id} fallback={task.title} />

// With custom field
<ULLText meaningId={goal.meaning_object_id} field="description" fallback={goal.description} />
\`\`\`

### useULL Hook

\`\`\`tsx
import { useULL } from '@/hooks/useULL';

const { getTextByMeaning } = useULL();

// Get translated text for a meaning object
const text = getTextByMeaning(meaningId, 'title', fallbackText);
\`\`\`

---

## Translation API

### Edge Function: \`ull-translate\`

Accepts \`meaning_object_ids\` and a \`target_lang\`, returns projected text.

\`\`\`json
POST /functions/v1/ull-translate
{
  "meaning_object_ids": ["uuid-1", "uuid-2"],
  "target_lang": "ar",
  "fields": ["content", "title"]
}
\`\`\`

**Provider**: Lovable AI Gateway (gemini-2.5-flash-lite)

Translations are cached in \`content_translations\`. Subsequent requests for the same meaning+lang+field return cached results.

---

## Brain Contract: ULL_MEANING_V1

The AI Brain outputs structured meaning blocks that the OS parses:

\`\`\`
\\\`\\\`\\\`ULL_MEANING_V1
{
  "version": "v1",
  "type": "TASK",
  "intent": "create",
  "subject": "Review Q1 marketing budget",
  "description": "Analyze current spend vs plan",
  "metadata": { "created_from": "brain", "confidence": 0.92 }
}
\\\`\\\`\\\`
\`\`\`

The \`BrainCommandBar\` extracts these blocks, creates \`meaning_objects\`, then creates domain records linked to them.

---

## Security

- All \`meaning_objects\` are scoped to a workspace via \`workspace_id\`
- RLS policies ensure users can only access meanings within their workspace
- \`content_translations\` inherit access through the meaning object's workspace

---

## Do / Don't

### ✅ DO

- **Always** create a \`meaning_object\` before inserting content
- Use \`buildMeaningFromText()\` for user-created content
- Use \`<ULLText meaningId={...} />\` for rendering
- Reference \`meaning_object_id\` in all content tables
- Let ULL handle all translation — never translate independently

### ❌ DON'T

- Store final-language text as the source of truth
- Call translation APIs directly from app code
- Skip the meaning guard (\`guardMeaningInsert\`)
- Duplicate translation logic in any app module
- Hardcode language strings for dynamic user content

---

## Architecture Diagram

\`\`\`
User Input (any language)
    ↓
meaning_objects (canonical truth)
    ↓
content_translations (projection cache)
    ↓
ULLText / useULL (renders in user's locale)
\`\`\`

---

## Files Reference

| File | Purpose |
|------|---------|
| \`src/lib/meaningObject.ts\` | Create/update meaning objects + Zod schema |
| \`src/lib/meaningGuard.ts\` | Runtime guard for meaning-first enforcement |
| \`src/hooks/useULL.ts\` | Hook for meaning-based text retrieval |
| \`src/components/ull/ULLText.tsx\` | Declarative meaning-text component |
| \`supabase/functions/ull-translate\` | Edge function for AI translation |
| \`src/apps/ull/manifest.ts\` | App manifest |
| \`src/lib/systemApps.ts\` | System app registry |
`;

export default function ULLDeveloperContractPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Universal Language Layer (ULL)</h1>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              <Shield className="h-3 w-3 mr-1" />
              System
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            Developer Contract &amp; Integration Guide
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 md:p-8">
        <div className="prose prose-sm max-w-none text-foreground
          prose-headings:text-foreground prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
          prose-h3:text-base prose-h3:mt-6
          prose-p:text-muted-foreground prose-p:leading-relaxed
          prose-strong:text-foreground
          prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
          prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
          prose-table:text-sm
          prose-th:text-foreground prose-th:border-border prose-th:bg-muted/50
          prose-td:text-muted-foreground prose-td:border-border
          prose-li:text-muted-foreground
          prose-blockquote:border-primary prose-blockquote:text-foreground prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4
          prose-hr:border-border
        ">
          <ReactMarkdown>{CONTRACT_MD}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
