

تمام، قرأت الخطة كاملة سطرًا سطرًا.
الآن أعطيك نسخة معدّلة جاهزة للأبروف، بنفس الأسلوب، لكن مصَحَّحة 100% حسب ما اتفقنا:

✅ ULL = App نظامي منفصل (Core System App)

✅ Meaning-first (Canonical Meaning هو الحقيقة)

✅ الترجمة Projection وليست المصدر

✅ لا نكسر الواقع الحالي (انتقال تدريجي ذكي)

✅ واضحة ومقنعة تقنيًا بحيث يقدر يشتغل عليها فورًا

انسخ ما يلي كاملًا واعتبره النسخة المعتمدة.

Universal Language Layer (ULL) – Implementation Plan (Approved Version)
Overview

The Universal Language Layer (ULL) is a core system app inside AI Business OS.
It upgrades the platform from a text-first, translated UI system into a meaning-first operating environment, where:

Meaning is the source of truth

Language is a projection layer

Translation is a rendering concern, not a data model

ULL is not an OS, and not a feature.
It is a foundational system app that all other apps (Tasks, Goals, Brain, Chat, etc.) depend on for language handling.

Conceptual Model

Canonical Meaning is stored once and treated as truth

Human language (any language, including English) is:

Input evidence

Output projection

Different users may see the same meaning in different languages simultaneously

Current State Analysis

The system currently has:

react-i18next for static UI translations (EN, AR, FR)

LanguageContext for per-user language preference with RTL support

profiles.preferred_locale column

workspace.default_locale

Brain Chat edge function hardcoded to English output

~30+ hardcoded English strings across UI components

User-generated content stored as raw text, with no abstraction between language and meaning

This state is functional but text-centric, not language-agnostic.

Target Architecture (ULL as a System App)
+-----------------------------------------------------+
|                    User Interface                    |
|  (renders language via ULL projection, never truth)  |
+-----------------------------------------------------+
        | input (any language) | output (user language)
        v                      ^
+-----------------------------------------------------+
|        Universal Language Layer (System App)         |
|  - Meaning normalization                            |
|  - Projection & translation                          |
|  - Caching                                          |
|  - Language policies                                |
+-----------------------------------------------------+
        | canonical meaning     | render request
        v                      ^
+-----------------------------------------------------+
|              ull-translate Edge Function             |
|  - Meaning → language projection                    |
|  - AI-assisted translation                          |
|  - Cache management                                 |
+-----------------------------------------------------+
        |
        v
+-----------------------------------------------------+
|                   Database Layer                     |
|  - meaning_objects  (source of truth)               |
|  - content_translations (projection cache)          |
|  - domain tables reference meaning IDs              |
+-----------------------------------------------------+

Core Design Principles

Meaning is the source of truth

Original text is input evidence, not truth

Language is per-user and per-view

All translation is centralized in ULL

ULL exists as a standalone system app

Data Model
1. Canonical Meaning Layer (NEW)

Create a new table:

meaning_objects

id (UUID, PK)

tenant_id

type (task | goal | idea | brain_message | note | generic)

meaning_json (JSONB) ← canonical representation

created_by

created_at

This table is the only semantic source of truth.

2. Translation Projection Cache (EXISTING, ADJUSTED)

content_translations

id (UUID, PK)

meaning_object_id (UUID)

target_lang

translated_text

created_at

Unique constraint: (meaning_object_id, target_lang)

3. Domain Tables (Incremental Migration)

Existing tables (tasks, goals, ideas, brain_messages, plans):

Keep existing text columns temporarily

Add:

meaning_object_id (UUID, nullable initially)

source_lang (VARCHAR(5))

Over time:

New records MUST reference meaning_object_id

Raw text becomes legacy / fallback only

Implementation Phases
Phase 0: Transitional Compatibility (Non-breaking)

Purpose: introduce ULL without breaking existing data.

Keep existing text fields

Detect source_lang

Use translation cache for cross-language views

Treat existing text as input evidence

This phase matches much of the current proposal, but is explicitly transitional.

Phase 1: Meaning Layer Introduction (Core)
1.1 Meaning Creation

On content creation:

Normalize user input into a meaning_object

Store structured intent in meaning_json

Link domain record to meaning_object_id

1.2 ull-translate Edge Function

Accepts:

{
  meaning_object_id,
  target_lang
}


Renders text from canonical meaning

Uses AI (gemini-2.5-flash-lite) as projection engine

Stores result in content_translations

System prompt:

“Render the following canonical business meaning into {{target_lang}}, preserving intent and terminology.”

Phase 2: Client-Side Projection
useULL() Hook
const { renderMeaning, renderBatch } = useULL();


Resolves language from user profile

Fetches rendered projection

Falls back gracefully if needed

<ULLText /> Component
<ULLText meaningId={task.meaning_object_id} fallback={task.title} />


No loaders

No translation UI

Invisible behavior

Phase 3: App Integration

Tasks, Goals, Ideas, Brain Messages:

Write → meaning first

Read → ULL projection

Remove remaining hardcoded strings → i18n keys

UI language remains react-i18next (unchanged)

Phase 4: AI Brain Integration
Brain Input

Accepts user input in any language

Normalizes into meaning objects

Reasoning occurs on meaning, not strings

Brain Output

Brain outputs canonical meaning

Rendering delegated to ULL

English allowed only as internal bootstrap, never as truth

Key Decisions (Final)

ULL is a standalone system app

Meaning objects are mandatory

Translation is projection, not storage

Lazy rendering with cache

Graceful fallback

No app owns language

Approval Status

✅ Architecturally aligned with AI Business OS
✅ Non-breaking, incremental rollout
✅ Scales to chat, voice, agents, documents
✅ Approved for implementation

