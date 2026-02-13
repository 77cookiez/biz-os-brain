

# Bookivo: Split App Packs (iOS / Android) + Web Clarification

## Understanding the Current Situation

### How the Web/Landing Page Works
The native app is a **WebView wrapper** -- it opens your existing Bookivo web page (`/b/{slug}`) inside a native app shell. There are NO separate "web files" to upload. When a customer opens the native app, it loads your live Bookivo site automatically. So:

- You do NOT need to upload any web files anywhere
- The URL (`/b/{slug}`) is already live and working
- The native app simply wraps that URL with your icon and branding
- Any changes you make to your Bookivo settings update the app automatically (no re-publishing needed)

### Current App Pack Problem
Right now there is ONE download button that generates a single ZIP containing files for BOTH platforms mixed together. This is confusing because:
- iOS requires a Mac + Xcode + Apple Developer Account ($99/year)
- Android requires Android Studio + Google Play Account ($25 one-time)
- The requirements, guides, and config files are different for each platform
- A user might only want to publish on ONE platform

---

## The Plan: Separate iOS and Android Packs

### Settings Page Changes
Replace the single "Download App Pack" button with TWO separate buttons:

1. **Download for Apple App Store** (with Apple icon)
   - Shows iOS-specific requirements below it
   - Downloads: `bookivo-ios-pack-{slug}.zip`

2. **Download for Google Play Store** (with Android/Play icon)
   - Shows Android-specific requirements below it
   - Downloads: `bookivo-android-pack-{slug}.zip`

### Edge Function Changes
Update `generate-app-pack` to accept a `platform` parameter (`ios` or `android`) and generate platform-specific packs:

**iOS Pack contents:**
```
bookivo-ios-pack/
  README.md                    -- iOS-specific quick start
  REQUIREMENTS.md              -- Apple-only requirements
  capacitor.config.json        -- Pre-filled config
  app.json                     -- App metadata
  assets/
    icon-1024.png              -- App icon (Apple requires 1024x1024, no transparency)
  branding/
    colors.json                -- Brand colors
    logo.png                   -- Business logo
  guides/
    APPLE_STORE_GUIDE.md       -- Detailed step-by-step for App Store Connect
    DEVELOPER_ACCOUNT_SETUP.md -- Apple Developer Account setup only
```

**Android Pack contents:**
```
bookivo-android-pack/
  README.md                    -- Android-specific quick start
  REQUIREMENTS.md              -- Google-only requirements
  capacitor.config.json        -- Pre-filled config
  app.json                     -- App metadata
  assets/
    icon-1024.png              -- App icon source
    icon-192.png               -- Android adaptive icon
    icon-512.png               -- Play Store listing
  branding/
    colors.json                -- Brand colors
    logo.png                   -- Business logo
  guides/
    GOOGLE_PLAY_GUIDE.md       -- Detailed step-by-step for Play Console
    DEVELOPER_ACCOUNT_SETUP.md -- Google Play Account setup only
```

### Requirements Display
Each button will show its own checklist:

**Apple button area:**
- Apple Developer Account ($99/year)
- Mac with Xcode installed
- Node.js v18+

**Android button area:**
- Google Play Developer Account ($25 one-time)
- Android Studio (works on Windows, Mac, or Linux)
- Node.js v18+

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-app-pack/index.ts` | Accept `platform` param, generate platform-specific ZIP with tailored README, requirements, and guides |
| `src/pages/apps/booking/BookingSettingsPage.tsx` | Replace single download button with two platform-specific buttons (Apple + Android), each with its own requirements checklist |
| `src/i18n/translations/en.json` | Add keys for iOS/Android button labels and requirements |
| `src/i18n/translations/ar.json` | Arabic translations for new keys |
| `src/i18n/translations/fr.json` | French translations |
| `src/i18n/translations/de.json` | German translations |
| `src/i18n/translations/es.json` | Spanish translations |

## What Will NOT Change
- Database schema (no migrations)
- Wizard flow stays the same
- Routes unchanged
- The web approach stays URL-based (no file uploads needed)

