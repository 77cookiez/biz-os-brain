/**
 * Organizational Intelligence Layer (OIL) — App Manifest
 *
 * Core System App that provides organizational-level intelligence.
 * Continuously learns from business activity to surface risk signals,
 * health indicators, and contextual memory.
 *
 * OIL does NOT:
 * - Execute actions
 * - Command users
 * - Evaluate individuals
 * - Produce constant alerts
 *
 * OIL outputs are consumed by AI Business Brain via a defined interface.
 * OIL never talks to users directly.
 */

export const OIL_MANIFEST = {
  id: 'oil',
  name: 'Organizational Intelligence Layer (OIL)',
  type: 'system' as const,
  required: true,
  removable: false,
  category: 'Core',
  description:
    'System-level intelligence service that continuously learns from organizational behavior to provide early risk signals, operational indicators, and contextual guidance.',
  version: '1.0.0',

  capabilities: [
    'oil:events',       // Ingest organizational events from all apps
    'oil:indicators',   // Compute & expose health indicators
    'oil:memory',       // Organizational memory (patterns, risks)
    'oil:guidance',     // Contextual guidance drafts for Brain
    'oil:audit',        // Audit logging of all OIL changes
  ],

  /** Indicator tiers — keeps UX lightweight */
  indicatorTiers: {
    core: ['ExecutionHealth', 'DeliveryRisk', 'GoalProgress'] as const,
    secondary: ['FinancialPressure', 'TeamAlignment'] as const,
  },

  /** OIL has NO user-facing routes — it is invisible in sidebar */
  settingsRoutes: [],
  docsRoutes: [],

  /** Internal agents (hidden from users) */
  agents: {
    patternMiner: 'Detects repeated behavioral patterns, creates/updates company_memory',
    riskForecaster: 'Translates patterns into indicator changes, flags emerging risks',
    trendScout: 'Web search only when indicator deteriorates or pattern persists (controlled)',
  },

  /** Services OIL provides to other system apps (primarily Brain) */
  services: {
    ingest: 'supabase/functions/oil-ingest/index.ts',
    compute: 'supabase/functions/oil-compute/index.ts',
  },

  /** DB tables owned by OIL */
  tables: [
    'org_events',
    'org_indicators',
    'company_memory',
  ],

  /** Indicator keys tracked by OIL */
  indicatorKeys: [
    'ExecutionHealth',
    'DeliveryRisk',
    'FinancialPressure',
    'GoalProgress',
    'TeamAlignment',
  ] as const,

  /** Memory types */
  memoryTypes: [
    'PROCESS',
    'RISK',
    'FINANCE',
    'OPERATIONS',
    'CULTURE',
  ] as const,

  /** Outputs interface — what Brain can consume */
  outputs: {
    indicators: 'org_indicators table (score, trend, drivers)',
    memory: 'company_memory table (statements, evidence, confidence)',
    guidanceDrafts: 'Generated on-demand via oil-compute edge function',
  },

  /** Leadership Augmentation — Core Value */
  leadershipAugmentation: {
    purpose: 'Augment leadership capability in environments where leaders lack formal training, decision-making is overwhelmed, or blind spots emerge over time.',
    capabilities: [
      'Synthesizes signals humans cannot track daily',
      'Surfaces early indicators before issues escalate',
      'Connects internal behavior with proven global practices',
      'Reduces reliance on personal experience alone',
    ],
    doesNot: 'Replace leaders. It amplifies judgment, shortens learning curves, and exposes hidden risks and opportunities.',
    valuableFor: [
      'First-time founders',
      'Growing SMEs',
      'Non-specialist managers',
      'Rapidly scaling teams',
    ],
  },

  /** Continuous Knowledge Update — Controlled */
  continuousKnowledgeUpdate: {
    primarySources: [
      'Organizational behavior (primary)',
      'Historical company memory',
      'Conditional external research',
    ],
    externalResearchTriggers: [
      'Internal indicators degrade',
      'Repeated patterns persist',
      'A strategic gap is detected',
      'A user explicitly requests comparison',
    ],
    guidanceQualities: ['Relevant', 'Timely', 'Context-aware', 'Free from trend noise'],
  },

  /** Communication tone rules */
  toneRules: {
    style: 'Professional, calm, non-judgmental',
    improving: 'Encouraging',
    deteriorating: 'Cautious',
    always: 'Data-backed, never dramatic',
    adaptive: true,
  },
} as const;

export type OILManifest = typeof OIL_MANIFEST;
export type IndicatorKey = typeof OIL_MANIFEST.indicatorKeys[number];
export type MemoryType = typeof OIL_MANIFEST.memoryTypes[number];
