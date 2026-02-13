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

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from("booking_settings")
      .select("*")
      .eq("workspace_id", workspace_id)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Settings not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appName = settings.app_name || settings.tenant_slug || "My App";
    const slug = settings.tenant_slug || "app";
    const bundleId = settings.app_bundle_id || `com.bookivo.${slug}`;
    const primaryColor = settings.primary_color || "#6366f1";
    const accentColor = settings.accent_color || "#f59e0b";
    const appDescription = settings.app_description || "";
    const domain =
      Deno.env.get("PUBLIC_BOOKING_BASE_URL") ||
      `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "").replace(".supabase.co", "")}.lovable.app`;

    const zip = new JSZip();

    // capacitor.config.json
    const capacitorConfig = {
      appId: bundleId,
      appName: appName,
      webDir: "dist",
      server: {
        url: `${domain}/b/${slug}`,
        cleartext: true,
      },
    };
    zip.file(
      "config/capacitor.config.json",
      JSON.stringify(capacitorConfig, null, 2)
    );

    // app.json
    const appJson = {
      name: appName,
      slug: slug,
      bundleId: bundleId,
      description: appDescription,
      version: "1.0.0",
      primaryColor,
      accentColor,
    };
    zip.file("config/app.json", JSON.stringify(appJson, null, 2));

    // colors.json
    zip.file(
      "branding/colors.json",
      JSON.stringify({ primary: primaryColor, accent: accentColor }, null, 2)
    );

    // README
    zip.file(
      "README.md",
      `# ${appName} — App Pack

This pack contains everything needed to publish **${appName}** as a native app on Apple App Store and Google Play Store.

## Quick Start

1. Install [Node.js](https://nodejs.org/) (v18+)
2. Create a new Capacitor project:
   \`\`\`bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   \`\`\`
3. Copy \`config/capacitor.config.json\` to your project root
4. Copy the \`assets/\` folder to your project
5. Run:
   \`\`\`bash
   npx cap add ios
   npx cap add android
   npx cap sync
   \`\`\`
6. Open in Xcode (\`npx cap open ios\`) or Android Studio (\`npx cap open android\`)
7. Replace the default app icon with the ones from \`assets/\`
8. Build and submit!

## What This App Does

This app is a native wrapper (WebView) around your Bookivo public site at:
**${domain}/b/${slug}**

Your customers get a native app experience with your branding, while the content is served from your live Bookivo site.

## Files Included

- \`config/capacitor.config.json\` — Pre-configured Capacitor settings
- \`config/app.json\` — App metadata
- \`branding/colors.json\` — Your brand colors
- \`guides/\` — Step-by-step publishing guides

## Need Help?

Refer to the guides in the \`guides/\` folder for detailed instructions.
`
    );

    // REQUIREMENTS.md
    zip.file(
      "REQUIREMENTS.md",
      `# Requirements

Before you can publish your app, you'll need:

## For iOS (Apple App Store)
- [ ] Apple Developer Account ($99/year) — [developer.apple.com](https://developer.apple.com)
- [ ] A Mac with Xcode installed (free from App Store)
- [ ] Your app icon (included in this pack)

## For Android (Google Play Store)
- [ ] Google Play Developer Account ($25 one-time) — [play.google.com/console](https://play.google.com/console)
- [ ] Android Studio installed — [developer.android.com/studio](https://developer.android.com/studio)

## For Both
- [ ] Node.js v18+ installed — [nodejs.org](https://nodejs.org)
- [ ] Basic familiarity with terminal/command line

## Time Estimate
- iOS: ~2-3 hours (including Apple review wait time)
- Android: ~1-2 hours (Google review is faster)
`
    );

    // Apple Store Guide
    zip.file(
      "guides/APPLE_STORE_GUIDE.md",
      `# Publishing to Apple App Store

## Step 1: Set Up Your Developer Account
1. Go to [developer.apple.com](https://developer.apple.com)
2. Enroll in the Apple Developer Program ($99/year)
3. Wait for approval (usually 24-48 hours)

## Step 2: Prepare Your Project
1. Install dependencies: \`npm install\`
2. Add iOS platform: \`npx cap add ios\`
3. Sync: \`npx cap sync ios\`
4. Open in Xcode: \`npx cap open ios\`

## Step 3: Configure in Xcode
1. Set your Team (your Apple Developer account)
2. Set Bundle Identifier to: \`${bundleId}\`
3. Set Display Name to: \`${appName}\`
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
4. Add screenshots (take them from your Simulator)
5. Submit for review
`
    );

    // Google Play Guide
    zip.file(
      "guides/GOOGLE_PLAY_GUIDE.md",
      `# Publishing to Google Play Store

## Step 1: Set Up Your Developer Account
1. Go to [play.google.com/console](https://play.google.com/console)
2. Pay the one-time $25 registration fee
3. Complete your developer profile

## Step 2: Prepare Your Project
1. Install dependencies: \`npm install\`
2. Add Android platform: \`npx cap add android\`
3. Sync: \`npx cap sync android\`
4. Open in Android Studio: \`npx cap open android\`

## Step 3: Configure in Android Studio
1. Verify the package name is: \`${bundleId}\`
2. Replace the default icon with your icon from \`assets/\`
3. Update \`app/src/main/res/values/strings.xml\` with app name: \`${appName}\`

## Step 4: Build a Release APK/AAB
1. Build → Generate Signed Bundle/APK
2. Create a new keystore (save it securely!)
3. Build the AAB (Android App Bundle)

## Step 5: Upload to Play Console
1. Create a new app in Play Console
2. Fill in the store listing using info from \`config/app.json\`
3. Upload your AAB file
4. Add screenshots
5. Submit for review
`
    );

    // Developer Account Setup Guide
    zip.file(
      "guides/DEVELOPER_ACCOUNT_SETUP.md",
      `# Setting Up Developer Accounts

## Apple Developer Account
- **Cost**: $99/year
- **URL**: [developer.apple.com](https://developer.apple.com)
- **Requirements**: Apple ID, valid payment method
- **Approval time**: 24-48 hours
- **Note**: You need a Mac to build and submit iOS apps

## Google Play Developer Account
- **Cost**: $25 one-time
- **URL**: [play.google.com/console](https://play.google.com/console)
- **Requirements**: Google account, valid payment method
- **Approval time**: Usually instant
- **Note**: You can build on any OS (Windows, Mac, Linux)

## Tips
- Use a business email for both accounts
- Keep your signing keys/certificates in a secure location
- Both stores require screenshots — take them from your simulator/emulator
`
    );

    // Try to download the app icon if available
    if (settings.app_icon_url) {
      try {
        const iconRes = await fetch(settings.app_icon_url);
        if (iconRes.ok) {
          const iconData = await iconRes.arrayBuffer();
          zip.file("assets/icon-1024.png", iconData);
        }
      } catch {
        // Non-fatal
      }
    }

    // Try to download the logo if available
    if (settings.logo_url) {
      try {
        const logoRes = await fetch(settings.logo_url);
        if (logoRes.ok) {
          const logoData = await logoRes.arrayBuffer();
          zip.file("branding/logo.png", logoData);
        }
      } catch {
        // Non-fatal
      }
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bookivo-app-pack-${slug}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error generating app pack:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
