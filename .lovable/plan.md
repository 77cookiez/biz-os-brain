

# Bookivo: Critical Fixes + "Book Now" Rebrand + World-Class Polish

## Issues Found

### 1. Vendor Registration BROKEN (Root Cause Identified)
The `register-vendor` edge function inserts `meaning_objects` with `type: 'vendor_profile'`, but the database has a CHECK constraint that only allows: `task, goal, idea, brain_message, note, plan, generic, message`. This causes every registration to fail with "violates check constraint". **Fix: change type to `'generic'`**.

### 2. "Request Quote" Must Become "Book Now"
The user explicitly wants to remove the quote-request flow label and replace it with direct booking language. All CTAs across 6 files say "Request Quote" -- must change to "Book Now" (EN) / "احجز الآن" (AR). The route can stay `/request` internally but the user-facing text must be action-oriented.

### 3. Storefront Visual Polish
The layout works but doesn't match world-class competitors (Calendly, Fresha, Square). Specific improvements needed in hero, cards, footer, and header.

---

## Part 1: Fix Vendor Registration (Critical Bug)

**File: `supabase/functions/register-vendor/index.ts`**
- Change `type: "vendor_profile"` to `type: "generic"` in the `meaning_objects` insert (line ~99)
- This is a one-line fix that unblocks all vendor registrations

---

## Part 2: Rebrand "Request Quote" to "Book Now"

Change all user-facing text from "Request Quote" to "Book Now" across:

**i18n files (`en.json` + `ar.json`):**
- `booking.public.requestQuote` --> "Book Now" / "احجز الآن"
- `booking.public.submitRequest` --> "Confirm Booking" / "تأكيد الحجز"
- `booking.public.requestSent` --> "Booking Submitted!" / "!تم إرسال الحجز"
- `booking.public.requestSentDesc` --> "Your booking request has been sent. You'll hear back soon."
- `booking.public.serviceCard.getQuote` --> "Get Price" / "اعرف السعر"
- Add: `booking.public.bookNow` = "Book Now" / "احجز الآن"

**Component updates:**
- `PublicHero.tsx`: CTA button text from requestQuote to bookNow
- `ServiceCardPublic.tsx`: Button text from requestQuote to bookNow  
- `PublicBookingLayout.tsx`: Desktop CTA, mobile nav, and sticky CTA -- all from requestQuote to bookNow
- `PublicFooter.tsx`: Quick links section text
- `PublicRequestQuotePage.tsx`: Card title

---

## Part 3: Storefront Visual Upgrade

### 3a. Header Enhancement (`PublicBookingLayout.tsx`)
- Add "Vendor Login" link visible in header (small text link, currently only in footer)
- Improve mobile nav: replace "Request Quote" tab icon with CalendarPlus and "Book Now" text
- Better hover/active states with tenant color

### 3b. Hero Enhancement (`PublicHero.tsx`)
- **eventServices**: Add decorative dots/pattern overlay, larger text, better CTA with CalendarPlus icon instead of Sparkles
- **marketplace**: Add subtle category suggestion chips below search
- **generic**: Add a subtle gradient background tint using primaryColor

### 3c. Service Card Enhancement (`ServiceCardPublic.tsx`)
- Better visual hierarchy: price badge more prominent with colored background
- CTA button: "Book Now" with CalendarPlus icon
- Add subtle hover animation (scale transform)

### 3d. Footer Enhancement (`PublicFooter.tsx`)
- Add Terms & Conditions link placeholder
- Add "Become a Vendor" as a more prominent CTA (not just a text link -- use a subtle outlined button)
- Ensure "Powered by Bookivo" has a small sparkle icon

---

## Part 4: Sticky Mobile CTA Update

In `PublicBookingLayout.tsx`:
- Change CTA text to "Book Now"
- Change icon from Sparkles to CalendarPlus
- Keep constraint logic (only on browse + vendor detail pages)

---

## Files Summary

| Action | File | Change |
|--------|------|--------|
| Modify | `supabase/functions/register-vendor/index.ts` | Fix meaning_objects type: `generic` instead of `vendor_profile` |
| Modify | `src/components/booking/PublicHero.tsx` | Better visuals, "Book Now" CTA |
| Modify | `src/components/booking/PublicFooter.tsx` | Terms link, better Vendor CTA, sparkle on Powered By |
| Modify | `src/components/booking/ServiceCardPublic.tsx` | "Book Now" CTA, hover animation, better price display |
| Modify | `src/pages/public/booking/PublicBookingLayout.tsx` | "Book Now" everywhere, vendor login in header, CalendarPlus icon |
| Modify | `src/pages/public/booking/PublicRequestQuotePage.tsx` | "Book Now" title |
| Modify | `src/i18n/translations/en.json` | Rebrand all quote text to booking text |
| Modify | `src/i18n/translations/ar.json` | Arabic equivalents |
| Deploy | `register-vendor` edge function | Deploy after fix |

## What Does NOT Change
- Database schema (no migrations)
- Route paths (still `/request`, `/my`, `/auth`)
- Auth flow logic
- Vendor portal layout and AI assist
- Admin vendor management page
