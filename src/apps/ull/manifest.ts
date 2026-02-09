/**
 * Universal Language Layer (ULL) — App Manifest
 *
 * Core System App that provides meaning-first language projection
 * across the entire OS. Cannot be removed or deactivated.
 */

export const ULL_MANIFEST = {
  id: 'ull',
  name: 'Universal Language Layer (ULL)',
  type: 'system' as const,
  required: true,
  removable: false,
  category: 'Core',
  description: 'Meaning-first language projection across the OS. Stores canonical meaning and projects into any language on demand.',
  version: '1.0.0',

  capabilities: [
    'language:preferences',   // User & workspace locale management
    'language:render',        // ULLText component + useULL hook
    'language:translate',     // ull-translate edge function
    'meaning:contract',       // Meaning-first enforcement & dev docs
  ],

  settingsRoutes: [
    { path: '/settings/language', label: 'User Language', scope: 'user' },
    { path: '/settings/workspace/language', label: 'Workspace Language', scope: 'admin' },
  ],

  docsRoutes: [
    { path: '/docs/system/ull', label: 'Developer Contract' },
  ],

  /** Services this app provides to other apps */
  services: {
    meaningObject: 'src/lib/meaningObject.ts',
    meaningGuard: 'src/lib/meaningGuard.ts',
    useULL: 'src/hooks/useULL.ts',
    ULLText: 'src/components/ull/ULLText.tsx',
    translate: 'supabase/functions/ull-translate/index.ts',
  },

  /** DB tables owned by ULL */
  tables: [
    'meaning_objects',
    'content_translations',
  ],

  /** DB columns owned by ULL on other tables */
  columns: [
    'profiles.preferred_locale',
    'workspaces.default_locale',
    '*.source_lang',
    '*.meaning_object_id',
  ],
} as const;

export type ULLManifest = typeof ULL_MANIFEST;
