export const SAFEBACK_APP_ID = 'safeback';

export const safebackManifest = {
  id: SAFEBACK_APP_ID,
  name: 'SafeBack',
  description: 'Workspace snapshots, scheduled backups, and safe point-in-time restore',
  icon: 'shield-check',
  pricing: 'free' as const,
  capabilities: [
    'snapshot',
    'restore',
    'scheduled_backup',
    'export',
    'retention',
    'compliance',
  ],
  routes: {
    index: `/apps/${SAFEBACK_APP_ID}`,
    snapshots: `/apps/${SAFEBACK_APP_ID}/snapshots`,
    schedules: `/apps/${SAFEBACK_APP_ID}/schedules`,
    exports: `/apps/${SAFEBACK_APP_ID}/exports`,
    policies: `/apps/${SAFEBACK_APP_ID}/policies`,
    audit: `/apps/${SAFEBACK_APP_ID}/audit`,
    settings: `/apps/${SAFEBACK_APP_ID}/settings`,
  },
  branding: {
    primary: '#3B82F6',
    accent: '#10B981',
  },
  tabs: [
    { id: 'overview', labelKey: 'apps.safeback.tabs.overview', icon: 'LayoutDashboard', path: `/apps/${SAFEBACK_APP_ID}` },
    { id: 'snapshots', labelKey: 'apps.safeback.tabs.snapshots', icon: 'Database', path: `/apps/${SAFEBACK_APP_ID}/snapshots` },
    { id: 'schedules', labelKey: 'apps.safeback.tabs.schedules', icon: 'Clock', path: `/apps/${SAFEBACK_APP_ID}/schedules` },
    { id: 'exports', labelKey: 'apps.safeback.tabs.exports', icon: 'Download', path: `/apps/${SAFEBACK_APP_ID}/exports` },
    { id: 'policies', labelKey: 'apps.safeback.tabs.policies', icon: 'Shield', path: `/apps/${SAFEBACK_APP_ID}/policies` },
    { id: 'audit', labelKey: 'apps.safeback.tabs.audit', icon: 'FileText', path: `/apps/${SAFEBACK_APP_ID}/audit` },
    { id: 'settings', labelKey: 'apps.safeback.tabs.settings', icon: 'Settings', path: `/apps/${SAFEBACK_APP_ID}/settings` },
  ],
};
