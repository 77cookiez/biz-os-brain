# Global Repositioning: Booking OS to Bookivo

## Summary

Rebrand all user-facing references from regional (GCC/Gulf/Middle East) positioning to global positioning under the product name **Bookivo**. No DB schema, route, or module ID changes.

---

## Changes Required

### 1. Manifest Update

**File: `src/apps/booking/manifest.ts**`

- Change `name` from `'Booking OS'` to `'Bookivo'`
- Change `description` to global language: `'AI-powered booking operating system for modern service businesses. Manage vendors, services, quotes, and bookings with built-in chat and multi-currency support.'`

### 2. Currency System: Remove AED Default & Expand Currencies

**File: `src/lib/formatCurrency.ts**`

- Remove "GCC-aware" comment, replace with global description
- Change default currency parameter from `'AED'` to `'USD'`

**File: `src/pages/apps/booking/BookingSetupWizard.tsx**`

- Rename `GCC_CURRENCIES` to `SUPPORTED_CURRENCIES`
- Expand list to include: `USD, EUR, GBP, AED, SAR, QAR, KWD, BHD, OMR`
- Change default currency fallback from `'AED'` to `'USD'`

**File: `src/pages/public/booking/PublicBrowsePage.tsx**` (line 18)

- Change `settings?.currency || 'AED'` to `settings?.currency || 'USD'`

**File: `src/pages/public/booking/PublicVendorDetailPage.tsx**` (line 21)

- Change `settings?.currency || 'AED'` to `settings?.currency || 'USD'`

**File: `src/pages/vendor/VendorQuotesPage.tsx**` (line 79)

- Change hardcoded `currency: 'AED'` to `currency: settings?.currency || 'USD'` (must pass settings from context)

**File: `src/hooks/useBookingQuotes.ts**` (line 214)

- Change `input.currency || 'AED'` to `input.currency || 'USD'`

### 3. i18n Updates (All 5 Languages)

Add new `booking.brand` keys and update `booking.dashboard.title` in each language file:

**English (`en.json`):**

```json
"brand": {
  "productName": "Bookivo",
  "tagline": "The Intelligent Booking OS for Service Businesses",
  "positioning": "Bookivo is an AI-powered Booking Operating System built for modern service businesses worldwide.",
  "shortDescription": "Smart booking management for service businesses",
  "globalReady": "Global-ready architecture",
  "multiLanguage": "Multi-language by design",
  "aiPowered": "AI-driven workflows",
  "whiteLabel": "White-label marketplace capability",
  "marketplaceReady": "Multi-tenant marketplace infrastructure"
}
```

- Change `booking.dashboard.title` from `"Booking OS"` to `"Bookivo"`

**Arabic (`ar.json`):**

```json
"brand": {
  "productName": "Bookivo",
  "tagline": "نظام حجوزات ذكي للأعمال الخدمية الحديثة",
  "positioning": "Bookivo هو نظام تشغيل حجوزات مدعوم بالذكاء الاصطناعي للأعمال الخدمية حول العالم.",
  "shortDescription": "إدارة حجوزات ذكية للأعمال الخدمية",
  "globalReady": "بنية عالمية جاهزة",
  "multiLanguage": "متعدد اللغات بالتصميم",
  "aiPowered": "سير عمل مدعوم بالذكاء الاصطناعي",
  "whiteLabel": "قابلية العلامة البيضاء للسوق",
  "marketplaceReady": "بنية سوق متعددة المستأجرين"
}
```

- Change `booking.dashboard.title` from `"نظام الحجوزات"` to `"Bookivo"`

**French (`fr.json`):**

```json
"brand": {
  "productName": "Bookivo",
  "tagline": "Le systeme de reservation intelligent pour les entreprises de services",
  "positioning": "Bookivo est un systeme de reservation propulse par l'IA pour les entreprises de services modernes dans le monde entier.",
  "shortDescription": "Gestion intelligente des reservations pour les entreprises de services",
  "globalReady": "Architecture mondiale",
  "multiLanguage": "Multilingue par conception",
  "aiPowered": "Flux pilotes par l'IA",
  "whiteLabel": "Marque blanche disponible",
  "marketplaceReady": "Infrastructure multi-tenant"
}
```

**German (`de.json`):**

```json
"brand": {
  "productName": "Bookivo",
  "tagline": "Das intelligente Buchungs-OS fur Dienstleistungsunternehmen",
  "positioning": "Bookivo ist ein KI-gestutztes Buchungsbetriebssystem fur moderne Dienstleistungsunternehmen weltweit.",
  "shortDescription": "Intelligente Buchungsverwaltung fur Dienstleistungsunternehmen",
  "globalReady": "Globale Architektur",
  "multiLanguage": "Mehrsprachig by Design",
  "aiPowered": "KI-gesteuerte Workflows",
  "whiteLabel": "White-Label-Marktplatz",
  "marketplaceReady": "Multi-Tenant-Infrastruktur"
}
```

**Spanish (`es.json`):**

```json
"brand": {
  "productName": "Bookivo",
  "tagline": "El sistema de reservas inteligente para negocios de servicios",
  "positioning": "Bookivo es un sistema operativo de reservas impulsado por IA para negocios de servicios modernos en todo el mundo.",
  "shortDescription": "Gestion inteligente de reservas para negocios de servicios",
  "globalReady": "Arquitectura global",
  "multiLanguage": "Multilingue por diseno",
  "aiPowered": "Flujos impulsados por IA",
  "whiteLabel": "Capacidad de marca blanca",
  "marketplaceReady": "Infraestructura multi-tenant"
}
```

### 4. Marketing Page: `/bookivo`

Create a new page `**src/pages/BookivoPage.tsx**` and add route in `App.tsx`:

- Hero with tagline and "Start Free Trial" CTA (links to `/auth`)
- 8 feature sections: Global-ready, Multi-language, Multi-currency, AI-driven, White-label, Secure multi-tenant, 14-day trial, Privacy-first
- No mention of AI Business OS internals
- Clean, standalone landing page

### 5. Route Addition in App.tsx

- Add `/bookivo` route pointing to `BookivoPage` (public, no auth required)

---

## Files Modified Summary


| File                                                  | Change                                       |
| ----------------------------------------------------- | -------------------------------------------- |
| `src/apps/booking/manifest.ts`                        | Name + description to global                 |
| `src/lib/formatCurrency.ts`                           | Remove GCC comment, default to USD           |
| `src/pages/apps/booking/BookingSetupWizard.tsx`       | Rename const, expand currencies, USD default |
| `src/pages/public/booking/PublicBrowsePage.tsx`       | AED fallback to USD                          |
| `src/pages/public/booking/PublicVendorDetailPage.tsx` | AED fallback to USD                          |
| `src/pages/vendor/VendorQuotesPage.tsx`               | AED hardcode to dynamic                      |
| `src/hooks/useBookingQuotes.ts`                       | AED fallback to USD                          |
| `src/i18n/translations/en.json`                       | Add brand keys, update title                 |
| `src/i18n/translations/ar.json`                       | Add brand keys, update title                 |
| `src/i18n/translations/fr.json`                       | Add brand keys, update title                 |
| `src/i18n/translations/de.json`                       | Add brand keys, update title                 |
| `src/i18n/translations/es.json`                       | Add brand keys, update title                 |
| `src/pages/BookivoPage.tsx`                           | **New** - Marketing landing page             |
| `src/App.tsx`                                         | Add `/bookivo` route                         |


## What Will NOT Change

- Module ID remains `booking`
- All DB tables remain unchanged
- All routes (`/b/:tenantSlug`, `/v/:tenantSlug`, `/apps/booking/*`) unchanged
- OIL and ULL logic untouched
- No migration needed

&nbsp;

# ✅ MASTER IMPLEMENTATION PROMPT — BOOKIVO (FULL EXECUTION PLAN)

---

You are implementing the full production-ready evolution of the **Booking OS module**, now publicly branded as **Bookivo**.

This is a single, unified implementation plan.  
You must apply it consistently and return a structured execution report.

---

# 🎯 STRATEGIC DECISION

We are repositioning the product as:

## Product Name:

**Bookivo**

## Strategy:

**Region-Adaptive Global SaaS**

This means:

- Bookivo is GLOBAL by default
- Messaging adapts per region (environment-based)
- Currency adapts per deployment
- No hard regional locking (no GCC-only positioning)
- Module ID remains: `booking`
- DB tables remain unchanged
- No breaking schema changes

---

# 🔎 APPROVAL STATUS OF PREVIOUS REPORT

### Hardening Report (7 Gaps)


| Gap                     | Decision                    |
| ----------------------- | --------------------------- |
| Anonymous RLS           | ✅ APPROVED — must implement |
| Dynamic Tenant Branding | ✅ APPROVED                  |
| SEO meta tags           | ✅ APPROVED                  |
| GCC currency formatting | ❌ MODIFY → Make global      |
| WhatsApp link missing   | ✅ APPROVED                  |
| Notification deep-links | ✅ APPROVED                  |
| Mobile bottom nav       | ✅ APPROVED                  |


Currency must NOT be GCC-specific anymore.

---

# 🧱 PHASE 1 — GLOBAL REPOSITIONING

## 1️⃣ Manifest

File:

```
src/apps/booking/manifest.ts

```

- name → "Bookivo"
- id remains "booking"
- description:

"AI-powered booking infrastructure for modern service businesses worldwide. Manage vendors, services, quotes, bookings, payments, and chat in one unified system."

---

## 2️⃣ Currency System (Global First)

### Remove:

- Any GCC wording
- Hardcoded 'AED'
- Hardcoded 'USD'

### Introduce:

```
const DEFAULT_CURRENCY =
process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'USD';

```

Use everywhere:

```
settings?.currency || DEFAULT_CURRENCY

```

---

## 3️⃣ Supported Currencies

Rename:

```
GCC_CURRENCIES → SUPPORTED_CURRENCIES

```

Include:

USD, EUR, GBP, AUD, CAD, AED, SAR, QAR, KWD, BHD, OMR

---

## 4️⃣ Currency Formatter

File:

```
src/lib/formatCurrency.ts

```

Use:

```
new Intl.NumberFormat(locale, {
  style: 'currency',
  currency
})

```

Locale must follow current UI language.

---

# 🌍 PHASE 2 — REGION-ADAPTIVE BRANDING

Introduce environment variables:

```
NEXT_PUBLIC_BRAND_REGION=global | mena | europe | us | custom
NEXT_PUBLIC_DEFAULT_CURRENCY=USD
NEXT_PUBLIC_MARKETING_TONE=modern | enterprise | local

```

Landing messaging adapts per region.

NO DB changes required.

---

# 🧭 PHASE 3 — WIZARD PRODUCTION READINESS

## Issues to Fix (APPROVED)

1. Add logo upload
2. Add slug uniqueness check
3. Create booking-assets storage bucket
4. Show public URL after launch
5. Add quick-edit in settings

---

## 1️⃣ Storage Bucket

Create public bucket:

```
booking-assets

```

Policy:  
Authenticated workspace admins can upload/delete only under:

```
{workspace_id}/*

```

---

## 2️⃣ Logo Upload Component

Create:

```
src/components/booking/LogoUpload.tsx

```

Requirements:

- Max 2MB
- jpg/png/webp
- Preview
- Remove option
- Upload to:  
booking-assets/{workspaceId}/logo-{timestamp}.{ext}
- Save public URL into booking_settings.logo_url

---

## 3️⃣ Slug Availability Check

Debounced (500ms)

Query:

```
SELECT id FROM booking_settings
WHERE tenant_slug = :slug
AND workspace_id != :currentWorkspace

```

Block launch if taken.

---

## 4️⃣ Show Public URL After Launch

In Settings Page:

Display:

```
https://yourdomain.com/b/{tenant_slug}

```

Add:

- Copy button
- Open button
- Logo preview
- Status badge (Live / Draft)

---

# 🔐 PHASE 4 — PUBLIC HARDENING

## 1️⃣ Anonymous RLS Policies (CRITICAL)

Add SELECT policies for:

- booking_settings (where is_live=true)
- booking_vendors (approved only)
- booking_vendor_profiles
- booking_services (is_active=true)
- meaning_objects
- content_translations

Read-only only.

---

## 2️⃣ Dynamic Tenant Branding

In PublicBookingLayout:

Inject CSS vars:

```
--tenant-primary
--tenant-accent

```

Use logo_url in header.

---

## 3️⃣ SEO Hook

Create:

```
useDocumentMeta.ts

```

Set:

- document.title
- og:title
- og:description

Apply to:

- /bookivo
- /b/:slug
- vendor detail pages

---

## 4️⃣ WhatsApp Button

If profile.whatsapp exists:

Add CTA:

```
https://wa.me/{number}

```

Mobile-friendly.

---

## 5️⃣ Notification Deep Links

Update NotificationBell:

Map:

[booking.new](http://booking.new)_quote_request → /apps/booking/quotes  
booking.quote_sent → /b/{slug}/my  
booking.quote_accepted → /apps/booking/quotes

Use data_json.

---

## 6️⃣ Mobile Bottom Nav

Add fixed bottom nav for public pages under sm breakpoint.

---

# 📦 PHASE 5 — STANDALONE PACKAGING (NO SPLIT YET)

Create:

```
/bookivo
/docs/BOOKIVO_SHIPPING.md
/docs/BOOKIVO_RELEASE_CHECKLIST.md

```

---

## /bookivo Landing

Must include:

- Hero
- 8 feature grid
- Global positioning
- 14-day trial
- Privacy-first
- CTA: Start Free Trial → /auth

Must NOT mention AI Business OS internals.

---

## Shipping Modes (document only)

1. Same App (recommended)
2. Subdomain reverse proxy
3. True standalone split (future)

---

# 💰 PHASE 6 — PRICING TIER ARCHITECTURE (PREP ONLY)

Create design for:

Starter  
Pro  
Enterprise

Add plan gating structure:

booking_subscription_plans table (design only if not exists)

Fields:

- max_vendors
- max_services
- allow_ai
- allow_marketplace
- allow_white_label

No enforcement yet, only scaffolding.

---

# 🔒 FEATURE GATING PATTERN

Frontend:

```
if (!plan.allow_ai) disableAI()

```

Backend:  
RLS condition using helper function.

---

# 🚫 WHAT MUST NOT CHANGE

- Module ID remains: booking
- DB table names unchanged
- OIL logic untouched
- ULL logic untouched
- Existing migrations preserved
- No deployment
- No app store shipping

---

# 📋 REQUIRED OUTPUT FORMAT

Return a structured implementation report including:

1. Changes applied
2. Files created
3. Files modified
4. DB migrations added
5. RLS policies created
6. Environment variables introduced
7. SEO additions
8. Branding updates
9. Currency system changes
10. Feature gating scaffolding
11. Remaining risks
12. Manual test checklist
13. Local test URLs
14. Production test URLs

---

# 🏁 END GOAL

Bookivo must become:

- Global-ready
- Region-adaptive
- Production-hardened
- White-label capable
- Multi-currency
- Multi-language
- AI-powered
- Standalone marketable
- Enterprise scalable

Without breaking the existing architecture.

---

# END OF PLAN