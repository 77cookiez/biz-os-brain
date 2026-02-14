# Release Notes — Phase 9 + 9.5: AI Business Brain (Safe Draft Mode)

## What's New

1. **Brain Draft Panel** — AI-powered business recommendations appear on the Bookivo Dashboard. Drafts are deterministic (no LLM), covering 10 scenarios: conversion, services, vendors, billing, pricing, team, CX, audits, and strategic growth.

2. **"Ask Brain" Command Integration** — Each draft has an "Ask Brain" button that pre-fills a structured prompt into the Brain Console (`/brain`). Prompts include context (utilization %, projections, reasons) in EN or AR. No auto-execution.

3. **10 Smart Command Templates** — Rich, structured prompts with Context → Task → Output format, bilingual (EN/AR).

4. **Growth Analytics Events** — `BRAIN_DRAFT_VIEW`, `BRAIN_DRAFT_ACTION_CLICK`, `BRAIN_DRAFT_TO_COMMAND` logged via `log_growth_event` RPC (allowlist enforced).

5. **Anti-spam** — Draft view logged once per UTC day per workspace (localStorage dedup).

## Security Audit Results

- ✅ **0 function overloads** in public schema
- ✅ **anon_can_execute = false** for all SECURITY DEFINER functions except justified exceptions (RLS helpers: `is_workspace_member`, `has_company_role`, `is_booking_vendor_owner`, `is_chat_thread_member`, `get_workspace_company`, `get_thread_workspace`, `is_workspace_admin`, `is_company_member`, `is_booking_subscription_active`; public resolver: `get_live_booking_tenant_by_slug`)
- ✅ **RLS enabled** on all public tables (0 tables without RLS)
- ✅ All triggers operational: `trg_enforce_vendor_limit`, `trg_enforce_booking_limit`, `trg_enforce_services_limit`, `trg_enforce_quotes_limit`, status transition validators
- ✅ Linter: 1 advisory (leaked password protection — configuration-level, not code)

## Breaking Changes

- **None.** All changes are additive. No schema changes to existing tables. No new tables created.

## What Changed

- New files: `src/lib/brainDrafts.ts`, `src/lib/brainDraftToCommand.ts`, `src/components/booking/BrainDraftPanel.tsx`
- Updated: `BookingDashboard.tsx` (wiring), `en.json` / `ar.json` (i18n keys)
- DB: `log_growth_event` allowlist extended with 3 new event types
