

# Bookivo: Complete Vendor Management, Portal Access Fix, and Storefront Polish

## Overview

This plan addresses 5 critical issues: (1) Vendor portal showing "Access Denied" because there's no way to register as a vendor, (2) Empty vendors page in the admin dashboard with no ability to add/manage vendors, (3) Footer and header polish to match world-class standards, (4) Missing vendor self-registration from the public store, and (5) Making the AI Assist actually functional using built-in AI models.

---

## Part 1: Vendor Portal Access Fix + Vendor Registration

### Problem
When a user clicks "Vendor Login" on the public store, they're redirected to `/v/:tenantSlug`. The `VendorPortalLayout` queries `booking_vendors` for a record where `owner_user_id = user.id`. Since no vendor record exists, it shows "Access Denied."

### Solution
Create a **Vendor Registration Flow** at `/v/:tenantSlug`:

1. If user is NOT logged in: redirect to `/b/:tenantSlug/auth?redirect=/v/:tenantSlug` (tenant-branded auth)
2. If user IS logged in but has NO vendor record: show a **"Join as Vendor"** registration form instead of "Access Denied"
3. If user IS logged in and HAS a vendor record: show the portal as normal

The registration form collects:
- Display name (business name)
- Bio / description
- Email and WhatsApp
- Logo upload (optional)

On submit, it creates:
- A `booking_vendors` record with `status = 'pending'`
- A `booking_vendor_profiles` record with the entered details
- A `meaning_objects` record for the display name (ULL compliance)

The vendor sees a "Pending Approval" state until the workspace admin approves them from the dashboard.

### Files
- **Modify**: `src/pages/vendor/VendorPortalLayout.tsx` -- replace "No Access" screen with registration form; redirect unauthenticated users to tenant-scoped auth instead of `/auth`

---

## Part 2: Admin Vendor Management Page

### Problem
`BookingVendorsPage` is a static empty page with no functionality.

### Solution
Build a full vendor management page with:

1. **Vendor List**: Table/cards showing all vendors with status badges (Pending, Approved, Suspended)
2. **Add Vendor Button**: Dialog to manually add a vendor by entering their email (looks up existing user or shows instructions to invite them)
3. **Vendor Actions**: Approve, Suspend, Reactivate buttons (already exist in `useBookingVendors` hook)
4. **Vendor Detail**: Click to see vendor's profile, services count, and quote request count
5. **Invite Vendor Link**: Generate a link like `/v/:tenantSlug` that vendors can use to self-register

The existing `useBookingVendors` hook already has `approveVendor`, `suspendVendor`, and `reactivateVendor` mutations -- they just need a UI.

### Files
- **Modify**: `src/pages/apps/booking/BookingVendorsPage.tsx` -- complete rebuild with vendor list, actions, and add vendor dialog

---

## Part 3: Enhanced Footer

### Current State
The footer has 3 columns (brand, contact, links) with basic content.

### Enhancements
- Add a subtle gradient top border using tenant colors
- Add social media links section (if configured)
- Add "Terms & Conditions" link alongside Privacy Policy
- Add "Become a Vendor" CTA link in footer pointing to `/v/:tenantSlug`
- Better spacing and typography matching world-class booking sites (Calendly, Fresha style)
- Add a small Bookivo logo mark next to "Powered by Bookivo"

### Files
- **Modify**: `src/components/booking/PublicFooter.tsx`

---

## Part 4: Enhanced Header

### Current State
Header has logo, name, browse/my-bookings nav, and auth state. Functional but could be more polished.

### Enhancements
- Better visual separation between brand and navigation
- Add a "Request Quote" CTA button on desktop (primary action, always visible)
- Polish the mobile bottom nav with better active state indicators using tenant colors
- Add subtle hover animations on nav links
- Better avatar dropdown for logged-in users (with sign out option)

### Files
- **Modify**: `src/pages/public/booking/PublicBookingLayout.tsx`

---

## Part 5: Functional AI Vendor Assistant

### Current State
AI Assist button opens a static placeholder modal listing future features.

### Solution
Make it a real AI assistant using the built-in Lovable AI models (no API key needed). The workflow:

1. Vendor clicks "AI Assist" button
2. Modal opens with a chat-style interface
3. Vendor types what they need: "Create a wedding photography service package"
4. AI generates a structured draft (title EN/AR, description, suggested price range, add-ons, terms)
5. Vendor sees a **Preview Card** with the generated content
6. Vendor clicks **"Apply"** to create the service, or **"Edit"** to modify, or **"Discard"**

This follows the system principle: **Ask -> Draft -> Preview -> Confirm -> Execute**

Implementation:
- Create a new edge function `vendor-ai-assist` that takes a prompt + vendor context and returns structured service/package suggestions
- The edge function uses the Lovable AI proxy (no API key needed)
- The modal becomes a real conversational interface

### Files
- **Create**: `supabase/functions/vendor-ai-assist/index.ts` -- Edge function for AI generation
- **Modify**: `src/pages/vendor/VendorPortalLayout.tsx` -- Replace placeholder modal with functional AI chat

---

## Part 6: i18n Updates

Add translation keys for:
- Vendor registration form labels and messages
- Admin vendor management page
- Enhanced footer links
- AI assist conversational UI
- Pending approval status messages

### Files
- **Modify**: `src/i18n/translations/en.json`
- **Modify**: `src/i18n/translations/ar.json`

---

## Technical Details

### Database Changes
No new tables or columns needed. All required tables exist:
- `booking_vendors` (status: pending/approved/suspended)
- `booking_vendor_profiles` (display_name, bio, email, whatsapp, logo_url)
- `meaning_objects` (for ULL compliance)

The RLS policies already support:
- Workspace members can create vendors (`ws_members_create_vendors` policy requires `owner_user_id = auth.uid()`)
- Vendor owners can manage their own profiles
- Admins can approve/suspend vendors

### Edge Function: vendor-ai-assist
- Uses `google/gemini-2.5-flash` via the Lovable AI proxy
- Accepts: `{ prompt: string, context: { vendorName, existingServices, locale } }`
- Returns: `{ suggestions: [{ type: 'service'|'package', title_en, title_ar, description_en, description_ar, suggestedPrice, duration, addons, terms }] }`
- Requires auth (vendor must be logged in)

### Vendor Registration RLS
The existing `ws_members_create_vendors` policy requires `is_workspace_member(auth.uid(), workspace_id)`. This means the registering user must be a workspace member. For public vendor registration, we need to first add the user as a workspace member (with a minimal role), then create the vendor record. This can be handled in a single transaction or via a new RPC function.

**Alternative approach**: Create a `register-vendor` edge function that handles the workspace membership + vendor creation atomically using the service role key. This is more secure and avoids RLS complexity.

### Files Summary

| Action | File |
|--------|------|
| Modify | `src/pages/vendor/VendorPortalLayout.tsx` |
| Modify | `src/pages/apps/booking/BookingVendorsPage.tsx` |
| Modify | `src/components/booking/PublicFooter.tsx` |
| Modify | `src/pages/public/booking/PublicBookingLayout.tsx` |
| Modify | `src/i18n/translations/en.json` |
| Modify | `src/i18n/translations/ar.json` |
| Create | `supabase/functions/vendor-ai-assist/index.ts` |
| Create | `supabase/functions/register-vendor/index.ts` |

### What Will NOT Change
- Database schema (no migrations)
- Module ID stays `booking`
- Existing routes unchanged
- Wizard flow unchanged
- Settings page unchanged
- Public browse/detail pages unchanged

