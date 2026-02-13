

# Bookivo: Real Public Storefront, Themes, Auth, and Footer

## Problem

The public booking storefront at `/b/:slug` is currently non-functional as a real web store:

1. **Themes are labels only** -- selecting "marketplace" vs "rentals" vs "eventServices" changes nothing visually on the public pages
2. **No header branding** -- the header is minimal (logo + name), no hero/banner, no call-to-action
3. **No footer** -- no contact info, no links, no copyright section
4. **Auth is broken for customers** -- requesting a quote redirects to `/auth` which is the main AiBizos login, not a tenant-scoped login. Customers see AiBizos branding instead of the tenant's brand
5. **No vendor login link** -- vendors cannot access their portal from the public page
6. **Services display is basic** -- plain cards with no visual hierarchy, no images, no featured items
7. **No hero section** -- no banner or welcome area when landing on the store

---

## Solution Overview

Transform the public storefront into a world-class booking web store with real theme variations, a proper header/hero, footer, tenant-scoped auth, and polished service cards.

---

## Part 1: Real Theme System

Currently there are 4 theme names that do nothing. Each theme will now control the actual layout and visual style of the public storefront:

**marketplace** -- Grid layout, category feel, multiple vendors prominent, search-forward
**rentals** -- Card-based with availability dates visible, calendar-forward
**eventServices** -- Hero banner with cover photo, portfolio feel, vendor profiles prominent
**generic** -- Clean minimal list, service-first, simple and fast

Each theme will be implemented as CSS class variations + conditional layout blocks in the existing components (not separate page files). The `theme_template` value from `booking_settings` will drive:
- Header style (compact vs hero banner)
- Service card layout (grid vs list vs masonry)
- Color application intensity (subtle vs bold)
- Content ordering (vendors-first vs services-first)

---

## Part 2: Public Layout Redesign (PublicBookingLayout.tsx)

### Header Upgrade
- Show tenant logo (larger, prominent) + workspace name as brand
- Add a hero/banner area below the header with tenant primary color gradient
- Show a tagline or welcome message (using `tone` setting)
- Add "Vendor Login" link in the header (links to `/v/:slug`)
- Add "Sign In" / user avatar for customers

### Footer (New)
- Contact section: email + WhatsApp (from `booking_settings`)
- "Powered by Bookivo" subtle branding
- Copyright with current year
- Links: Privacy Policy (if `app_privacy_url` exists)
- Styled with tenant colors

### Mobile Bottom Nav
- Keep existing but add polish with tenant colors properly applied

---

## Part 3: Tenant-Scoped Customer Auth

**Problem**: Currently `/b/:slug/request` and `/b/:slug/my` redirect to `/auth` which shows AiBizos branding.

**Solution**: Create a new page `PublicAuthPage.tsx` at route `/b/:slug/auth` that:
- Shows the tenant's logo and brand colors (not AiBizos)
- Allows email/password sign in and sign up
- Uses the same Supabase auth (same user table)
- Redirects back to the tenant page after auth
- Shows the tenant name in the header

The existing `PublicRequestQuotePage` and `PublicMyBookingsPage` will redirect to `/b/:slug/auth?redirect=...` instead of `/auth`.

**Best practice note**: Customers can browse services and vendors WITHOUT signing in. Auth is only required when they want to:
- Request a quote
- View their bookings

This matches global booking platforms (Calendly, Fresha, Square Appointments).

---

## Part 4: Browse Page Upgrade (PublicBrowsePage.tsx)

### Hero Section (theme-dependent)
- **eventServices** theme: Full-width banner with cover gradient and workspace name
- **marketplace** theme: Compact search bar with category chips
- **rentals** theme: Date picker prominent at top
- **generic** theme: Simple welcome text

### Service Cards Upgrade
- Larger cards with better visual hierarchy
- Price displayed prominently with currency
- Duration shown with clock icon
- Guest range shown
- "Request Quote" button directly on each card
- Vendor name as subtle attribution below service title

### Vendor Cards Upgrade
- Show logo prominently (or initials avatar if no logo)
- Bio truncated to 2 lines
- Service count badge
- Star/rating placeholder for future

---

## Part 5: Vendor Portal Polish (VendorPortalLayout.tsx)

- Show tenant logo in header alongside "Vendor Portal" text
- Add vendor's own display name in header
- Add a link back to the public store ("View My Store")
- Better tab styling with tenant colors

---

## Part 6: Footer Component (New)

Create `src/components/booking/PublicFooter.tsx`:
- Contact information (email, WhatsApp with click-to-chat)
- "Powered by Bookivo" with subtle link
- Privacy policy link (if configured)
- Copyright line
- Tenant primary color as accent
- Responsive: stacked on mobile, horizontal on desktop

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/public/booking/PublicAuthPage.tsx` | Tenant-branded customer sign in/sign up |
| `src/components/booking/PublicFooter.tsx` | Reusable footer for public storefront |
| `src/components/booking/PublicHero.tsx` | Theme-aware hero/banner component |
| `src/components/booking/ServiceCardPublic.tsx` | Enhanced public service card |
| `src/components/booking/VendorCardPublic.tsx` | Enhanced public vendor card |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/public/booking/PublicBookingLayout.tsx` | Add footer, hero, vendor login link, customer auth state, theme class application |
| `src/pages/public/booking/PublicBrowsePage.tsx` | Use new card components, theme-aware layout, hero section |
| `src/pages/public/booking/PublicVendorDetailPage.tsx` | Polish vendor detail with cover image area, better service listing |
| `src/pages/public/booking/PublicRequestQuotePage.tsx` | Redirect to `/b/:slug/auth` instead of `/auth` |
| `src/pages/public/booking/PublicMyBookingsPage.tsx` | Redirect to `/b/:slug/auth` instead of `/auth` |
| `src/pages/vendor/VendorPortalLayout.tsx` | Add logo, store link, vendor name |
| `src/App.tsx` | Add route for `/b/:tenantSlug/auth` |
| `src/i18n/translations/en.json` | New keys for footer, hero, auth page |
| `src/i18n/translations/ar.json` | Arabic translations |

## What Will NOT Change

- Database schema (no migrations needed -- all data already exists)
- Module ID stays `booking`
- Routes `/b/:slug` and `/v/:slug` stay the same (only adding `/b/:slug/auth`)
- Wizard flow unchanged
- Settings page unchanged
- Internal booking admin pages unchanged

