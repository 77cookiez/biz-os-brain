

# Fix Owner Console Reflection: End-to-End Subscription Override System

## Problem

The Owner Console creates overrides as `platform_grants` entries, but the user-facing hooks (`useBookingSubscription`, `useBilling`) only read the subscription tables directly. This means:

1. **OS Plan overrides are invisible** -- `useBilling` reads `billing_subscriptions` which is empty (no Stripe), and grants are never checked
2. **Bookivo overrides DO work** -- because `handleSetAppSubscription` writes to `booking_subscriptions` directly (adapter pattern), but this isn't consistent
3. **`billing_subscriptions` join with `billing_plans(*)` fails** -- no foreign key exists, causing workspace-detail to error

## Solution

Two-pronged fix:

**A) Fix the edge function `workspace-detail`** to not use the broken FK join
**B) Make user-facing hooks "grant-aware"** so overrides reflect immediately

---

## Technical Plan

### 1. Edge Function Fix: `workspace-detail` billing_plans join

**File:** `supabase/functions/platform-admin/index.ts`

Change the `billing_subscriptions` query from:
```
.select("*, billing_plans(*)")
```
to:
```
.select("*")
```

Then separately fetch the plan name from `billing_plans` if needed, or just return the raw subscription. The UI already resolves plan names from the `OS_PLANS` constant.

### 2. Make `useBilling` grant-aware (OS Plan reflection)

**File:** `src/hooks/useBilling.ts`

Add a query to check for active `platform_grants` with `grant_type = 'os_plan_override'` for the current workspace. The entitlement resolution order:

1. Check `platform_grants` for active `os_plan_override` (scope_id = workspace_id)
2. Fall back to `billing_subscriptions`
3. Default to "free"

This means:
- Query `platform_grants` where `scope = 'workspace'`, `scope_id = workspace_id`, `grant_type = 'os_plan_override'`, `is_active = true`, ordered by `created_at desc`, limit 1
- If found, use `value_json.plan_id` as the effective plan
- Expose `isOverride: boolean` and `overrideGrant` in the return value
- `currentPlan` resolves using the effective plan_id (grant or subscription)

### 3. Make `useBookingSubscription` grant-aware (Bookivo reflection)

**File:** `src/hooks/useBookingSubscription.ts`

This is less critical since the edge function already writes to `booking_subscriptions` directly. However, for consistency:
- Also check `platform_grants` for `app_plan_override` with `value_json->>'app_id' = 'booking'`
- If an override grant exists, treat subscription as active regardless of `booking_subscriptions` row status
- This provides a safety net if the `booking_subscriptions` write fails

### 4. Ensure `useFeatureGuard` respects overridden plans

**File:** `src/hooks/useFeatureGuard.ts`

Since `useFeatureGuard` depends on `useBilling().currentPlan`, once `useBilling` is grant-aware, feature guards will automatically respect overrides. No changes needed here.

### 5. OwnerWorkspaces UI: Fix plan name display

**File:** `src/pages/owner/OwnerWorkspaces.tsx`

Since the FK join is removed, `osSub?.billing_plans?.name` won't exist. Update to resolve plan name from the `OS_PLANS` constant or from `billing_plans` data fetched separately. The effective plan display already uses `osPlanOverride?.value_json?.plan_name` which works.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/platform-admin/index.ts` | Remove broken `billing_plans(*)` join in workspace-detail |
| `src/hooks/useBilling.ts` | Add platform_grants query for os_plan_override, resolve effective plan |
| `src/hooks/useBookingSubscription.ts` | Add platform_grants query for app_plan_override (booking), use as override |
| `src/pages/owner/OwnerWorkspaces.tsx` | Fix plan name resolution after removing FK join |

## Reflection Flow After Fix

```text
Owner sets override
      |
      v
platform_grants row created (+ booking_subscriptions for Bookivo)
      |
      v
User opens app
      |
      v
useBilling checks grants first --> finds os_plan_override --> resolves Pro/Business plan
useBookingSubscription checks booking_subscriptions --> finds active row (written by adapter)
      |
      v
Features unlocked, UI reflects correct plan
```

## Security

- No new RLS policies needed -- `platform_grants` is read via authenticated user queries
- Need to add an RLS SELECT policy on `platform_grants` for workspace members to read their own workspace grants (scope = 'workspace', scope_id = their workspace_id)
- This is safe because grants only contain plan overrides, not sensitive data

