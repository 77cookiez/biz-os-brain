Act as a senior staff full-stack engineer.

TASK

Implement “SafeBack” as a standalone Marketplace app module, reusing the existing Recovery & Backup backend with ZERO duplication. Keep /settings/recovery working exactly as-is (deep-link stays). SafeBack is a normal marketplace app (installed like any other app). The settings page is NOT gated by install.

HARD RULES

- Do NOT change backend tables/RPCs/edge functions (reuse existing recovery backend).

- Do NOT modify AppInstalledGate component.

- Do NOT duplicate hooks: keep src/hooks/useRecovery.ts as the single source of truth.

- All state-changing actions must preserve current behavior.

- Must compile, fully responsive, dark-mode-first.

- Use ULL meaning-first where applicable (don’t render meaning-protected text directly).

- Admin-only access: SafeBack pages check is_workspace_admin (same behavior as RecoverySettingsPage).

- member_readonly is Phase 2 (no RLS migrations now).

DESIGN / BRANDING (SafeBack)

- App ID: safeback

- Name: SafeBack

- Icon: Lucide ShieldCheck

- Primary: #3B82F6 (Electric Blue)

- Accent: #10B981 (Emerald)

- Scope branding to .safeback-app wrapper using CSS custom properties:

  --safeback-primary, --safeback-accent

No global theme changes.

DATABASE (ONE MIGRATION, IDEMPOTENT)

Create a single migration that is safe to run multiple times:

1) Upsert app_registry row:

   id='safeback'

   name='SafeBack'

   description='Workspace snapshots, scheduled backups, and safe point-in-time restore'

   icon='shield-check'

   pricing='free'

   status='available'

   capabilities=['snapshot','restore','scheduled_backup','export','retention','compliance']

2) Deprecate old row safely:

   UPDATE app_registry SET status='deprecated'

   WHERE id='recovery' AND status <> 'deprecated';

If your SQL dialect supports ON CONFLICT, use it. Otherwise do a “INSERT if not exists” pattern.

ROUTES (UNDER PROTECTED <OSLayout/>)

Add:

 /apps/safeback -> AppInstalledGate('safeback') -> SafeBackLayout -> Outlet routes:

   index        -> SafeBackOverview

   snapshots    -> SafeBackSnapshots

   schedules    -> SafeBackSchedules

   exports      -> SafeBackExports

   policies     -> SafeBackPolicies

   audit        -> SafeBackAudit

   settings     -> SafeBackSettings

IMPORTANT GATING BEHAVIOR

- /apps/safeback/* is gated by app install.

- /settings/recovery remains accessible to workspace admins regardless of safeback installation.

- For safeback install gate message, if possible via existing props/slots, display:

  “Install SafeBack to access advanced backup console. Basic recovery settings are available in Settings.”

FILES TO CREATE (22)

A) Manifest / Lib

1) src/apps/safeback/manifest.ts

   - appId='safeback'

   - route base '/apps/safeback'

   - tabs config

   - branding constants

B) Components (extracted from RecoverySettingsPage and new panels)

2)  src/apps/safeback/components/SafeBackLayout.tsx

3)  src/apps/safeback/components/OverviewPanel.tsx

4)  src/apps/safeback/components/OnboardingChecklist.tsx

5)  src/apps/safeback/components/PlansUpsell.tsx

6)  src/apps/safeback/components/SnapshotsList.tsx

7)  src/apps/safeback/components/RestoreWizard.tsx

8)  src/apps/safeback/components/ScheduleSettings.tsx

9)  src/apps/safeback/components/ExportsPanel.tsx

10) src/apps/safeback/components/PoliciesPanel.tsx

11) src/apps/safeback/components/AuditLogPanel.tsx

12) src/apps/safeback/components/AppSettingsPanel.tsx

C) Pages

13) src/apps/safeback/pages/SafeBackOverview.tsx

14) src/apps/safeback/pages/SafeBackSnapshots.tsx

15) src/apps/safeback/pages/SafeBackSchedules.tsx

16) src/apps/safeback/pages/SafeBackExports.tsx

17) src/apps/safeback/pages/SafeBackPolicies.tsx

18) src/apps/safeback/pages/SafeBackAudit.tsx

19) src/apps/safeback/pages/SafeBackSettings.tsx

D) Hooks

20) src/apps/safeback/lib/hooks.ts

   - re-export everything from src/hooks/useRecovery.ts

   - add new hook useAuditLogs (see below)

E) Styling (if needed)

21) src/apps/safeback/styles.css (optional; only if your project uses per-app css import)

22) src/apps/safeback/index.ts (optional barrel export)

FILES TO MODIFY (5)

1) src/App.tsx

   - add the SafeBack route group under existing protected routes

   - ensure it uses AppInstalledGate('safeback') and SafeBackLayout with nested routes above

2) src/pages/settings/RecoverySettingsPage.tsx

   - Extract these blocks into components imported from src/apps/safeback/components:

     a) ScheduleSettings (previous lines ~140–197)

     b) SnapshotsList     (previous lines ~219–278)

     c) RestoreWizard     (previous lines ~282–370)

   - Keep ALL logic identical; only refactor UI into components.

   - Add a top banner CTA:

     Text: “For advanced backup management, open SafeBack”

     Button: “Open SafeBack”

     Link to: /apps/safeback

   - Do not gate this page by safeback install.

3) src/i18n/translations/en.json

   - Add keys under:

     apps.safeback.*

     settings.recovery.openSafebackCta.*

   Include: tabs labels, overview labels, onboarding steps, plans table headings, audit labels, CTA text.

4) src/i18n/translations/ar.json

   - Arabic equivalents for the same keys (proper Arabic).

5) src/test/recovery.test.ts

   Add test groups:

   - Manifest exports correct constants (appId, route base, tab ids)

   - Admin access gate: non-admin mock sees locked UI on /apps/safeback/*

   - Onboarding localStorage key: 'safeback:onboarding:v1:<workspaceId>'

   - Audit log filter: uses action namespace strings snapshot/restore/backup

   - Deep-link preservation: /settings/recovery works for admins even if safeback not installed

   - Install gating: /apps/safeback blocked if not installed; allowed when installed mock

SAFE BACK LAYOUT (TABS)

Follow BookingLayout pattern: horizontal NavLink tabs + Outlet. 7 tabs:

- Overview  (LayoutDashboard) route: /apps/safeback

- Snapshots (Database)        route: /apps/safeback/snapshots

- Schedules (Clock)          route: /apps/safeback/schedules

- Exports   (Download)       route: /apps/safeback/exports

- Policies  (Shield)         route: /apps/safeback/policies

- Audit     (FileText)       route: /apps/safeback/audit

- Settings  (Settings)       route: /apps/safeback/settings

OVERVIEW PAGE CONTENT

- OverviewPanel: Status card with:

  last snapshot timestamp, backup enabled badge, retention count, total snapshots

- Quick Actions:

  Create Snapshot, View Schedules, Export Latest (use existing recovery hooks/actions)

- OnboardingChecklist (collapsible + dismissible)

- PlansUpsell (UI only) at bottom

ONBOARDING CHECKLIST

- Stored in localStorage key: safeback:onboarding:v1:<workspaceId>

- Steps:

  1 Enable automatic backups -> link to /schedules

  2 Set retention policy     -> link to /policies

  3 Create first snapshot    -> link to /snapshots

  4 Test restore preview     -> link to /snapshots (open RestoreWizard preview)

  5 Export a snapshot        -> link to /exports

- Each completed step shows check.

- “Don’t show again” persists.

PLANS UPSELL (UI ONLY, NO BILLING)

3-column comparison (Free/Pro/Enterprise) exactly:

- Manual snapshots: Yes/Yes/Yes

- Restore with confirmation phrase: Yes/Yes/Yes

- Pre-restore safety snapshot: Yes/Yes/Yes

- Scheduled backups: —/Yes/Yes

- Higher retention (60+): —/Yes/Yes

- Storage export: —/Yes/Yes

- Compliance reports: —/—/Yes

- DR drills: —/—/Yes

- Immutable backups: —/—/Yes

RESTORE WIZARD (CRITICAL UX + SAFETY)

- 2-step flow: Preview -> Confirm

- Require confirmation phrase (same as existing recovery UI)

- BEFORE restore execution, automatically create a “safety snapshot” (if backend supports; otherwise keep UI-only note and ensure audit logs reflect safety snapshot when available).

- Write/Show audit entries in Audit tab.

AUDIT LOG PANEL

- Create useAuditLogs hook that queries existing audit_logs table (or equivalent):

  Filters:

    workspace_id = current workspace

    action LIKE 'workspace.snapshot_%'

    OR action LIKE 'workspace.restore_%'

    OR action LIKE 'workspace.backup_%'

  (If entity_type exists and is reliable, also allow entity_type IN (...))

- Render: timestamp, action, actor (name/email if exists else user_id with copy), entity_id, metadata summary

- Newest first + pagination

I18N KEYING BEST PRACTICE

Use keys:

- apps.safeback.title/subtitle

- apps.safeback.tabs.overview/snapshots/schedules/exports/policies/audit/settings

- apps.safeback.overview.*

- apps.safeback.onboarding.*

- apps.safeback.plans.*

- apps.safeback.audit.*

- settings.recovery.openSafebackCta.title/body/button

DO NOT BREAK EXISTING RECOVERY SETTINGS PAGE

- Preserve behavior 1:1

- Only refactor into imported components + add CTA banner

FINAL OUTPUT

- Implement all file changes with exact paths.

- Ensure migration is included.

- Ensure tests pass.

- Ensure compile succeeds.

Proceed now with the implementation.

&nbsp;