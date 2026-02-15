# Owner Console: Full Platform Control

## Overview

Expand the Owner Console to give the platform owner complete control over all workspaces, apps, subscriptions (both OS-level billing and app-level like Bookivo), and user access. Every action is server-side authorized, audited, and reflected immediately for end users.

## What the Owner Will Be Able To Do

1. **View workspace details** -- see installed apps, current OS plan, app subscriptions (e.g. Bookivo plan), member count
2. **Override OS billing plans** -- assign any workspace to Free/Pro/Business instantly
3. **Override app subscriptions** -- e.g. give a workspace Bookivo "monthly" subscription or extend expiry
4. **Install/uninstall apps** for any workspace remotely
5. **Grant/revoke full access** (existing) with more grant types: `os_plan_override`, `app_plan_override`, `feature_flag`, `app_install`
6. **All changes reflect immediately** -- when a user or admin opens their workspace, they see the updated plan/apps

## Architecture

The `platform-admin` edge function gets new routes. No client-side trust -- all mutations go through the edge function which validates platform role and writes audit logs.

```text
Owner Console UI
      |
      v
platform-admin edge function (server-side role check)
      |
      v
  Direct DB writes via service role client
      |
      v
  platform_audit_log (append-only)
```

## Technical Plan

### 1. Edge Function: New Routes in `platform-admin`

Add these endpoints:


| Method | Path                   | Description                                                                 |
| ------ | ---------------------- | --------------------------------------------------------------------------- |
| GET    | `workspace-detail`     | Full workspace info: apps, OS subscription, app subscriptions, member count |
| POST   | `set-os-plan`          | Override OS billing_subscriptions for a workspace                           |
| POST   | `set-app-subscription` | Override app-level subscription (e.g. booking_subscriptions)                |
| POST   | `install-app`          | Install/activate an app for a workspace                                     |
| POST   | `uninstall-app`        | Deactivate an app for a workspace                                           |


Each route:

- Requires `owner` or `admin` platform role
- Writes to `platform_audit_log` with reason
- Returns updated data

`**workspace-detail**` queries:

- `workspaces` (name, company_id)
- `workspace_apps` (installed apps)
- `billing_subscriptions` (OS plan)
- `booking_subscriptions` (Bookivo plan, if exists)
- `workspace_members` count

`**set-os-plan**` body: `{ workspace_id, plan_id, billing_cycle?, reason }`

- Upserts `billing_subscriptions` with given plan_id
- Audit: `os_plan_override`

`**set-app-subscription**` body: `{ workspace_id, app_id, plan, status?, expires_at?, reason }`

- For Bookivo: upserts `booking_subscriptions`
- Extensible for future apps
- Audit: `app_subscription_override`

`**install-app**` body: `{ workspace_id, app_id, reason }`

- Upserts into `workspace_apps` with `is_active=true`, `installed_by=owner_user_id`
- Audit: `app_installed`

`**uninstall-app**` body: `{ workspace_id, app_id, reason }`

- Sets `workspace_apps.is_active=false`
- Audit: `app_uninstalled`

### 2. UI: Enhanced Workspace Detail Page

When the owner clicks a workspace in the list, a detail view opens with:

**Workspace Info Card**

- Name, ID, created date, member count

**Installed Apps Section**

- List of apps with active/inactive status
- "Install App" button (dropdown of available apps from `app_registry`)
- "Deactivate" button per app

**OS Plan Section**

- Current plan (Free/Pro/Business) and billing cycle
- "Change Plan" dropdown with all active plans
- Reason input required

**App Subscriptions Section** (per app that has subscriptions)

- Bookivo: current plan (monthly/yearly/etc), status, expiry
- "Change" button to override plan/status/expiry

All actions open a confirmation dialog requiring a reason (for audit).

### 3. UI: Updated Owner Overview

Add new quick links:

- "Subscriptions" overview (later, if needed)

Update audit log filter options with new action types.

### 4. Files to Create/Modify


| File                                         | Action                                       |
| -------------------------------------------- | -------------------------------------------- |
| `supabase/functions/platform-admin/index.ts` | Add 5 new route handlers                     |
| `src/hooks/usePlatformAdmin.ts`              | Add hooks for new endpoints                  |
| `src/pages/owner/OwnerWorkspaces.tsx`        | Add workspace detail view with full controls |
| `src/pages/owner/OwnerAudit.tsx`             | Add new action types to filter               |


### 5. Immediate Reflection for Users

No extra work needed -- the existing `useBilling`, `useBookingSubscription`, and `WorkspaceContext.refreshInstalledApps` hooks already query the database on each page load. When the owner changes a plan or installs an app via the edge function (service role), the data is written directly to the same tables the user reads from. The next time the user loads a page, they see the updated state.

### 6. Security

- All new routes require `owner` or `admin` platform role (server-side)
- Every mutation writes to `platform_audit_log` with actor, target, reason
- Service role client used only in edge function (never exposed to client)
- No new RLS policies needed (edge function bypasses RLS via service role)

## أهم تعديلين أنصح فيهم (High impact)

### 1) لا “تكتب فوق” حقيقة Stripe مباشرة — افصل *Override* عن *Billing Truth*

أنت كاتب: `set-os-plan` يعمل upsert على `billing_subscriptions` مباشرة.  
هذا قد يسبب مشكلة لاحقًا لما تفعل Stripe webhooks لأن Stripe هو “مصدر الحقيقة”، وبيصير عندك صراع: override vs webhook.

**أفضل ممارسة عالمية:**

- خلي Stripe/webhooks تحدّث جداول “truth” (مثل `billing_subscriptions`)
- وخلي OwnerConsole يعمل “Overrides” في جدول منفصل مثل:
  - `platform_grants` (موجود عندكم) باستخدام:
    - `grant_type = os_plan_override`
    - `value_json = { plan_id, billing_cycle }`
    - `ends_at` (مستحسن)
- ثم entitlement resolution يكون بالأولوية:
  1. grants (override)
  2. subscriptions (Stripe / truth)
  3. free/default

✅ النتيجة: تقدر “تعطي Pro فورًا” للتجربة بدون ما تلخبط Stripe.

> لو تبغى تبقي على نفس جدول `billing_subscriptions` لأسباب سرعة، على الأقل ضيف حقول/metadata واضحة:
>
> - `source = 'stripe' | 'override'`
> - `overridden_by`, `override_reason`, `override_ends_at`  
> لكن الأفضل فصلها.

---

### 2) “install/uninstall” ممتاز… لكن لا تحذف ولا تغيّر history

لازم يكون **soft toggle** فقط (زي ما كتبت `is_active=false`) مع:

- `installed_at`, `uninstalled_at`
- `installed_by`, `uninstalled_by`
- `reason_last_changed` (أو في audit فقط)

وبالنسبة للـ uninstall:  
**لا تمسح أي data** تخص التطبيق داخل workspace (حجوزات Bookivo مثلًا)، فقط اعطل الوصول.

---

## تحسينات أمنية مهمة (سريعة وقوية)

### A) Auth على edge function لازم يكون strict

- تحقق JWT من Supabase Auth من الهيدر (واضح عندكم)
- لا تعتمد فقط على وجود session في العميل
- واكتب في audit: request_id + ip/user_agent إن أمكن

### B) Rate limiting للـ owner routes

مو لازم نظام معقد، بس “basic throttle” يقلل المخاطر.

### C) Idempotency للعمليات الحساسة

لـ set plan / install app:

- دعم `idempotency_key` (اختياري) أو منع تكرار نفس العملية خلال ثواني  
هذا يقلل الأخطاء لو المستخدم ضغط مرتين.

### D) Scope check

لما تنفذ `workspace-detail` أو تغييرات:

- تحقق workspace_id موجود
- وتحقق app_id موجود في `app_registry` وغير `deprecated/disabled`

---

## ملاحظات تصميمية على الـ UI

- ممتاز إضافة “Reason required” في كل dialog.
- أنصح تضيف “Preview” بسيط قبل التنفيذ (حتى لو مو Draft/Confirm كاملة):
  - “This will: set plan to Pro, enable Bookivo, grant full access for 30 days…”
- وضروري تحط “Danger badge” للأشياء اللي تكسر الفوترة:
  - override plan
  - extend expiry

---

## نقطة مهمة جدًا: “App subscriptions” (Bookivo) لازم تكون عامة وقابلة للتوسع

بدل handler مخصوص `booking_subscriptions` فقط، الأفضل من البداية:

- `app_subscriptions` جدول عام:
  - workspace_id, app_id, plan_key, status, expires_at, source, metadata
- ثم Bookivo يكون مجرد `app_id='bookivo'`

إذا ما تبغون تغييرات DB الآن، اوكي خلي Bookivo خاص مؤقتًا، لكن صمّم endpoint بحيث:

- `set-app-subscription` يمر عبر adapter حسب app_id (حتى ما تعيد هندسة لاحقًا).