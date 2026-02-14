# BookEvo Production Release Checklist

## Pre-Launch Verification

### A. Data Integrity
- [x] `booking_bookings.quote_id` has UNIQUE constraint (idempotent booking creation)
- [x] Partial unique index prevents multiple accepted quotes per request (`idx_one_accepted_quote_per_request`)
- [x] Status transition triggers enforce valid state machines:
  - Quote requests: `requested → quoted → accepted/cancelled`
  - Bookings: `confirmed_pending_payment → paid_confirmed/confirmed → completed/cancelled`
- [x] All booking tables have `workspace_id NOT NULL`
- [x] All writes are idempotent (check-before-insert pattern)

### B. Security & Permissions
- [x] RLS enabled on ALL booking tables with workspace-scoped policies
- [x] RBAC helpers: `is_workspace_member`, `is_workspace_admin`, `is_booking_vendor_owner`, `can_manage_booking`
- [x] Storage buckets use path-based RLS (workspace/vendor scoping)
- [x] Edge Functions validate JWT + workspace membership server-side
- [x] No Stripe restricted keys or webhook secrets required for core functionality
- [x] `SECURITY DEFINER` functions use `SET search_path TO 'public'`

### C. Payment Architecture
- [x] `payment_mode` defaults to `OFFLINE_ONLY` — system is 100% functional without Stripe
- [x] `offline_methods`: Cash, Bank Transfer, Card on Delivery
- [x] "Mark as Paid" workflow: updates booking + records payment + audit log + OIL event
- [x] Commission tracking is reporting-only (no automatic collection)
- [x] Stripe Connect/PaymentIntent/Webhook functions return 503 stubs
- [x] No Stripe key prompts anywhere in UI

### D. SaaS Billing
- [x] Plans: FREE / PROFESSIONAL / ENTERPRISE with feature limits
- [x] `billing_subscriptions` table with offline_invoice default
- [x] `billing_invoices` for manual invoice tracking
- [x] All billing tables have proper RLS (admin-only management, member viewing)

### E. Internationalization
- [x] All booking screens use i18n keys (no hardcoded strings)
- [x] EN and AR translations complete for:
  - Booking statuses (including `confirmed_pending_payment`, `refunded`)
  - Payment methods (cash, bank_transfer, card_on_delivery)
  - Billing module keys
  - Mark as Paid flow
- [x] RTL layout support via LanguageProvider

### F. Observability
- [x] ErrorBoundary wraps BookingLayout outlet
- [x] Global ErrorBoundary at App root level
- [x] `auditAndEmit` on all critical flows (accept quote, create booking, mark paid, cancel, complete)
- [x] OIL events emitted for Business Brain analytics
- [x] Non-blocking audit (fire-and-forget, failures logged to console)
- [x] Global mutation error handler surfaces API errors as toasts

### G. Architecture
- [x] Multi-tenant isolation: workspace_id on every table + RLS enforcement
- [x] V2 route isolation strategy (`/b2/`, `/v2/`) for safe iteration
- [x] ULL compliance: meaning_object_id on content tables
- [x] Subscription gate on write operations (`is_booking_subscription_active`)

## Post-Launch Monitoring
- [ ] Monitor `audit_logs` for anomalous patterns
- [ ] Check `org_events` for OIL metric correctness
- [ ] Verify commission ledger accuracy against booking totals
- [ ] Test i18n rendering in AR/EN on all booking pages
- [ ] Validate status transition triggers don't block legitimate workflows

## Future Roadmap (Not in Scope)
- Stripe Subscriptions for SaaS billing (optional, fully gated)
- Frha Operator Mode (Stripe Connect marketplace — separate project)
- Custom domain support for tenants
- E2E automated tests (Playwright)
