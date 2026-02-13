ممتاز 👌  
سأعيد كتابة الخطة **بنفس أسلوبه وتنظيمه بالضبط**، بدون تغيير أي شيء مما كتبه — فقط سأضيف الأقسام الخمسة المطلوبة بشكل واضح ومنظم حتى ينفذها الفريق بدون ارتباك.

---

# Bookivo: World-Class Public Storefront + Vendor Back Office (Enhanced)

## Overview

This is a major upgrade transforming the public storefront (`/b/:slug`) from a plain listing into a commercially competitive booking marketplace, and polishing the vendor portal (`/v/:slug`) into a complete back office.

No database migrations are needed -- all existing tables and columns are sufficient.

This version also includes commercial-grade enhancements: Featured logic, Empty States, SEO optimization, Sticky Mobile CTA, and AI Assist placeholder for vendor portal.

---

# Part 1: New Components to Create

### 1.1 PublicHero.tsx

(unchanged from previous specification)

Theme-aware hero section that reads `theme_template` from settings:

- eventServices → Full-width gradient banner
- marketplace → Search-forward compact hero
- rentals → Date-focused hero
- generic → Minimal hero

All themes must support logo fallback to initials avatar using `primary_color`.

---

### 1.2 PublicFooter.tsx

(unchanged)

Professional footer component with:

- Contact section (Email + WhatsApp conditional)
- Privacy Policy link (if exists)
- Powered by Bookivo branding
- Copyright (dynamic year)
- Vendor Login link (`/v/:slug`)
- Tenant color accent styling

---

### 1.3 ServiceCardPublic.tsx

(unchanged + featured enhancement below)

Enhanced service card:

- Title (ULL-projected)
- Description (2-line truncate)
- Prominent price badge
- Duration + Guest range
- Vendor attribution
- CTA button
- Gradient fallback image

NEW:

- Support `featured` visual badge (if logic determines item is featured)
- Featured items should visually appear before regular items

---

### 1.4 VendorCardPublic.tsx

(unchanged + featured enhancement)

Enhanced vendor card:

- Logo or initials avatar
- Display name
- Bio truncated
- Service count badge
- Click to vendor detail

NEW:

- Support `featured` visual badge
- Featured vendors should render before others (sorting logic only, no DB changes required)

---

### 1.5 PublicAuthPage.tsx

(unchanged)

Tenant-scoped authentication at `/b/:slug/auth`:

- Tenant branding (NOT AiBizos)
- Sign In / Sign Up toggle
- Supabase auth
- Redirect handling
- Loading states
- Toast errors

---

# Part 2: Modified Files

## 2.1 PublicBookingLayout.tsx

(unchanged + SEO + sticky CTA additions)

Add:

- Header with tenant branding
- Customer auth state
- Vendor login link
- PublicHero
- PublicFooter
- Theme class on root
- Mobile bottom nav

NEW ADDITIONS:

### SEO Meta Tags (Required)

Add dynamic:

- `<title>` = workspace name
- `<meta name="description">` based on tone or tagline
- OpenGraph image (logo or fallback)
- Canonical URL
- og:title
- og:description

These must update per tenant.

---

### Sticky Mobile CTA (Required)

Add a bottom-fixed CTA bar on mobile:

- Primary button: “Request Quote”
- Styled with tenant primary color
- Visible on scroll
- Hidden on auth pages

This increases conversion significantly.

---

## 2.2 PublicBrowsePage.tsx

(unchanged)

Theme-aware section ordering:

- eventServices → Vendors then Services
- marketplace → Services then Vendors
- rentals → Services then Vendors
- generic → Services then Vendors

Use new ServiceCardPublic + VendorCardPublic components.

Grid layouts as previously specified.

---

## 2.3 PublicRequestQuotePage.tsx

Redirect to `/b/:slug/auth?redirect=...`

---

## 2.4 PublicMyBookingsPage.tsx

Redirect to `/b/:slug/auth?redirect=...`

---

## 2.5 PublicVendorDetailPage.tsx

Polish layout:

- Cover area (gradient fallback)
- Larger logo
- Use ServiceCardPublic
- Back to browse link

---

## 2.6 VendorPortalLayout.tsx

Add:

- Tenant logo in header
- Vendor display name
- “View My Store” link
- Improved tab styling

NEW ADDITION:

### AI Assist Placeholder (Required)

Inside Vendor Portal layout, add a visible but optional section:

- Button: “AI Assist (Coming Soon)” or “AI Assistant Beta”
- Clicking opens modal placeholder with:
  - Description of future AI features
  - Disabled input field (non-functional)
  - Clear label: “Draft → Preview → Confirm workflow will be available soon”

No backend logic required now. UI only.

This prepares structure for future AI Vendor Agent.

---

## 2.7 App.tsx

Add route:

`/b/:tenantSlug/auth` → PublicAuthPage

Lazy load.

---

## 2.8 i18n Updates

(unchanged from previous plan)

Add keys for hero, footer, auth, serviceCard, vendorCard.

Also add:

- `featured`: "Featured"
- `empty.noServices`: "No services available yet."
- `empty.noVendors`: "No vendors available yet."
- `sticky.requestQuote`: "Request Quote"

Arabic equivalents required.

---

# Part 3: Theme Token System

(unchanged)

Theme variations driven by `theme_template`:


| Aspect        | eventServices | marketplace    | rentals        | generic        |
| ------------- | ------------- | -------------- | -------------- | -------------- |
| Hero          | Large banner  | Search-forward | Date-forward   | Minimal        |
| Section order | Vendors first | Services first | Services first | Services first |
| Layout        | 2/3 grid      | 3-col grid     | 2-col wide     | 1-col          |
| Intensity     | Bold          | Medium         | Medium         | Minimal        |


---

# Part 4: Commercial Enhancements (NEW SECTION)

## 4.1 Featured Logic (No DB Migration)

Implement front-end sorting logic:

- First 2 services auto-marked as featured (temporary logic)
- First 1 vendor auto-marked as featured
- Or use existing metadata field if available
- Featured items:
  - Appear first
  - Show badge
  - Slightly stronger shadow or border

No schema changes required.

---

## 4.2 Empty States (Required)

For all public pages:

- If no services → show centered message + subtle icon
- If no vendors → show message
- If loading → show skeleton placeholders
- If no logo → fallback avatar
- If no WhatsApp/email → hide buttons gracefully

Must never show broken layout.

---

## 4.3 SEO Optimization (Required)

Each tenant page must dynamically generate:

- Title
- Meta description
- OG tags
- Fallback OG image
- Canonical link

No hardcoded AiBizos branding.

---

## 4.4 Sticky Mobile CTA (Required)

Add bottom sticky CTA on mobile:

- Button: Request Quote
- Full width
- Tenant primary color
- Appears only on browse and vendor pages
- Hidden on auth pages

---

## 4.5 AI Vendor Assistant Placeholder (UI Only)

Inside Vendor Portal:

- AI Assist button
- Modal placeholder
- Clear workflow explanation
- No backend logic yet

This prepares future Agent-based workflow.

---

# Part 5: What This Does NOT Change

- No database migrations
- No route renames
- Module ID stays `booking`
- `/b/:slug` and `/v/:slug` preserved
- Wizard unchanged
- Settings unchanged
- Internal admin unchanged
- Supabase auth unchanged

---

# Files Summary

(Create + Modify list remains identical to previous plan)

---

# Final Note

This version ensures:

- Commercial storefront quality
- Conversion-oriented UI
- Tenant-branded authentication
- Vendor-ready back office
- SEO readiness
- Mobile-first conversion
- Future AI integration readiness