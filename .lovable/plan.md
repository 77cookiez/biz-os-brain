# Bookivo Storefront -- Complete Fix and Quality Plan

## Identified Issues

### 1. Broken Links in V3 Storefront

- **PublicAuthPage** hardcodes basePath detection for `/b/` and `/b2/` only -- it does NOT detect `/b3/` paths. Users on the V3 storefront who are redirected to auth get sent to wrong paths.
- **V3 Footer** links to `/v3/:tenantSlug` for vendor portal but that route does NOT exist (vendor portal is at `/v/:tenantSlug`).
- **"Browse Services" button** in V3 hero links back to `basePath` (the landing page itself) instead of scrolling down or linking to browse page. There is no separate browse route under `/b3/`.

### 2. Image Upload Not Working

- **LogoUpload** uploads to bucket `booking-assets` at path `{workspaceId}/logo-{timestamp}`. This path pattern does NOT match the RLS policies, which expect paths like `{workspaceId}/tenant/logo/{file}`.
- **Storage RLS policies** enforce specific path patterns. The LogoUpload component uses a legacy path format that likely fails silently.

### 3. AI Features Not Working

- **Brain Chat** requires an active session and a deployed `brain-chat` edge function. This is infrastructure-level -- needs verification that the function is deployed and the API key is configured.
- Will verify edge function deployment status.

### 4. V3 Landing Page Content is Hardcoded English

- All V3 landing page text (Hero, Features, How It Works, Testimonials, FAQ, CTA) is hardcoded in English strings, NOT using i18n keys. Arabic users see English text.

### 5. Missing V3 Index/Browse Route

- When user navigates from landing page to browse, there is no index route rendering `PublicBrowsePage` inside the V3 layout. The `/b3/:tenantSlug` only shows the landing page, and nested `Outlet` renders nothing on the landing page.

### 6. Auth Page Does Not Support V3 Path

- `PublicAuthPage` detects `/b2/` but not `/b3/`, causing redirect loops or wrong navigation after login.

---

## Fix Plan (Ordered by Impact)

### Fix A: Auth Page V3 Support

**File:** `src/pages/public/booking/PublicAuthPage.tsx`

Change the basePath detection logic from:

```
const basePath = currentPath.startsWith('/b2/') ? `/b2/${tenantSlug}` : `/b/${tenantSlug}`;
```

To:

```
const basePath = currentPath.startsWith('/b3/')
  ? `/b3/${tenantSlug}`
  : currentPath.startsWith('/b2/')
    ? `/b2/${tenantSlug}`
    : `/b/${tenantSlug}`;
```

### Fix B: V3 Footer Vendor Portal Link

**File:** `src/pages/public/booking/v3/PublicBookingLayoutV3.tsx`

Change `V3Footer` vendor link from `/v3/${tenantSlug}` to `/v/${tenantSlug}` (the actual vendor portal route).

### Fix C: V3 Browse Route + Navigation

**File:** `src/App.tsx`

Add an index route inside the V3 route group so that `/b3/:tenantSlug` can serve both landing page and browse:

- The current design renders the landing page inline when `isLanding` is true, and `<Outlet>` otherwise. This is correct but needs a dedicated "browse" sub-route.
- Add `<Route path="browse" element={<PublicBrowsePage />} />` inside the V3 route group.

**File:** `src/pages/public/booking/v3/PublicBookingLayoutV3.tsx`

Update the "Browse Services" button in the Hero to link to `${basePath}/browse` instead of `${basePath}`.

### Fix D: Logo Upload Path Mismatch

**File:** `src/components/booking/LogoUpload.tsx`

Change the upload path from:

```
const filePath = `${workspaceId}/logo-${Date.now()}.${fileExt}`;
```

To the standardized path:

```
const filePath = `${workspaceId}/tenant/logo/logo-${Date.now()}.${fileExt}`;
```

Also update `removeOldLogos` to search in the correct path prefix (`${workspaceId}/tenant/logo/`).

### Fix E: V3 Landing Page i18n

**File:** `src/pages/public/booking/v3/PublicBookingLayoutV3.tsx`

Replace all hardcoded English strings in the V3LandingPage component with `t()` calls using new i18n keys.

**Files:** `src/i18n/translations/en.json`, `src/i18n/translations/ar.json`

Add full translation keys under `booking.v3.landing`:

- Hero: title, subtitle, badge, cta, browse, trust indicators
- Stats: values and labels
- Features: each title and description
- How It Works: heading, subtitle, each step
- Testimonials: heading, subtitle, each review
- FAQ: heading, each question and answer
- CTA: heading, subtitle, buttons
- Footer: brand description, quick links heading, contact heading, legal heading, vendor links, copyright

### Fix F: V3 Header Nav "Browse" Link

Update nav items in V3 header to use `${basePath}/browse` for the browse link instead of the landing page URL (which would just reload the landing).

### Fix G: Verify AI/Brain Edge Function

- Check if `brain-chat` edge function is deployed and has required secrets (API keys).
- If secrets are missing, prompt user.

---

## Files to Modify


| File                                                    | Changes                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/pages/public/booking/PublicAuthPage.tsx`           | Add `/b3/` path detection                                              |
| `src/pages/public/booking/v3/PublicBookingLayoutV3.tsx` | Fix footer vendor link, i18n all strings, update nav/hero browse links |
| `src/App.tsx`                                           | Add browse route under V3                                              |
| `src/components/booking/LogoUpload.tsx`                 | Fix storage path to match RLS                                          |
| `src/i18n/translations/en.json`                         | Add ~60 V3 landing page translation keys                               |
| `src/i18n/translations/ar.json`                         | Add ~60 V3 landing page translation keys (Arabic)                      |


## No Database Changes Required

All fixes are frontend-only. No migrations, no RLS changes, no new RPCs.

## Expected Results After Fix

- All V3 storefront links work correctly (browse, auth, vendor portal, request quote)
- Image uploads succeed with correct storage paths
- V3 landing page displays in user's language (EN/AR)
- Navigation is consistent across desktop and mobile
- Auth redirects work correctly for all storefront versions (V1, V2, V3) 

# نقاط تحتاج تدقيق أو تحسين قبل التنفيذ

## 1️⃣ بيانك يقول: “No Database Changes Required”

هنا عندي تحفظ صغير.

لو كان:

- Logo path لم يكن مطابق سابقًا
- وتم رفع ملفات في مسارات قديمة

فممكن تحتاج:

- تنظيف bucket
- أو migration بسيط لإعادة تسمية الملفات
- أو fallback لقراءة المسار القديم لو موجود

فأنا أقترح تعديل البيان إلى:

> No schema changes required. Storage path alignment required.

حتى لا ينفذ الفريق fix بدون التفكير في الملفات الموجودة سابقًا.

---

## 2️⃣ Auth redirect logic يحتاج حماية إضافية

الكود المقترح:

```
currentPath.startsWith('/b3/')

```

جيد، لكن الأفضل أن تعتمد على:

- `tenantSlug` المستخرج من params
- وليس على `startsWith` فقط

لأن:

- لو غيرنا structure مستقبلاً
- أو استخدمنا nested routes

سيكسر logic.

اقتراح أقوى معماريًا:

- استخرج route group من router config بدل string matching.

---

## 3️⃣ Browse route: انتبه لتجربة الرجوع

إذا أصبح `/b3/:tenantSlug/browse` صفحة مستقلة:

تأكد من:

- scroll restoration
- page title
- canonical URL (SEO)
- shareable link behavior

وإلا ستبدو كأنها SPA fragment فقط.

---

## 4️⃣ Brain Edge Function Verification

ذكرت:

> Verify deployment and secrets

لكن الأفضل تضيف في البيان:

- Add health check call
- Add user-visible error if edge function unreachable
- Add fallback disabled state in UI

حتى لا يظهر “AI does nothing” بدون تفسير.

---

# 🟢 هل الخطة كافية لجعل V3 Production-ready؟

تقريبًا نعم، لكن أضيف لك 3 تحسينات تجعلها احترافية جدًا:

### 🔹 إضافة Loading State واضح في V3

- أثناء تحميل tenant data
- بدل flash أو blank state

---

### 🔹 إضافة 404 state لـ tenantSlug غير موجود

حالياً إن لم يوجد tenant:

- ماذا يحدث؟
- هل تظهر صفحة فارغة؟
- هل redirect؟

هذا يجب توضيحه في البيان.

---

### 🔹 حماية slug mismatch في auth redirect

إذا:

- المستخدم سجل في tenant A
- وحاول الدخول على tenant B

هل يتم منعه؟  
هذه نقطة أمنية مهمة.