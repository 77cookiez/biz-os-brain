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
    const domain =
      Deno.env.get("PUBLIC_BOOKING_BASE_URL") ||
      `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "").replace(".supabase.co", "")}.lovable.app`;

    const zip = new JSZip();

    // capacitor.config.json (shared)
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

    // app.json (shared)
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

    // branding/colors.json
    zip.file("branding/colors.json", JSON.stringify({ primary: primaryColor, accent: accentColor }, null, 2));

    if (platform === "ios") {
      generateIosPack(zip, { appName, slug, bundleId, domain, appDescription });
    } else {
      generateAndroidPack(zip, { appName, slug, bundleId, domain, appDescription });
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
}

function generateIosPack(zip: JSZip, ctx: PackContext) {
  zip.file("README.md", `# ${ctx.appName} — iOS App Pack

This pack contains everything needed to publish **${ctx.appName}** on the **Apple App Store**.

## Quick Start

1. Install [Node.js](https://nodejs.org/) (v18+)
2. Create a new Capacitor project:
   \`\`\`bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/ios
   \`\`\`
3. Copy \`config/capacitor.config.json\` to your project root
4. Copy the \`assets/\` folder to your project
5. Run:
   \`\`\`bash
   npx cap add ios
   npx cap sync ios
   \`\`\`
6. Open in Xcode: \`npx cap open ios\`
7. Replace the default app icon with \`assets/icon-1024.png\`
8. Build, archive, and submit!

## How It Works

This app is a native wrapper (WebView) around your live Bookivo site at:
**${ctx.domain}/b/${ctx.slug}**

Your customers get a native iOS app experience with your branding.
Any changes to your Bookivo settings update the app automatically.

## Files Included

- \`config/capacitor.config.json\` — Pre-configured Capacitor settings
- \`config/app.json\` — App metadata
- \`branding/colors.json\` — Your brand colors
- \`assets/icon-1024.png\` — Your app icon (1024×1024)
- \`guides/APPLE_STORE_GUIDE.md\` — Step-by-step publishing guide
`);

  zip.file("REQUIREMENTS.md", `# Requirements for iOS

Before you can publish your app on the Apple App Store:

- [ ] Apple Developer Account ($99/year) — [developer.apple.com](https://developer.apple.com)
- [ ] A Mac with Xcode installed (free from App Store)
- [ ] Node.js v18+ installed — [nodejs.org](https://nodejs.org)
- [ ] Your app icon (included in this pack as assets/icon-1024.png)

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
1. Install dependencies: \`npm install\`
2. Add iOS platform: \`npx cap add ios\`
3. Sync: \`npx cap sync ios\`
4. Open in Xcode: \`npx cap open ios\`

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
4. Add screenshots (take them from your Simulator)
5. Submit for review
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
}

function generateAndroidPack(zip: JSZip, ctx: PackContext) {
  zip.file("README.md", `# ${ctx.appName} — Android App Pack

This pack contains everything needed to publish **${ctx.appName}** on the **Google Play Store**.

## Quick Start

1. Install [Node.js](https://nodejs.org/) (v18+)
2. Create a new Capacitor project:
   \`\`\`bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   \`\`\`
3. Copy \`config/capacitor.config.json\` to your project root
4. Copy the \`assets/\` folder to your project
5. Run:
   \`\`\`bash
   npx cap add android
   npx cap sync android
   \`\`\`
6. Open in Android Studio: \`npx cap open android\`
7. Replace the default app icon with icons from \`assets/\`
8. Build a signed APK/AAB and submit!

## How It Works

This app is a native wrapper (WebView) around your live Bookivo site at:
**${ctx.domain}/b/${ctx.slug}**

Your customers get a native Android app experience with your branding.
Any changes to your Bookivo settings update the app automatically.

## Files Included

- \`config/capacitor.config.json\` — Pre-configured Capacitor settings
- \`config/app.json\` — App metadata
- \`branding/colors.json\` — Your brand colors
- \`assets/icon-1024.png\` — Source icon (use to generate adaptive icons)
- \`guides/GOOGLE_PLAY_GUIDE.md\` — Step-by-step publishing guide
`);

  zip.file("REQUIREMENTS.md", `# Requirements for Android

Before you can publish your app on the Google Play Store:

- [ ] Google Play Developer Account ($25 one-time) — [play.google.com/console](https://play.google.com/console)
- [ ] Android Studio installed — [developer.android.com/studio](https://developer.android.com/studio)
- [ ] Node.js v18+ installed — [nodejs.org](https://nodejs.org)
- [ ] Your app icon (included in this pack as assets/icon-1024.png)

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
1. Install dependencies: \`npm install\`
2. Add Android platform: \`npx cap add android\`
3. Sync: \`npx cap sync android\`
4. Open in Android Studio: \`npx cap open android\`

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
3. Upload your AAB file
4. Add screenshots (take them from your emulator)
5. Submit for review
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
}
