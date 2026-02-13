import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspace_id, platform } = await req.json();
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!platform || !["ios", "android"].includes(platform)) {
      return new Response(
        JSON.stringify({ error: "platform must be 'ios' or 'android'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("booking_settings")
      .select("*")
      .eq("workspace_id", workspace_id)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Settings not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appName = settings.app_name || settings.tenant_slug || "My App";
    const slug = settings.tenant_slug || "app";
    const bundleId = settings.app_bundle_id || `com.bookivo.${slug}`;
    const primaryColor = settings.primary_color || "#6366f1";
    const accentColor = settings.accent_color || "#f59e0b";
    const appDescription = settings.app_description || "";
    const appKeywords = settings.app_keywords || "";
    const appSupportEmail = settings.app_support_email || "";
    const appPrivacyUrl = settings.app_privacy_url || "";
    const appVersion = settings.app_version || "1.0.0";
    const appBuildNumber = settings.app_build_number || 1;
    const domain =
      Deno.env.get("PUBLIC_BOOKING_BASE_URL") ||
      `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "").replace(".supabase.co", "")}.lovable.app`;

    const zip = new JSZip();

    const capacitorConfig = {
      appId: bundleId,
      appName: appName,
      webDir: "dist",
      server: {
        url: `${domain}/b/${slug}`,
        cleartext: true,
      },
    };
    zip.file("config/capacitor.config.json", JSON.stringify(capacitorConfig, null, 2));

    const appJson = {
      name: appName,
      slug: slug,
      bundleId: bundleId,
      description: appDescription,
      keywords: appKeywords,
      supportEmail: appSupportEmail,
      privacyUrl: appPrivacyUrl,
      version: appVersion,
      buildNumber: appBuildNumber,
      primaryColor,
      accentColor,
    };
    zip.file("config/app.json", JSON.stringify(appJson, null, 2));

    zip.file("branding/colors.json", JSON.stringify({ primary: primaryColor, accent: accentColor }, null, 2));

    // Shared files
    generateSecurityMd(zip);
    generateTroubleshootingMd(zip, platform);

    if (platform === "ios") {
      generateIosPack(zip, { appName, slug, bundleId, domain, appDescription, appKeywords, appSupportEmail, appPrivacyUrl, appVersion });
    } else {
      generateAndroidPack(zip, { appName, slug, bundleId, domain, appDescription, appKeywords, appSupportEmail, appPrivacyUrl, appVersion });
    }

    // Download icon if available
    if (settings.app_icon_url) {
      try {
        const iconRes = await fetch(settings.app_icon_url);
        if (iconRes.ok) {
          const iconData = await iconRes.arrayBuffer();
          zip.file("assets/icon-1024.png", iconData);
        }
      } catch { /* Non-fatal */ }
    }

    // Download logo if available
    if (settings.logo_url) {
      try {
        const logoRes = await fetch(settings.logo_url);
        if (logoRes.ok) {
          const logoData = await logoRes.arrayBuffer();
          zip.file("branding/logo.png", logoData);
        }
      } catch { /* Non-fatal */ }
    }

    const zipBlob = await zip.generateAsync({ type: "uint8array" });
    const filename = `bookivo-${platform}-pack-${slug}.zip`;

    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating app pack:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface PackContext {
  appName: string;
  slug: string;
  bundleId: string;
  domain: string;
  appDescription: string;
  appKeywords: string;
  appSupportEmail: string;
  appPrivacyUrl: string;
  appVersion: string;
}

function generateSecurityMd(zip: JSZip) {
  zip.file("SECURITY.md", `# Security Notice

## What Bookivo Does NOT Store
- ❌ Apple Developer passwords or credentials
- ❌ Google Play Console credentials
- ❌ Code signing keys or certificates
- ❌ Keystore files or provisioning profiles

## What This Pack Contains
- ✅ Pre-configured Capacitor project settings
- ✅ Your app metadata (name, description, colors)
- ✅ Your uploaded assets (icon, logo)
- ✅ Publishing guides and instructions

## Your Responsibility
- Keep your signing keys secure and backed up
- Never share your developer account credentials
- Use a strong, unique password for your developer accounts
- Enable two-factor authentication on all developer accounts

## Data Privacy
This pack contains only the configuration and assets you provided in your Bookivo settings.
No user data, analytics, or tracking is embedded in this pack.
`);
}

function generateTroubleshootingMd(zip: JSZip, platform: string) {
  const platformSpecific = platform === "ios"
    ? `
## iOS-Specific Issues

### "No signing certificate" error
1. Open Xcode → Preferences → Accounts
2. Sign in with your Apple Developer account
3. Xcode will automatically manage certificates

### "Provisioning profile" errors
1. In Xcode, go to Signing & Capabilities
2. Enable "Automatically manage signing"
3. Select your team

### Build fails on M1/M2 Mac
Run: \`sudo arch -x86_64 gem install ffi\`
Then try building again.
`
    : `
## Android-Specific Issues

### "SDK not found" error
1. Open Android Studio → SDK Manager
2. Install the latest Android SDK
3. Set ANDROID_HOME environment variable

### Keystore issues
1. Generate a new keystore: \`keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000\`
2. Store it securely — you cannot recover a lost keystore

### Build fails with memory error
Add to \`gradle.properties\`: \`org.gradle.jvmargs=-Xmx4096m\`
`;

  zip.file("TROUBLESHOOTING.md", `# Troubleshooting Guide

## Common Issues

### "npm install" fails
- Make sure you have Node.js v18+ installed
- Try deleting \`node_modules\` and \`package-lock.json\`, then run \`npm install\` again
- On Mac, you may need to run: \`sudo npm install\`

### "cap sync" fails
- Run \`npx cap sync\` (not \`cap sync\` directly)
- Make sure capacitor.config.json is in your project root
- Check that @capacitor/core is installed

### App shows blank screen
- Verify the URL in capacitor.config.json is correct and accessible
- Check your internet connection
- Try opening the URL directly in a browser first

### App icon not showing
- Make sure icon-1024.png is at least 1024×1024 pixels
- For iOS: no transparency allowed (use solid background)
- For Android: use the Asset Studio in Android Studio to generate adaptive icons
${platformSpecific}

## Still Stuck?
- Check the platform-specific guide in the \`guides/\` folder
- Visit [Capacitor Docs](https://capacitorjs.com/docs)
- Contact Bookivo support
`);
}

function generateCloudBuildGuideMd(zip: JSZip, platform: string) {
  if (platform === "ios") {
    zip.file("CLOUD_BUILD_GUIDE.md", `# Cloud Build Guide (iOS)

## Option 1: EAS Build (Recommended)
Expo Application Services can build your iOS app in the cloud.

1. Install EAS CLI: \`npm install -g eas-cli\`
2. Login: \`eas login\`
3. Configure: \`eas build:configure\`
4. Build: \`eas build --platform ios\`

**Note:** You still need an Apple Developer Account for signing.

## Option 2: GitHub Actions
Set up a GitHub Actions workflow with a macOS runner:
- Use \`macos-latest\` runner
- Install Xcode and certificates via fastlane
- Archive and upload to App Store Connect

## Option 3: Mac in the Cloud
Services like MacStadium or AWS EC2 Mac instances let you
rent a Mac for building without owning one.

## Important
- All options require an Apple Developer Account ($99/year)
- You must provide your signing certificates
- Bookivo never handles your signing keys
`);
  } else {
    zip.file("CLOUD_BUILD_GUIDE.md", `# Cloud Build Guide (Android)

## Option 1: EAS Build (Recommended)
Expo Application Services can build your Android app in the cloud.

1. Install EAS CLI: \`npm install -g eas-cli\`
2. Login: \`eas login\`
3. Configure: \`eas build:configure\`
4. Build: \`eas build --platform android\`

## Option 2: GitHub Actions
Set up a GitHub Actions workflow:
- Use \`ubuntu-latest\` runner
- Install Java and Android SDK
- Build AAB with Gradle

## Option 3: Local Build (Any OS)
Android apps can be built on Windows, Mac, or Linux:
1. Install Android Studio
2. Open the project
3. Build → Generate Signed Bundle/APK

## Important
- You need a Google Play Developer Account ($25 one-time)
- Generate and securely store your keystore file
- Bookivo never handles your signing keys
`);
  }
}

function generateSetupScript(zip: JSZip, platform: string) {
  const script = `#!/bin/bash
# Bookivo App Setup Script
# This script sets up your development environment

set -e

echo "🚀 Setting up Bookivo ${platform === "ios" ? "iOS" : "Android"} project..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Initialize project
echo "📦 Installing dependencies..."
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/${platform === "ios" ? "ios" : "android"}

# Copy config
echo "📋 Copying configuration..."
cp config/capacitor.config.json ./capacitor.config.json

# Add platform
echo "📱 Adding ${platform === "ios" ? "iOS" : "Android"} platform..."
npx cap add ${platform === "ios" ? "ios" : "android"}
npx cap sync ${platform === "ios" ? "ios" : "android"}

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
${platform === "ios"
    ? 'echo "  1. Run: npx cap open ios"\necho "  2. Set your Team in Xcode"\necho "  3. Build and run!"'
    : 'echo "  1. Run: npx cap open android"\necho "  2. Build → Generate Signed Bundle/APK"\necho "  3. Upload to Play Console!"'
}
`;
  zip.file("scripts/setup.sh", script);
}

function generateIosPack(zip: JSZip, ctx: PackContext) {
  zip.file("README.md", `# ${ctx.appName} — iOS App Pack

This pack contains everything needed to publish **${ctx.appName}** on the **Apple App Store**.

## Quick Start

1. Run the setup script: \`bash scripts/setup.sh\`

   Or manually:
   \`\`\`bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/ios
   cp config/capacitor.config.json ./capacitor.config.json
   npx cap add ios
   npx cap sync ios
   \`\`\`

2. Open in Xcode: \`npx cap open ios\`
3. Replace the default app icon with \`assets/icon-1024.png\`
4. Build, archive, and submit!

## How It Works

This app is a native wrapper (WebView) around your live Bookivo site at:
**${ctx.domain}/b/${ctx.slug}**

Your customers get a native iOS app experience with your branding.
Any changes to your Bookivo settings update the app automatically.

## Files Included

- \`config/capacitor.config.json\` — Pre-configured Capacitor settings
- \`config/app.json\` — App metadata (name, keywords, version)
- \`branding/colors.json\` — Your brand colors
- \`assets/icon-1024.png\` — Your app icon (1024×1024)
- \`guides/APPLE_STORE_GUIDE.md\` — Step-by-step publishing guide
- \`SECURITY.md\` — Security and data privacy notice
- \`TROUBLESHOOTING.md\` — Common issues and solutions
- \`CLOUD_BUILD_GUIDE.md\` — Build without a local Mac
- \`scripts/setup.sh\` — Automated setup script
`);

  zip.file("REQUIREMENTS.md", `# Requirements for iOS

Before you can publish your app on the Apple App Store:

- [ ] Apple Developer Account ($99/year) — [developer.apple.com](https://developer.apple.com)
- [ ] A Mac with Xcode installed (free from App Store)
- [ ] Node.js v18+ installed — [nodejs.org](https://nodejs.org)
- [ ] Your app icon (included in this pack as assets/icon-1024.png)
${ctx.appPrivacyUrl ? `- [ ] Privacy policy at: ${ctx.appPrivacyUrl}` : "- [ ] A privacy policy URL (required by Apple)"}
${ctx.appSupportEmail ? `- [ ] Support email: ${ctx.appSupportEmail}` : "- [ ] A support email address"}

## Important Notes
- You **must** use a Mac to build and submit iOS apps
- Apple requires app icons to have **no transparency** (use solid backgrounds)
- Rounded corners are added automatically by iOS — do not round them yourself
- Apple review typically takes 24-48 hours

## Time Estimate
~2-3 hours (including Apple review wait time)
`);

  zip.file("guides/APPLE_STORE_GUIDE.md", `# Publishing to Apple App Store

## Step 1: Set Up Your Developer Account
1. Go to [developer.apple.com](https://developer.apple.com)
2. Enroll in the Apple Developer Program ($99/year)
3. Wait for approval (usually 24-48 hours)

## Step 2: Prepare Your Project
1. Run: \`bash scripts/setup.sh\` (or install manually — see README)
2. Open in Xcode: \`npx cap open ios\`

## Step 3: Configure in Xcode
1. Set your Team (your Apple Developer account)
2. Set Bundle Identifier to: \`${ctx.bundleId}\`
3. Set Display Name to: \`${ctx.appName}\`
4. Replace AppIcon in Assets.xcassets with your icon from \`assets/\`

## Step 4: Archive and Upload
1. Select "Any iOS Device" as build target
2. Product → Archive
3. Window → Organizer → Distribute App
4. Choose "App Store Connect"
5. Upload

## Step 5: Submit for Review
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app
3. Fill in the details using info from \`config/app.json\`
${ctx.appKeywords ? `4. Keywords: ${ctx.appKeywords}` : "4. Add relevant keywords"}
5. Add screenshots (take them from your Simulator)
6. Submit for review
`);

  zip.file("guides/DEVELOPER_ACCOUNT_SETUP.md", `# Setting Up Apple Developer Account

- **Cost**: $99/year
- **URL**: [developer.apple.com](https://developer.apple.com)
- **Requirements**: Apple ID, valid payment method
- **Approval time**: 24-48 hours
- **Note**: You need a Mac to build and submit iOS apps

## Tips
- Use a business email for your account
- Keep your signing certificates in a secure location
- Take screenshots from your Simulator for the App Store listing
`);

  generateCloudBuildGuideMd(zip, "ios");
  generateSetupScript(zip, "ios");
}

function generateAndroidPack(zip: JSZip, ctx: PackContext) {
  zip.file("README.md", `# ${ctx.appName} — Android App Pack

This pack contains everything needed to publish **${ctx.appName}** on the **Google Play Store**.

## Quick Start

1. Run the setup script: \`bash scripts/setup.sh\`

   Or manually:
   \`\`\`bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   cp config/capacitor.config.json ./capacitor.config.json
   npx cap add android
   npx cap sync android
   \`\`\`

2. Open in Android Studio: \`npx cap open android\`
3. Replace the default app icon with icons from \`assets/\`
4. Build a signed APK/AAB and submit!

## How It Works

This app is a native wrapper (WebView) around your live Bookivo site at:
**${ctx.domain}/b/${ctx.slug}**

Your customers get a native Android app experience with your branding.
Any changes to your Bookivo settings update the app automatically.

## Files Included

- \`config/capacitor.config.json\` — Pre-configured Capacitor settings
- \`config/app.json\` — App metadata (name, keywords, version)
- \`branding/colors.json\` — Your brand colors
- \`assets/icon-1024.png\` — Source icon (use to generate adaptive icons)
- \`guides/GOOGLE_PLAY_GUIDE.md\` — Step-by-step publishing guide
- \`SECURITY.md\` — Security and data privacy notice
- \`TROUBLESHOOTING.md\` — Common issues and solutions
- \`CLOUD_BUILD_GUIDE.md\` — Build in the cloud
- \`scripts/setup.sh\` — Automated setup script
`);

  zip.file("REQUIREMENTS.md", `# Requirements for Android

Before you can publish your app on the Google Play Store:

- [ ] Google Play Developer Account ($25 one-time) — [play.google.com/console](https://play.google.com/console)
- [ ] Android Studio installed — [developer.android.com/studio](https://developer.android.com/studio)
- [ ] Node.js v18+ installed — [nodejs.org](https://nodejs.org)
- [ ] Your app icon (included in this pack as assets/icon-1024.png)
${ctx.appPrivacyUrl ? `- [ ] Privacy policy at: ${ctx.appPrivacyUrl}` : "- [ ] A privacy policy URL (required by Google)"}
${ctx.appSupportEmail ? `- [ ] Support email: ${ctx.appSupportEmail}` : "- [ ] A support email address"}

## Important Notes
- Android Studio works on **Windows, Mac, and Linux**
- You do NOT need a Mac for Android development
- Google Play review is typically faster than Apple (hours, not days)
- Use Android App Bundle (AAB) format for submission (not APK)

## Time Estimate
~1-2 hours (Google review is usually fast)
`);

  zip.file("guides/GOOGLE_PLAY_GUIDE.md", `# Publishing to Google Play Store

## Step 1: Set Up Your Developer Account
1. Go to [play.google.com/console](https://play.google.com/console)
2. Pay the one-time $25 registration fee
3. Complete your developer profile

## Step 2: Prepare Your Project
1. Run: \`bash scripts/setup.sh\` (or install manually — see README)
2. Open in Android Studio: \`npx cap open android\`

## Step 3: Configure in Android Studio
1. Verify the package name is: \`${ctx.bundleId}\`
2. Replace the default icon with your icon from \`assets/\`
3. Update \`app/src/main/res/values/strings.xml\` with app name: \`${ctx.appName}\`

## Step 4: Build a Release AAB
1. Build → Generate Signed Bundle/APK
2. Choose "Android App Bundle"
3. Create a new keystore (save it securely!)
4. Build the AAB

## Step 5: Upload to Play Console
1. Create a new app in Play Console
2. Fill in the store listing using info from \`config/app.json\`
${ctx.appKeywords ? `3. Keywords: ${ctx.appKeywords}` : "3. Add relevant keywords"}
4. Upload your AAB file
5. Add screenshots (take them from your emulator)
6. Submit for review
`);

  zip.file("guides/DEVELOPER_ACCOUNT_SETUP.md", `# Setting Up Google Play Developer Account

- **Cost**: $25 one-time
- **URL**: [play.google.com/console](https://play.google.com/console)
- **Requirements**: Google account, valid payment method
- **Approval time**: Usually instant
- **Note**: You can build on any OS (Windows, Mac, Linux)

## Tips
- Use a business email for your account
- Keep your signing keystore in a secure location
- Take screenshots from your emulator for the Play Store listing
`);

  generateCloudBuildGuideMd(zip, "android");
  generateSetupScript(zip, "android");
}
