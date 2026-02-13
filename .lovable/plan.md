

# Bookivo: Self-Service Native App Packaging

## Current State

Today, when a tenant completes the wizard, they get:
- A web page at `/b/{slug}` with their branding (logo, colors)
- PWA capability (installable from browser)
- No native app (Apple/Google Play)

The wizard does NOT ask for:
- App name (e.g., "Ali's Wedding Services")
- App icon
- Splash screen
- App Store description
- Bundle ID / package name

There are NO "native files" generated today. The Capacitor config in the project is for the main OS app, not for individual tenants.

---

## What Needs to Be Built

A complete **App Builder** flow inside the wizard that:
1. Collects app identity (name, icon, splash, description)
2. Validates App Store requirements
3. Generates a **Handover Pack** (downloadable ZIP) containing everything needed to publish

---

## The Full User Journey

```text
Tenant signs up
  --> Installs Bookivo from Marketplace
  --> Runs Setup Wizard (5 existing steps)
  --> NEW Step 5: "Your App" (before Go Live)
  --> Enters: App Name, App Icon, Splash Screen, Short Description
  --> Goes Live (Step 6)
  --> Settings Page shows "Download App Pack" button
  --> Downloads ZIP with all files + instructions
  --> Follows guide to publish to App Store / Play Store
```

---

## Wizard Changes (Step 5: Your App)

### New fields to collect:

| Field | Required | Validation |
|-------|----------|------------|
| `app_name` | Yes | 3-30 characters, the display name on phone |
| `app_icon` | Yes | 1024x1024 PNG, no transparency (Apple requirement) |
| `splash_image` | No | 2732x2732 PNG for launch screen |
| `app_description` | Yes | 10-170 characters (App Store limit) |
| `bundle_id` | Auto-generated | `com.bookivo.{slug}` format |

### What the user sees:

- "What is your app called?" -- text input
- "Upload your app icon" -- image upload with live preview showing how it looks on a phone home screen (rounded corners preview)
- "App Store description" -- textarea with character counter
- Optional: Splash/launch screen upload
- Auto-generated Bundle ID shown as read-only: `com.bookivo.{tenant_slug}`

---

## Database Changes

New columns on `booking_settings`:

| Column | Type | Default |
|--------|------|---------|
| `app_name` | text | null |
| `app_icon_url` | text | null |
| `app_splash_url` | text | null |
| `app_description` | text | null |
| `app_bundle_id` | text | auto: `com.bookivo.{slug}` |

Assets stored in existing `booking-assets` bucket under `{workspace_id}/app-icon.png` and `{workspace_id}/splash.png`.

---

## Handover Pack (ZIP Download)

When the tenant clicks "Download App Pack" from Settings, the system generates a ZIP containing:

```text
bookivo-app-pack/
  README.md                    -- Step-by-step publishing guide
  REQUIREMENTS.md              -- What you need before starting
  config/
    capacitor.config.json      -- Pre-filled with tenant branding
    app.json                   -- App metadata
  assets/
    icon-1024.png              -- Original app icon
    icon-192.png               -- Auto-resized
    icon-512.png               -- Auto-resized
    splash-2732.png            -- Splash screen
  branding/
    colors.json                -- Primary/accent colors
    logo.png                   -- Business logo
  guides/
    APPLE_STORE_GUIDE.md       -- Step-by-step for iOS
    GOOGLE_PLAY_GUIDE.md       -- Step-by-step for Android
    DEVELOPER_ACCOUNT_SETUP.md -- How to create dev accounts
```

### The `capacitor.config.json` inside the pack:

```json
{
  "appId": "com.bookivo.{tenant_slug}",
  "appName": "{app_name}",
  "webDir": "dist",
  "server": {
    "url": "https://{domain}/b/{tenant_slug}",
    "cleartext": true
  }
}
```

This means the native app is essentially a **WebView wrapper** around their existing `/b/{slug}` public site, with their own icon and branding.

---

## Three Distribution Tiers (Already in Wizard UI)

| Tier | What It Is | How It Works |
|------|-----------|--------------|
| **PWA** (default, free) | Installable from browser | Already works today |
| **Container App** (Pro plan) | Native app shell pointing to `/b/{slug}` | Handover Pack with Capacitor config |
| **Enterprise App** (Enterprise plan) | Fully dedicated build with custom domain | Future: managed build service |

---

## Settings Page Improvements

After going live, the Settings page will show a new "Your App" card:

- Current app name + icon preview
- Edit button to change name/icon
- "Download App Pack" button (generates ZIP via edge function)
- Requirements checklist:
  - Apple Developer Account ($99/year)
  - Google Play Developer Account ($25 one-time)
  - Mac with Xcode (for iOS)
  - Node.js installed locally
- Link to full publishing guide

---

## Edge Function: `generate-app-pack`

A backend function that:
1. Reads tenant settings (name, slug, colors, icon, logo)
2. Downloads assets from storage
3. Generates resized icons (192px, 512px from 1024px source)
4. Creates `capacitor.config.json` with tenant values
5. Bundles README + guides + assets into a ZIP
6. Returns the ZIP as a download

---

## Implementation Plan

### Phase 1: Database + Wizard UI

1. **Migration**: Add `app_name`, `app_icon_url`, `app_splash_url`, `app_description`, `app_bundle_id` columns to `booking_settings`
2. **Wizard Step 5** ("Your App"): New step between Policies and Go Live
   - App name input with validation
   - App icon upload (reuse LogoUpload pattern, validate 1024x1024)
   - App description textarea with character counter
   - Auto-generated bundle ID display
   - Phone home screen preview showing icon + name
3. **i18n keys**: Add translations for all new wizard fields in all 5 languages
4. **Update totalSteps** from 5 to 6, shift Go Live to step 5

### Phase 2: Settings Page + Download

5. **Settings Page**: Add "Your App" card with icon preview, name, and edit capability
6. **Edge Function** (`generate-app-pack`): Generate and return ZIP with all configs and guides
7. **Markdown Guides**: Create publishing guides content (embedded in edge function)

### Phase 3: Validation Checklist

8. **Requirements Card**: Show what the user needs before they can publish
9. **Status indicators**: Show which requirements are met (icon uploaded, name set, etc.)

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/generate-app-pack/index.ts` | ZIP generation edge function |
| Migration SQL | Add app_* columns to booking_settings |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/apps/booking/BookingSetupWizard.tsx` | Add Step 5 (Your App), shift Go Live to Step 6, add app_name/icon/description fields |
| `src/pages/apps/booking/BookingSettingsPage.tsx` | Add "Your App" card with download button |
| `src/i18n/translations/*.json` (5 files) | Add wizard.app.* translation keys |

---

## What This Does NOT Do

- Does NOT auto-publish to App Store (requires developer accounts)
- Does NOT build the native binary (user runs Capacitor locally)
- Does NOT change existing routes, DB tables, or module IDs
- Does NOT require any external services

The output is a **ready-to-build pack** that a non-technical user can hand to any developer, or follow the step-by-step guide themselves if they have basic terminal knowledge.

