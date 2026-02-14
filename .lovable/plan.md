# Bookivo Site Management Overhaul

## Problem Summary

The current Bookivo settings page has critical gaps:

1. **Single-site limitation** -- only one storefront per workspace, no way to create additional sites
2. **No site deletion** -- once created, a site cannot be removed or reset
3. **Landing page unreachable** -- no clear link to the V3 storefront from settings
4. **Vendor portal missing logout** -- no sign-out button in vendor layout
5. **Incomplete storefront** -- V3 landing page needs to be connected properly
6. **No multi-site support for enterprise plans** -- Business plan (enterprise) should allow multiple storefronts

## Architecture Decision

Currently: `booking_settings` has ONE row per workspace (1:1 relationship).

For multi-site support on enterprise plans, we need to evolve this to a 1:N model where a workspace can have multiple `booking_settings` rows (each representing a separate storefront/site).

```text
Current:  workspace --> 1 booking_settings row --> 1 site
Proposed: workspace --> N booking_settings rows --> N sites (enterprise only)
```

## Implementation Plan

### Phase 1: Site Management UI (BookingSettingsPage)

**1A. Site List View**

- Replace the current single-site settings page with a "Sites" list at the top
- Show all `booking_settings` rows for the current workspace as cards
- Each card shows: site name (app_name), tenant_slug, status (Live/Draft), and quick actions
- Quick actions: Open Site, Copy URL, Edit (wizard), Delete
- "Add New Site" button -- gated by plan (Free/Pro = 1 site, Business = unlimited)

**1B. Public URL Links (all versions)**

- For each site, show links to:
  - V1: `/b/{slug}`
  - V3: `/b3/{slug}` (labeled "Premium Landing Page")
  - Vendor Portal: `/v/{slug}`
  - Admin: `/admin/booking/{slug}`
- Current settings page only shows `/b/{slug}` -- we add V3 link prominently

**1C. Delete Site**

- Add a delete button with confirmation dialog
- Deleting a site sets `is_live = false` and clears `tenant_slug` (soft delete)
- Or full delete of the `booking_settings` row (hard delete) with cascade warning
- Only workspace owners/admins can delete

**1D. Plan Gating for Multi-Site**

- Free and Pro plans: max 1 site (show upgrade prompt if they try to add more)
- Business (enterprise) plan: unlimited sites
- Use `billing_plans.features` to store `max_sites` or check plan ID directly

### Phase 2: Vendor Portal Logout Button

**2A. Add Sign Out to VendorPortalLayout**

- Add a LogOut button/icon in the vendor portal header (next to AI Assist and View Store buttons)
- On click: call `supabase.auth.signOut()` and redirect to tenant auth page
- Works on both desktop and mobile

**2B. Add Sign Out to V2 Vendor Portal**

- Same treatment for `VendorPortalLayoutV2`

### Phase 3: V3 Landing Page Connection

**3A. Settings Page V3 Link**

- In the "Hosted Store + PWA" card, add a second URL row for the V3 premium landing page
- Label: "Premium Landing Page" with an external link button
- URL: `/b3/{tenant_slug}`

**3B. V3 Route Index**

- Currently `/b3/:tenantSlug` renders the landing page inline in the layout
- Add an index route for browse page so sub-pages (vendors, request quote) work

### Phase 4: Database Changes

**4A. Add `sites_limit` to billing_plans features**

- Update the `features` JSONB in `billing_plans` to include `max_sites`:
  - Free: `max_sites: 1`
  - Pro: `max_sites: 1`
  - Business: `max_sites: null` (unlimited)

**4B. Allow multiple booking_settings per workspace**

- Currently `booking_settings` has an implicit 1:1 with workspace (code uses `.maybeSingle()`)
- The schema already allows multiple rows -- no migration needed
- Update `useBookingSettings` hook to return an array and accept a `settingsId` filter
- Update `BookingSettingsPage` to list all sites

### Phase 5: i18n (EN/AR)

New keys:

- `booking.sites.title` -- "Your Sites" / "مواقعك"
- `booking.sites.addNew` -- "Add New Site" / "إضافة موقع جديد"
- `booking.sites.delete` -- "Delete Site" / "حذف الموقع"
- `booking.sites.deleteConfirm` -- "Are you sure? This will remove the site permanently." / "هل أنت متأكد؟ سيتم حذف الموقع نهائياً."
- `booking.sites.limitReached` -- "Your plan allows {max} site(s). Upgrade to add more." / "خطتك تسمح بـ {max} موقع. قم بالترقية لإضافة المزيد."
- `booking.sites.premiumLanding` -- "Premium Landing Page" / "الصفحة الرئيسية المميزة"
- `booking.sites.vendorPortal` -- "Vendor Portal" / "بوابة المزود"
- `booking.sites.adminPanel` -- "Admin Panel" / "لوحة الإدارة"
- `booking.vendor.signOut` -- "Sign Out" / "تسجيل الخروج"

## Technical Details

### Files to Modify


| File                                                    | Change                                         |
| ------------------------------------------------------- | ---------------------------------------------- |
| `src/pages/apps/booking/BookingSettingsPage.tsx`        | Add site list, delete, V3 links, multi-site UI |
| `src/hooks/useBookingSettings.ts`                       | Support array of settings, add delete mutation |
| `src/pages/vendor/VendorPortalLayout.tsx`               | Add logout button in header                    |
| `src/pages/vendor/v2/VendorPortalLayoutV2.tsx`          | Add logout button in header                    |
| `src/pages/public/booking/v3/PublicBookingLayoutV3.tsx` | Ensure index route renders landing             |
| `src/i18n/translations/en.json`                         | New i18n keys                                  |
| `src/i18n/translations/ar.json`                         | New i18n keys                                  |
| `src/App.tsx`                                           | Add index route for V3                         |


### Database Changes (Migration)

- UPDATE `billing_plans` features JSONB to include `max_sites` values
- No schema changes needed -- `booking_settings` already supports multiple rows per workspace

### Security

- Delete operation uses existing RLS (`admins_manage_booking_settings`)
- Multi-site creation inherits existing insert permissions
- No new RPCs needed  

&nbsp;

## نقاط لازم تنتبه لها (تصحيح/تحسين)

### 1) لا تعتمد على “UI gating” فقط

حتى لو أخفيت زر “Add New Site”، لازم تمنع الزيادة **على مستوى السيرفر/الـ DB**:

- إمّا عبر **RLS policy للـ insert** تتحقق من عدد المواقع مقابل `max_sites`
- أو عبر **RPC** (أفضل) يقوم بالتحقق ثم الإدخال  
بدون هذا، أي عميل يقدر يسوي insert مباشر ويكسر حد الخطة.

### 2) قرار الحذف: soft delete vs hard delete

ذكرت خيارين، ممتاز، لكن لازم تحسم سلوك النظام:

- **Soft delete**: لا تمسح `tenant_slug` عادةً إلا إذا تبغى “تحرير السلاق” لإعادة استخدامه.
  - الأفضل: أضف حقول مثل `deleted_at`, `deleted_by`, واعتبره غير ظاهر في القوائم.
- **Hard delete**: خطر إذا فيه جداول مرتبطة (vendors / bookings / quotes / media). لازم “cascade warning” حقيقي (يعني تعرف إيش اللي بينحذف).

> اقتراحي: **Soft delete افتراضيًا** + خيار “Delete permanently” للـ owners فقط.

### 3) `tenant_slug` لازم يكون فريد عالميًا (مش داخل workspace فقط)

بما أن الروابط عامة `/b/{slug}` و`/b3/{slug}` و`/v/{slug}`، فـ slug إذا تكرر بين workspaces يصير تضارب routing.

- تأكد من وجود **unique index** على `tenant_slug` (مع السماح بـ NULL لو تستخدم soft delete).
- لو ما تقدر Unique بسبب soft delete: استخدم **partial unique index** حيث `deleted_at IS NULL` أو `is_live=true` حسب منطقك.

### 4) تغيير `useBookingSettings` من `.maybeSingle()` إلى list

صحيح، لكن انتبه لتأثيره على:

- الصفحات اللي تفترض “موقع واحد”
- أي logic يعتمد على “current settings”  
الحل:
- خليه يرجع **list + helper** مثل `getDefaultSite()` (مثلاً أول site أو المعلّم `is_primary=true` لو أضفتها).

### 5) “Status: Live/Draft” تعريفه لازم يكون واضح

أنت تستخدم `is_live`. طيب ماذا عن:

- موقع تم إنشاؤه لكن لم يكتمل (Draft)
- موقع محذوف soft (Deleted)  
أنصح تضيف “computed status” في UI:
- `Deleted` إذا `deleted_at != null`
- `Live` إذا `is_live=true`
- `Draft` غير ذلك

### 6) V3 routing: “index route” كلامك صح لكن يلزم تعريف واضح

عبارتك:

> “Add an index route for browse page so sub-pages work”  
> صحيحة إذا عندك nested routes مثل:

- `/b3/:tenantSlug` (landing)
- `/b3/:tenantSlug/vendors`
- `/b3/:tenantSlug/request-quote`  
المهم: في `App.tsx` أو الراوتر لازم يكون فيه **Route Index** داخل layout V3، مو مجرد route منفصل.

## اقتراحات “تكمّل” الخطة بدون ما تعقّدها

- إضافة **“Set as Primary”** للموقع داخل workspace (اختياري لكنه يحل سؤال: أي موقع يفتح افتراضيًا؟)
- إضافة **Audit log event** عند (Create/Delete/Go Live) لأن هذا إعداد حساس
- زر “Copy Vendor Portal URL” و “Copy Admin URL” مع toast واضح (يحسن UX)

## خلاصة الحكم

- ✅ الخطة **صحيحة** كتصميم عام وتنفيذ مرحلي.
- ⚠️ تحتاج فقط تضيف/تؤكد:
  1. Enforcement للـ `max_sites` **سيرفر/RLS أو RPC**
  2. سياسة حذف واضحة (Soft default)
  3. **Unique slug** عالميًا
  4. تعديل الـ hooks بعناية مع “default site”