

# Phase 4 Hardening: Dynamic Branding, SEO, Public RLS & Gap Fixes

## Summary

After a thorough audit of the entire Booking OS (public pages, vendor portal, chat, notifications, hooks, and database policies), I found **7 critical gaps** that need to be addressed to make this production-ready.

---

## Identified Gaps

| # | Gap | Severity |
|---|-----|----------|
| 1 | **No anonymous RLS policies** -- public pages `/b/:tenantSlug` will fail for unauthenticated visitors | Critical |
| 2 | **No dynamic tenant branding** -- public pages use OS default theme, not tenant's `primary_color`/`accent_color`/`logo_url` | High |
| 3 | **No SEO meta tags** -- no `document.title` or OG tags for public pages; all show "Lovable App" | High |
| 4 | **No GCC currency formatter** -- prices show raw `AED 500` instead of properly formatted currency | Medium |
| 5 | **WhatsApp link missing in vendor detail** -- data is fetched but never rendered on `PublicVendorDetailPage` | Medium |
| 6 | **Notification deep-links missing for booking types** -- clicking booking notifications does nothing | Medium |
| 7 | **No mobile bottom navigation** on public pages -- header nav hides labels on mobile, no bottom bar | Medium |

---

## Implementation Plan

### 1. Database Migration: Anonymous RLS Policies

Create `SELECT` policies for `anon` and `authenticated` roles on 6 tables, scoped to live tenants only:

- `booking_settings` -- WHERE `is_live = true` (by `tenant_slug`)
- `booking_vendors` -- WHERE `status = 'approved'` and workspace has live booking_settings
- `booking_vendor_profiles` -- linked via vendor
- `booking_services` -- WHERE `is_active = true`
- `meaning_objects` -- for ULLText rendering on public pages
- `content_translations` -- for ULL cache on public pages
- `workspaces` -- SELECT `id, name` only (for tenant header display)

All policies will restrict to read-only access and only expose data belonging to live marketplaces.

### 2. GCC Currency Formatter Utility

Create `src/lib/formatCurrency.ts`:
- Uses `Intl.NumberFormat` with locale-aware formatting
- Supports all GCC currencies (AED, SAR, QAR, KWD, BHD, OMR)
- Handles Arabic locale (ar-AE) for RTL number formatting
- Used across all public pages and vendor portal wherever prices are displayed

### 3. Dynamic Tenant Branding (PublicBookingLayout)

Update `PublicBookingLayout.tsx` to:
- Apply `primary_color` and `accent_color` from `booking_settings` as CSS custom properties (`--tenant-primary`, `--tenant-accent`) on the layout wrapper
- Use inline `style` attribute to inject tenant colors into header, buttons, and active nav states
- Show `logo_url` in header (already partially done, needs polish)
- Apply tenant colors to child pages via CSS variables cascading down

### 4. SEO: Dynamic Document Title & Meta Tags

Create a `useDocumentMeta` hook:
- Sets `document.title` dynamically based on current page/tenant
- Updates OG meta tags for social sharing
- Applied in `PublicBookingLayout` (tenant name), `PublicVendorDetailPage` (vendor name), and `PublicBrowsePage`

### 5. WhatsApp Link on Vendor Detail Page

Update `PublicVendorDetailPage.tsx`:
- Add WhatsApp button when `vendor.profile?.whatsapp` exists
- Links to `https://wa.me/{number}` with a pre-filled message
- Styled as a green CTA button, mobile-friendly
- Add contact email link if available

### 6. Notification Deep-Links for Booking Events

Update `NotificationBell.tsx` to handle booking notification types:
- `booking.new_quote_request` -- navigates to `/apps/booking/quotes`
- `booking.quote_sent` -- navigates to `/b/{tenantSlug}/my` (for customers) or falls back to quote requests
- `booking.quote_accepted` -- navigates to `/apps/booking/quotes`
- Uses `data_json.quote_request_id` and `data_json.vendor_id` for deep linking

### 7. Mobile Bottom Navigation for Public Pages

Add a fixed bottom nav bar to `PublicBookingLayout`:
- Shows on screens below `sm` breakpoint
- Contains: Browse (Search icon), Request Quote (Plus icon), My Bookings (User icon)
- Uses tenant `primary_color` for active state
- Hides the top nav labels on mobile (already done), bottom nav compensates

---

## Technical Details

### File Changes

| File | Action |
|------|--------|
| `supabase/migrations/new_migration.sql` | Create -- anon RLS policies for 6 tables |
| `src/lib/formatCurrency.ts` | Create -- GCC currency formatting utility |
| `src/hooks/useDocumentMeta.ts` | Create -- dynamic SEO meta tag hook |
| `src/pages/public/booking/PublicBookingLayout.tsx` | Edit -- dynamic branding CSS vars + bottom nav + SEO |
| `src/pages/public/booking/PublicBrowsePage.tsx` | Edit -- use formatCurrency |
| `src/pages/public/booking/PublicVendorDetailPage.tsx` | Edit -- WhatsApp/email links + formatCurrency + SEO |
| `src/pages/public/booking/PublicRequestQuotePage.tsx` | Edit -- formatCurrency for service prices |
| `src/pages/public/booking/PublicMyBookingsPage.tsx` | Edit -- formatCurrency |
| `src/pages/vendor/VendorDashboardPage.tsx` | Edit -- formatCurrency |
| `src/pages/vendor/VendorQuotesPage.tsx` | Edit -- formatCurrency |
| `src/pages/vendor/VendorPortalLayout.tsx` | Edit -- dynamic branding for vendor portal |
| `src/components/notifications/NotificationBell.tsx` | Edit -- booking notification deep-links |

### RLS Policy Pattern (example)

```text
CREATE POLICY "anon_browse_booking_settings"
ON public.booking_settings
FOR SELECT
TO anon, authenticated
USING (is_live = true AND tenant_slug IS NOT NULL);
```

### Currency Formatter Pattern

```text
formatCurrency(500, 'AED', 'ar')  -->  "500.00 د.إ"
formatCurrency(500, 'AED', 'en')  -->  "AED 500.00"
```

### Branding CSS Variables Pattern

```text
<div style={{
  '--tenant-primary': settings.primary_color,
  '--tenant-accent': settings.accent_color,
}}>
  <!-- children inherit these colors -->
</div>
```

