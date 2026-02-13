

# Make Booking Setup Wizard Production-Ready

## Current State Analysis

After reviewing the codebase, I found these gaps preventing the wizard from being truly functional:

| # | Issue | Impact |
|---|-------|--------|
| 1 | **No logo upload** in the Brand step -- `logo_url` column exists but there is no UI to upload a logo | High -- branding is incomplete |
| 2 | **No slug uniqueness check** -- DB has `UNIQUE` constraint but the UI does not warn until save fails | High -- confusing error |
| 3 | **Slug input is correct** -- already filters `[^a-z0-9-]` (letters, numbers, hyphens only) | OK |
| 4 | **No storage bucket** for booking logos/assets | Blocker for logo upload |
| 5 | **No live preview URL** shown after launch -- user does not know where to find their public site | Medium |
| 6 | **Settings page lacks quick-edit** -- after going live, no way to change logo or see public URL directly | Medium |

---

## Implementation Plan

### 1. Create Storage Bucket: `booking-assets`

Create a new public storage bucket `booking-assets` for tenant logos and branding images. Add a storage policy allowing authenticated workspace admins to upload/delete files scoped to their workspace folder (`{workspace_id}/*`).

### 2. Add Logo Upload to Wizard (Step 1: Brand)

Add a logo upload section to the Brand step in `BookingSetupWizard.tsx`:
- File input with image preview (max 2MB, jpg/png/webp)
- Uploads to `booking-assets/{workspace_id}/logo.{ext}`
- Stores the public URL in `logo_url` field
- Shows current logo if one exists
- Includes a "Remove" button

### 3. Real-Time Slug Availability Check

Add a debounced uniqueness check on the slug input (Step 4):
- Query `booking_settings` for existing `tenant_slug` (excluding current workspace)
- Show a green checkmark if available, red X if taken
- Block "Launch" button if slug is taken
- Use `useQuery` with debounced slug value

### 4. Show Full Public URL After Launch

Update `BookingSettingsPage.tsx`:
- After `is_live = true`, show the complete public URL as a clickable link: `https://{published-domain}/b/{tenant_slug}`
- Add a "Copy Link" button next to the URL
- Add an "Open Public Site" button that opens in a new tab

### 5. Database Migration

Add a storage bucket and policy via migration:
- Create `booking-assets` public bucket
- Add storage policies for authenticated upload/delete scoped to workspace

---

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/booking/LogoUpload.tsx` | Reusable logo upload component with preview, upload, and remove |
| Migration SQL | Storage bucket + policies |

### Files to Edit

| File | Changes |
|------|---------|
| `src/pages/apps/booking/BookingSetupWizard.tsx` | Add LogoUpload to Step 1; add slug availability check to Step 4 |
| `src/pages/apps/booking/BookingSettingsPage.tsx` | Show full public URL with copy/open buttons when live |
| `src/hooks/useBookingSettings.ts` | No changes needed -- already handles logo_url in upsert |

### Logo Upload Flow

```text
User selects file
  --> Validate (type: jpg/png/webp, size: < 2MB)
  --> Upload to booking-assets/{workspaceId}/logo-{timestamp}.{ext}
  --> Get public URL
  --> Update local wizard state (logo_url = publicURL)
  --> On wizard save, logo_url is persisted to booking_settings
```

### Slug Availability Check Pattern

```text
User types slug
  --> Debounce 500ms
  --> Query: SELECT id FROM booking_settings WHERE tenant_slug = :slug AND workspace_id != :currentWsId
  --> If row exists: show "Taken" indicator, disable Launch
  --> If no row: show "Available" indicator
```

### Settings Page Enhancement

After going live, the settings page will show:
- Public URL as a styled card with copy-to-clipboard
- "Open Public Site" button (opens `/b/{slug}` in new tab)
- Current logo preview with option to change
- Quick status indicator (Live / Draft)

