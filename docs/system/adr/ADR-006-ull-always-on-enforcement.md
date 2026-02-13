# ADR-006 — ULL Always-On Enforcement

**Status:** Accepted  
**Date:** 2026-02-13  
**Deciders:** System Architecture Team  

---

## Context

AiBizos is a multilingual AI Business Operating System designed for cross-language collaboration. The Universal Language Layer (ULL) was introduced to abstract human language from system logic by normalizing all user/AI content into canonical `meaning_objects`.

During development, ULL enforcement was initially advisory — meaning objects were recommended but not strictly required. This led to inconsistencies:

- Some insert paths created content without `meaning_object_id`
- Some UI components rendered raw text instead of ULL projections
- No runtime or database enforcement prevented violations

Without mandatory enforcement, the system could not guarantee semantic consistency across languages, breaking the core value proposition.

---

## Decision

**ULL is declared a permanent, always-on system law.** Enforcement operates at three layers:

### 1. Database Level
- All core content tables (`tasks`, `goals`, `plans`, `ideas`, `brain_messages`, `chat_messages`) require `meaning_object_id NOT NULL` with FK constraints to `meaning_objects`.
- Inserts without `meaning_object_id` are rejected at the database level.

### 2. Runtime Level
- `guardMeaningInsert()` runs with `block: true` by default on all meaning-protected tables.
- Violations throw a hard error, preventing data corruption.
- All insert paths call `createMeaningObject()` before database insertion.

### 3. UI Level
- All user-visible content from meaning-protected tables renders through `<ULLText>` components.
- Static UI labels continue using `react-i18next` (`t()` keys) — ULL applies only to dynamic content.

### 4. CI Level
- `scripts/ull-compliance-check.sh` scans for violations and fails the build on detection.

---

## Alternatives Rejected

### Optional Meaning Objects
- **Rejected because:** Allows inconsistency. Some content would have meaning objects, others wouldn't. Translation pipeline breaks for unprotected content. Cross-language teams see mixed-language data.

### Meaning Objects on Write Only (No Read Enforcement)
- **Rejected because:** Even with meaning objects stored, rendering raw text instead of ULL projections defeats the purpose. Both write and read paths must be enforced.

### Per-Module Opt-In
- **Rejected because:** Creates governance overhead. Every new module must decide whether to use ULL, leading to drift. Mandatory-by-default eliminates this.

---

## Consequences

### Positive
- **Semantic consistency:** All content has a canonical meaning representation, enabling accurate translation across any language pair.
- **Future-proof:** New modules automatically inherit ULL compliance requirements.
- **Audit trail:** Every piece of content links to its semantic source of truth.
- **Cross-language collaboration:** Teams can work in their preferred language with zero manual translation.

### Negative
- **Development overhead:** Every content insert requires creating a meaning object first (2 extra lines of code).
- **Performance cost:** Meaning object creation adds one database write per content creation.
- **Strictness:** Developers cannot quickly prototype without meaning objects — the guard will block inserts.

### Mitigations
- `createMeaningObject()` helper abstracts the complexity to a single function call.
- `guardMeaningInsert()` provides clear error messages pointing to the violation.
- ULL Compliance Certificate documents all patterns for developer reference.

---

## Governance Impact

- ULL Compliance Certificate v1.0 is a permanent architectural record.
- All PRs introducing new content entities must update `MEANING_PROTECTED_TABLES`.
- The ULL manifest (`src/apps/ull/manifest.ts`) declares ULL as `required: true, removable: false`.
- No exemption may be granted without formal amendment to the compliance certificate.

---

*This ADR is final and non-reversible. ULL always-on enforcement is a permanent system law.*
