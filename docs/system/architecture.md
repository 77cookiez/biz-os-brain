# AiBizos — Master Architecture Document

**Version:** 0.5.1 — ULL Certification Lock  
**Date:** 2026-02-13  
**Status:** Active  

---

## 1. System Overview

AiBizos is an AI-powered Business Operating System that provides strategic planning, task management, team collaboration, and organizational intelligence — all through a meaning-first, multilingual architecture.

---

## 2. Core System Layers

### 2.1 Authentication & Workspace Layer
- Multi-tenant workspace isolation via `workspace_id`
- Company → Workspace → Member hierarchy
- RLS enforcement on all tables via `is_workspace_member()`

### 2.2 Universal Language Layer (ULL)

ULL is the foundational language abstraction that separates human language from system logic.

**Principle:** *No Meaning, No Content.*

All user-generated and AI-generated content is normalized into canonical `meaning_objects` before storage. Human language is treated as a projection layer — rendered on-demand in the user's preferred locale via the `<ULLText>` component and `ull-translate` edge function.

**Architecture:**
```
User Input → meaning_objects (semantic truth) → ULL projection → User's language
```

**Key Components:**
- `meaning_objects` table — canonical semantic store
- `content_translations` table — projection cache (7-day TTL)
- `createMeaningObject()` — meaning creation helper
- `guardMeaningInsert()` — runtime enforcement (block mode)
- `<ULLText>` — UI rendering component
- `useULL` hook — translation state management
- `ull-translate` edge function — AI translation via Gemini 2.5 Flash
- IndexedDB client cache — workspace-scoped, 7-day TTL

**Protected Tables:** `tasks`, `goals`, `plans`, `ideas`, `brain_messages`, `chat_messages`

**Exempt Tables:** `notifications` (i18n templates), `org_events` (telemetry), `audit_logs` (internal), `company_memory` (AI-internal)

#### ULL Enforcement Certification (v1.0)

**Certified:** 2026-02-13  
**Status:** ✅ FULLY ULL-COMPLIANT

Enforcement operates at four layers:

| Layer | Mechanism | Status |
|---|---|---|
| Database | `meaning_object_id NOT NULL` + FK constraints | ✅ Enforced |
| Runtime | `guardMeaningInsert({ block: true })` on all insert paths | ✅ Enforced |
| UI | All content rendered via `<ULLText>` | ✅ Enforced |
| CI | `scripts/ull-compliance-check.sh` regression prevention | ✅ Active |

Full certificate: [`docs/system/ull-compliance.md`](./ull-compliance.md)  
ADR: [`ADR-006 — ULL Always-On Enforcement`](./adr/ADR-006-ull-always-on-enforcement.md)

### 2.3 Brain Layer (AI Assistant)
- Conversational AI interface with workspace context
- Follows Ask → Plan → Preview → Confirm → Execute protocol
- Never auto-executes — all actions require user confirmation
- Meaning objects created for all brain messages

### 2.4 Organizational Intelligence Layer (OIL)
- Workspace health indicators (execution, alignment, momentum, risk)
- Server-side computation via `oil-compute` edge function
- Leadership guidance via Aurelius — Executive Intelligence module
- Insights rendered with native AI translation (ephemeral content exception)

### 2.5 Workboard Layer
- Task, goal, plan, and idea management
- All content entities enforce `meaning_object_id NOT NULL`
- ULLText rendering on all content-facing pages

### 2.6 Chat Layer
- Multilingual team messaging
- Messages stored as meaning objects (not raw text)
- Thread-member-only access via RLS
- Real-time subscriptions via Supabase Realtime

### 2.7 Enterprise Layer
- Multi-workspace risk aggregation
- Company-level risk scoring and forecasting
- Workspace drilldown dashboards

---

## 3. App Architecture

### 3.1 System Apps (Non-Removable)
- **ULL** — Universal Language Layer (always on, hidden)
- **Brain** — AI Assistant
- **Workboard** — Task & Goal Management
- **Chat** — Team Messaging

### 3.2 Installable Apps
- **OIL** — Organizational Intelligence Layer
- **Aurelius** — Executive Intelligence (formerly Leadership Augmentation)

### 3.3 App Registry
Apps are registered in `app_registry` and installed per-workspace via `workspace_apps`. The `AppInstalledGate` component controls access to installable app pages.

---

## 4. Security Architecture

### 4.1 Authentication
- Email/password authentication via Supabase Auth
- Profile creation on signup with preferred locale

### 4.2 Authorization
- Row-Level Security (RLS) on all tables
- `is_workspace_member()` for workspace-scoped access
- `has_company_role()` for admin/owner operations
- Thread-member-only access for chat messages

### 4.3 Data Isolation
- All content tables scoped by `workspace_id`
- Cross-workspace data access prevented at database level

---

## 5. Non-Negotiable Principles

1. **No Meaning, No Content** — All content must have `meaning_object_id`
2. **Language as Projection** — UI labels use i18n; content uses ULL
3. **ULL is Always On** — Core system app, non-removable, mandatory
4. **Assistive AI** — Brain never auto-executes; user confirms all actions
5. **Security First** — RLS enforces workspace boundaries everywhere

---

## 6. Change Log

| Version | Date | Type | Summary |
|---|---|---|---|
| 0.1.0 | 2026-02-08 | Major | Initial architecture: Brain, Workboard, Auth |
| 0.2.0 | 2026-02-09 | Major | Added OIL, Chat, Meaning v1 |
| 0.3.0 | 2026-02-10 | Major | Added ULL, Meaning v2, content translations |
| 0.4.0 | 2026-02-11 | Major | Chat hardening, i18n audit, Decision Intelligence |
| 0.5.0 | 2026-02-12 | Major | Enterprise layer, risk dashboards, Aurelius rename |
| 0.5.1 | 2026-02-13 | Minor | **ULL Compliance Certified and Locked** — DB + runtime + UI + CI enforcement finalized. ADR-006 published. Compliance certificate v1.0 issued. |

---

## 7. Architecture Decision Records

| ADR | Title | Status |
|---|---|---|
| ADR-001 | Meaning-First Content Architecture | Accepted |
| ADR-002 | ULL as Core System App | Accepted |
| ADR-003 | Assistive AI Protocol | Accepted |
| ADR-004 | Multi-Tenant Workspace Isolation | Accepted |
| ADR-005 | Native Translation Exception for Ephemeral AI Content | Accepted |
| ADR-006 | ULL Always-On Enforcement | Accepted |

---

*This document is the canonical architecture reference for AiBizos. All development must conform to these principles and patterns.*
