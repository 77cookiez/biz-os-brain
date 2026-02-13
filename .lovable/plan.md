# Booking OS Module — Implementation Plan

## Overview

A new installable module "Booking OS" for the AI Business OS, implementing an AI-powered booking marketplace/engine targeting GCC markets. The module will be fully compliant with ULL (Meaning-First), OIL (event emission), Brain policy (think-only), RBAC+RLS, and all canonical system contracts.

Due to the massive scope, implementation is divided into 5 sequential phases. Each phase produces a working, testable increment.

---

## Phase 1: Foundation (Database + App Registry + Core Routes)

### 1A. App Manifest + Registry Entry

Create `src/apps/booking/manifest.ts` following the existing Leadership/OIL pattern:

```text
id: 'booking'
name: 'Booking OS'
pricing: 'subscription'
capabilities: ['booking_marketplace', 'vendor_management', 'quote_system', 'booking_calendar', 'contextual_chat']
```

Insert into `app_registry` table so it appears in Marketplace.

### 1B. Database Migration (Single large migration)

**New tables (all with workspace_id, created_at, updated_at, RLS):**


| Table                        | Purpose                                                                                      | meaning_object_id               |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------- |
| `booking_settings`           | Workspace config (currency, commission, deposit, policies, theme, slug, ai_assistant toggle) | No (config data)                |
| `booking_subscriptions`      | Subscription status per workspace (status, expires_at, grace_period_days)                    | No (billing data)               |
| `booking_vendors`            | Vendor entities (status: pending/approved/suspended, owner_user_id)                          | No (structural)                 |
| `booking_vendor_profiles`    | Public vendor text (display_name, bio, whatsapp, email)                                      | YES - NOT NULL                  |
| `booking_services`           | Packages/services (price_type, price_amount, currency)                                       | YES - NOT NULL                  |
| `booking_service_addons`     | Optional add-ons per service                                                                 | YES - NOT NULL                  |
| `booking_availability_rules` | Weekly availability JSON per vendor                                                          | No (structural)                 |
| `booking_blackout_dates`     | Blackout dates per vendor                                                                    | No (structural)                 |
| `booking_quote_requests`     | RFQ from customer (event details, guest count, date)                                         | YES - NOT NULL (customer notes) |
| `booking_quotes`             | Vendor quote response (amount, expiry, notes)                                                | YES - NOT NULL (vendor notes)   |
| `booking_bookings`           | Confirmed bookings (status pipeline)                                                         | No (status machine)             |
| `booking_payments`           | Payment records (provider, reference, amount, currency, status)                              | No (financial)                  |


**Reused existing tables:**

- `chat_threads` + `chat_messages` — extend `chat_threads.type` to include `'booking_quote'` and `'booking_vendor'`
- `notifications` — use existing, with new type keys
- `org_events` — use existing, emit booking events
- `meaning_objects` — use existing for all meaning-protected content
- `audit_logs` — use existing for admin actions

**Security DEFINER helpers:**

```text
is_booking_vendor_owner(user_id, vendor_id) -> boolean
is_booking_subscription_active(workspace_id) -> boolean
get_booking_workspace(entity_table, entity_id) -> uuid
```

**RLS policies pattern:**

- All tables: workspace membership check via `is_workspace_member()`
- Vendor-owned data: additional `is_booking_vendor_owner()` check
- Subscription gating: `is_booking_subscription_active()` for write operations
- Public browse (services/vendors): read-only for authenticated users in workspace
- Quote requests: customer can view own, vendor can view assigned, admin can view all

**Booking status enum:**

```text
CREATE TYPE booking_status AS ENUM (
  'requested', 'quoted', 'accepted', 'paid_confirmed', 'completed', 'cancelled'
);
```

### 1C. Update meaningGuard.ts

Add new meaning-protected tables to `MEANING_PROTECTED_TABLES`:

```text
'booking_vendor_profiles', 'booking_services', 'booking_service_addons',
'booking_quote_requests', 'booking_quotes'
```

### 1D. Frontend Route Structure

Add routes inside the `ProtectedRoute > OSLayout` block in `App.tsx`:

**Admin routes (inside OS, gated by AppInstalledGate):**

```text
/apps/booking          -> BookingDashboard (layout with tabs)
/apps/booking/vendors  -> VendorsPage
/apps/booking/services -> ServicesPage
/apps/booking/calendar -> CalendarPage
/apps/booking/quotes   -> QuotesPage
/apps/booking/bookings -> BookingsPage
/apps/booking/settings -> BookingSettingsPage (wizard + config)
```

**Public tenant routes (outside ProtectedRoute, minimal auth):**

```text
/b/:tenantSlug         -> PublicBrowsePage
/b/:tenantSlug/v/:id   -> PublicVendorPage
/b/:tenantSlug/request -> RequestQuotePage
/b/:tenantSlug/my      -> CustomerBookingsPage
```

**Vendor portal routes:**

```text
/v/:tenantSlug              -> VendorDashboardPage
/v/:tenantSlug/calendar     -> VendorCalendarPage
/v/:tenantSlug/quotes       -> VendorQuotesPage
```

### 1E. i18n Keys

Add `booking` namespace to all 5 translation files (en, ar, fr, es, de) with at minimum en + ar for MVP.

---

## Phase 2: Admin Back Office + Setup Wizard

### 2A. Setup Wizard (5 steps)

`src/pages/apps/booking/BookingSetupWizard.tsx`


| Step        | Content                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| 1. Theme    | Choose: Marketplace / Rentals / Event Services / Generic                                                     |
| 2. Brand    | Logo upload (reuse company-assets bucket), primary/accent colors, tone (AR/EN)                               |
| 3. Money    | Currency picker (AED/SAR/QAR/KWD/BHD/OMR), commission vs subscription, deposit on/off, connect payment later |
| 4. Policies | Cancellation preset: flexible/standard/strict                                                                |
| 5. Go Live  | Tenant slug, public link, vendor invite link, QR code, distribution explanation (PWA default)                |


All generated text (landing copy, FAQ, policies) creates meaning objects first.

### 2B. Admin Dashboard

`src/pages/apps/booking/BookingDashboard.tsx` — layout with tab navigation (same pattern as WorkboardLayout):

- **Overview tab**: Counts (vendors, services, quotes, bookings), revenue totals
- **Vendors tab**: Table with status chips, approve/suspend actions
- **Quotes tab**: Filterable list (status, date range, vendor)
- **Bookings tab**: Filterable list (status, date range)
- **Settings tab**: Edit wizard settings, subscription status

### 2C. Vendor Management

- Approve/suspend vendors (admin action -> audit log + OIL event)
- Vendor invite link generation (token-based, stored in `booking_settings`)

### 2D. Subscription Enforcement

`src/hooks/useBookingSubscription.ts`:

- Reads `booking_subscriptions` for current workspace
- Returns `{ isActive, isGracePeriod, isSuspended, daysRemaining }`
- Used by all booking components to gate actions

Server-side: RLS policies on write operations check `is_booking_subscription_active()`.

UI: Banner component `<SubscriptionBanner />` shown when expired/grace period.

---

## Phase 3: Core Booking Flow (Services + RFQ + Quotes + Bookings)

### 3A. Services/Packages CRUD

`src/hooks/useBookingServices.ts`:

- Create service: `createMeaningObject()` -> `guardMeaningInsert()` -> insert
- Render via `<ULLText meaningId={service.meaning_object_id} fallback={service.name} />`
- Price model: fixed / hourly / custom_quote
- Add-ons: same ULL pattern

### 3B. Availability Calendar

`src/hooks/useBookingAvailability.ts`:

- Weekly rules stored as JSON: `{ mon: [{start: "09:00", end: "17:00"}], ... }`
- Blackout dates: simple date list
- Calendar UI: week view with availability blocks

### 3C. RFQ -> Quote -> Booking Pipeline

**Quote Request (Customer):**

- Select service + event details (date, guests, notes)
- Customer notes -> meaning object
- Status: `requested`
- Notification to vendor: `new_quote_request`
- OIL event: `booking.quote_requested`

**Quote Response (Vendor):**

- Amount + expiry (24/48/72h preset)
- Vendor notes -> meaning object
- Status: `quoted`
- Notification to customer: `quote_sent`
- OIL event: `booking.quote_sent`

**Quote Accept (Customer):**

- Status: `accepted`
- Notification to vendor: `quote_accepted`
- OIL event: `booking.quote_accepted`

**Payment Confirmation:**

- Manual/payment link mode
- Record payment in `booking_payments`
- Status: `paid_confirmed`
- Create `booking_bookings` record
- Notification: `payment_confirmed`
- OIL events: `booking.payment_captured`, `booking.booking_confirmed`

**Cancel:**

- Either party or admin
- Status: `cancelled`
- Notification: `booking_cancelled`
- OIL event: `booking.booking_cancelled`

### 3D. Notifications Integration

Use existing `notifications` table with i18n template keys:

```text
type: 'booking.new_quote_request'
title: 'booking.notifications.newQuoteRequest'
data_json: { vendor_name, service_name, customer_name }
```

Rendered in NotificationBell via `t('booking.notifications.newQuoteRequest', data_json)`.

### 3E. OIL Event Emission

Use existing `useOIL().emitEvent()` hook in all booking operations:

```text
emitEvent({
  event_type: 'booking.quote_requested',
  object_type: 'booking_quote_request',
  meaning_object_id: quoteRequest.meaning_object_id,
  metadata: { service_id, vendor_id }
})
```

---

## Phase 4: Contextual Chat + Public Tenant App + Vendor Portal

### 4A. Contextual Chat

Extend existing chat system:

- Create chat threads with `type: 'booking_quote'` linked to quote requests
- Auto-create thread when quote request is made
- Participants: customer + vendor (+ admin can join)
- Store `quote_request_id` in thread metadata or a linking column
- Reuse `ChatPage` components, `useChatMessages`, `MessageView`, etc.
- All messages go through meaning objects (existing pattern)

### 4B. Public Tenant App (`/b/:tenantSlug`)

Minimal public-facing pages:

- **Browse**: List vendors + services with ULLText rendering
- **Vendor detail**: Profile + services + availability
- **Request Quote**: Form (requires auth — show login/register if not authenticated)
- **My Bookings**: Customer's own bookings + chat

PWA manifest generation from booking_settings (theme colors, logo, name).

GCC-specific:

- RTL-safe layouts using existing `dir` attribute pattern
- Currency display with proper formatting
- WhatsApp contact links

### 4C. Vendor Portal (`/v/:tenantSlug`)

Vendor-facing pages:

- **Dashboard**: Pending quotes, upcoming bookings, stats
- **Calendar**: Availability management + blackout dates
- **Quotes**: Respond to quote requests
- **Chat**: Contextual conversations per booking

### 4D. Mobile Responsiveness

- Tables: card-based layout on mobile (no horizontal scroll)
- Chat: full-screen sheet pattern on mobile (existing pattern)
- Forms: single-column stacked layout
- Navigation: bottom tab bar for public/vendor apps on mobile

---

## Phase 5: AI Features + Theme Engine + Polish

### 5A. AI Setup Wizard Assistance

Edge function `booking-ai-assist`:

- Generate landing page copy -> meaning objects
- Generate FAQ -> meaning objects
- Suggest brand colors from logo
- Follow Ask -> Plan -> Preview -> Confirm -> Execute

### 5B. AI Booking Assistant (Optional Toggle)

Setting: `ai_booking_assistant_enabled` in `booking_settings` (default: OFF)

When enabled in public app:

- Text input + microphone icon (reuse existing voice input hook)
- AI searches services within the tenant workspace only
- Returns 2-5 matching options
- Can prepare DRAFT RFQ (user must confirm)
- Uses `brain-chat` edge function with booking context

### 5C. Theme Engine + Brand Asset Pack

- PWA manifest generator (icons, colors, name from settings)
- Social preview meta tags for public pages
- Basic brand kit ZIP export (logos at various sizes)
- Distribution docs page:
  - PWA (default)
  - Container App instructions
  - Enterprise handover pack concept

### 5D. Demo Seed Data

Edge function or migration to seed a demo tenant:

- 3 vendors with profiles (meaning objects)
- 3 services per vendor (meaning objects)
- Availability rules
- Sample RFQ -> quote -> booking flow

### 5E. In-App Docs Page

`/apps/booking/docs` with 3 sections:

- How shipping works (PWA default, container app, enterprise)
- Subscription enforcement (grace period, read-only)
- Privacy promise (no end-user upsell)

---

## Technical Details

### File Structure

```text
src/apps/booking/
  manifest.ts
src/pages/apps/booking/
  BookingLayout.tsx
  BookingDashboard.tsx
  BookingVendorsPage.tsx
  BookingServicesPage.tsx
  BookingQuotesPage.tsx
  BookingBookingsPage.tsx
  BookingSettingsPage.tsx
  BookingSetupWizard.tsx
  BookingDocsPage.tsx
src/pages/booking/public/
  PublicBrowsePage.tsx
  PublicVendorPage.tsx
  RequestQuotePage.tsx
  CustomerBookingsPage.tsx
src/pages/booking/vendor/
  VendorDashboardPage.tsx
  VendorCalendarPage.tsx
  VendorQuotesPage.tsx
src/hooks/
  useBookingSettings.ts
  useBookingSubscription.ts
  useBookingVendors.ts
  useBookingServices.ts
  useBookingAvailability.ts
  useBookingQuotes.ts
  useBookingBookings.ts
  useBookingPayments.ts
src/components/booking/
  SubscriptionBanner.tsx
  BookingChat.tsx
  ServiceCard.tsx
  VendorCard.tsx
  QuoteCard.tsx
  BookingStatusBadge.tsx
  AvailabilityCalendar.tsx
  AIAssistantBar.tsx
supabase/functions/
  booking-ai-assist/index.ts
```

### Migration Highlights

- ~12 new tables with full RLS
- 3 new SECURITY DEFINER helper functions
- 1 new enum type (`booking_status`)
- Realtime enabled for `booking_quotes`, `booking_bookings`
- Updated `meaningGuard.ts` with 5 new protected tables

### Compliance Checklist


| Requirement         | Approach                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| ULL Meaning-First   | All user-facing text in services, profiles, quotes, chat -> meaning_object_id NOT NULL |
| OIL Events          | ~10 event types emitted via useOIL().emitEvent()                                       |
| OIL Settings        | Read-only via useOILSettings(), no duplication                                         |
| Brain Policy        | AI generates drafts only, user confirms                                                |
| RBAC + RLS          | workspace_member + vendor_owner + subscription checks                                  |
| Audit Logging       | Admin actions (approve/suspend/cancel) logged                                          |
| Mobile-First        | Card layouts, sheet patterns, responsive tables                                        |
| RTL Safe            | Existing dir attribute, logical properties                                             |
| GCC Currencies      | AED/SAR/QAR/KWD/BHD/OMR selectable                                                     |
| Subscription Gating | Server (RLS) + Client (hook + banner)                                                  |
| Notifications       | Existing table, i18n template keys                                                     |
| Chat                | Existing chat_threads/messages extended                                                |


### Implementation Priority

Phase 1 and 2 will be implemented first as they establish the foundation. Phase 3 delivers the core value. Phase 4 adds the public-facing experience. Phase 5 adds AI polish and can be partially deferred post-MVP.

Estimated new files: ~35 components/pages + ~10 hooks + 1 large migration + 1 edge function + manifest.

capabilities: [

  'booking.marketplace',

  'booking.vendor_portal',

  'booking.rfq',

  '[booking.chat](http://booking.chat)',

  '[booking.ai](http://booking.ai)_assistant',

  'booking.subscription_gated'

]

requested → quoted

quoted → accepted

accepted → paid_confirmed

paid_confirmed → completed

ANY → cancelled

&nbsp;