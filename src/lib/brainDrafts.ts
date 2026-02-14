import { GrowthInsights } from '@/hooks/useGrowthInsights';

/* ── Draft Types (Phase 9A) ────────────────────────── */

export interface DraftAction {
  labelKey: string;
  type: 'navigate' | 'prefill';
  path: string;
  prefill?: Record<string, string>;
  analyticsCode: string;
}

export interface DraftInsight {
  id: string;
  titleKey: string;
  bodyKey: string;
  severity: 'info' | 'warning' | 'critical';
  tags: string[];
  actions: DraftAction[];
}

/* ── Deterministic Draft Generator (no LLM) ─────── */

export function buildDraftInsights(insights: GrowthInsights): DraftInsight[] {
  const drafts: DraftInsight[] = [];
  const u = insights.usage;
  const util = insights.utilization_percent;
  const lim = insights.limits;
  const proj = insights.projected_end_of_month_usage;

  // 1) Conversion improvement: high quotes but low bookings
  if (
    u.quotes_this_month > 5 &&
    u.bookings_this_month > 0 &&
    u.quotes_this_month / u.bookings_this_month > 3
  ) {
    drafts.push({
      id: 'improve_conversion',
      titleKey: 'brainDraft.drafts.improve_conversion.title',
      bodyKey: 'brainDraft.drafts.improve_conversion.body',
      severity: 'warning',
      tags: ['conversion', 'quotes'],
      actions: [
        {
          labelKey: 'brainDraft.actions.open_quotes',
          type: 'navigate',
          path: '/apps/booking/quotes',
          analyticsCode: 'OPEN_QUOTES',
        },
      ],
    });
  }

  // 2) Low services
  if (u.services_count < 3) {
    drafts.push({
      id: 'add_services',
      titleKey: 'brainDraft.drafts.add_services.title',
      bodyKey: 'brainDraft.drafts.add_services.body',
      severity: 'info',
      tags: ['services'],
      actions: [
        {
          labelKey: 'brainDraft.actions.open_services',
          type: 'navigate',
          path: '/apps/booking/services',
          analyticsCode: 'OPEN_SERVICES',
        },
      ],
    });
  }

  // 3) Vendors near limit
  if (lim.vendors_limit !== null && util.vendors >= 80) {
    drafts.push({
      id: 'vendor_cleanup',
      titleKey: 'brainDraft.drafts.vendor_cleanup.title',
      bodyKey: 'brainDraft.drafts.vendor_cleanup.body',
      severity: 'warning',
      tags: ['vendors', 'billing'],
      actions: [
        {
          labelKey: 'brainDraft.actions.open_vendors',
          type: 'navigate',
          path: '/apps/booking/vendors',
          analyticsCode: 'OPEN_VENDORS',
        },
        {
          labelKey: 'brainDraft.actions.view_plans',
          type: 'navigate',
          path: '/apps/booking/billing',
          analyticsCode: 'VIEW_PLANS_VENDORS',
        },
      ],
    });
  }

  // 4) Seats under-utilized (only 1 member but more allowed)
  if (u.seats_count === 1 && (lim.seats_limit ?? 0) > 1) {
    drafts.push({
      id: 'invite_team',
      titleKey: 'brainDraft.drafts.invite_team.title',
      bodyKey: 'brainDraft.drafts.invite_team.body',
      severity: 'info',
      tags: ['team'],
      actions: [
        {
          labelKey: 'brainDraft.actions.open_team',
          type: 'navigate',
          path: '/settings/team',
          analyticsCode: 'OPEN_TEAM',
        },
      ],
    });
  }

  // 5) Projected breach → billing upgrade
  if (
    (lim.bookings_limit !== null && proj.bookings >= lim.bookings_limit) ||
    (lim.quotes_limit !== null && proj.quotes >= lim.quotes_limit)
  ) {
    drafts.push({
      id: 'projected_breach',
      titleKey: 'brainDraft.drafts.projected_breach.title',
      bodyKey: 'brainDraft.drafts.projected_breach.body',
      severity: 'critical',
      tags: ['billing', 'limits'],
      actions: [
        {
          labelKey: 'brainDraft.actions.view_plans',
          type: 'navigate',
          path: '/apps/booking/billing',
          analyticsCode: 'VIEW_PLANS_BREACH',
        },
        {
          labelKey: 'brainDraft.actions.view_usage',
          type: 'prefill',
          path: '/apps/booking/billing?tab=usage',
          prefill: { tab: 'usage' },
          analyticsCode: 'VIEW_USAGE',
        },
      ],
    });
  }

  // 6) Frequent limit hits → workflow optimization
  if (insights.limit_hits_last_30_days > 2) {
    drafts.push({
      id: 'frequent_hits',
      titleKey: 'brainDraft.drafts.frequent_hits.title',
      bodyKey: 'brainDraft.drafts.frequent_hits.body',
      severity: 'critical',
      tags: ['billing', 'limits'],
      actions: [
        {
          labelKey: 'brainDraft.actions.view_plans',
          type: 'navigate',
          path: '/apps/booking/billing',
          analyticsCode: 'VIEW_PLANS_HITS',
        },
        {
          labelKey: 'brainDraft.actions.open_quotes',
          type: 'prefill',
          path: '/apps/booking/quotes?focus=limits',
          prefill: { focus: 'limits' },
          analyticsCode: 'OPEN_QUOTES_HITS',
        },
      ],
    });
  }

  // 7) Pricing optimization (growth signals present)
  if (insights.recommended_action === 'upgrade' && insights.confidence_score >= 60) {
    drafts.push({
      id: 'pricing_optimization',
      titleKey: 'brainDraft.drafts.pricing_optimization.title',
      bodyKey: 'brainDraft.drafts.pricing_optimization.body',
      severity: 'info',
      tags: ['billing', 'pricing'],
      actions: [
        {
          labelKey: 'brainDraft.actions.view_plans',
          type: 'navigate',
          path: '/apps/booking/billing',
          analyticsCode: 'VIEW_PLANS_PRICING',
        },
      ],
    });
  }

  // 8) Service performance audit (many services, low bookings)
  if (u.services_count >= 5 && u.bookings_this_month < 3) {
    drafts.push({
      id: 'service_audit',
      titleKey: 'brainDraft.drafts.service_audit.title',
      bodyKey: 'brainDraft.drafts.service_audit.body',
      severity: 'warning',
      tags: ['services', 'conversion'],
      actions: [
        {
          labelKey: 'brainDraft.actions.open_services',
          type: 'navigate',
          path: '/apps/booking/services',
          analyticsCode: 'OPEN_SERVICES_AUDIT',
        },
        {
          labelKey: 'brainDraft.actions.open_quotes',
          type: 'navigate',
          path: '/apps/booking/quotes',
          analyticsCode: 'OPEN_QUOTES_AUDIT',
        },
      ],
    });
  }

  // 9) Customer experience enhancement (active business)
  if (u.bookings_this_month >= 5) {
    drafts.push({
      id: 'cx_enhancement',
      titleKey: 'brainDraft.drafts.cx_enhancement.title',
      bodyKey: 'brainDraft.drafts.cx_enhancement.body',
      severity: 'info',
      tags: ['customers', 'growth'],
      actions: [
        {
          labelKey: 'brainDraft.actions.open_quotes',
          type: 'navigate',
          path: '/apps/booking/quotes',
          analyticsCode: 'OPEN_QUOTES_CX',
        },
      ],
    });
  }

  // 10) Strategic growth plan (always available as last item)
  if (u.bookings_this_month > 0 || u.quotes_this_month > 0) {
    drafts.push({
      id: 'strategic_growth',
      titleKey: 'brainDraft.drafts.strategic_growth.title',
      bodyKey: 'brainDraft.drafts.strategic_growth.body',
      severity: 'info',
      tags: ['strategy', 'growth'],
      actions: [
        {
          labelKey: 'brainDraft.actions.view_usage',
          type: 'prefill',
          path: '/apps/booking/billing?tab=usage',
          prefill: { tab: 'usage' },
          analyticsCode: 'VIEW_USAGE_STRATEGY',
        },
      ],
    });
  }

  return drafts;
}
