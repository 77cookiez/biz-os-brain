import { DraftInsight } from '@/lib/brainDrafts';
import { GrowthInsights } from '@/hooks/useGrowthInsights';

/**
 * Builds a structured command prompt from a DraftInsight for the Brain Command Bar.
 * 10 Smart Command Templates — Draft only, no execution.
 */
export function buildCommandPrompt(
  draft: DraftInsight,
  insights: GrowthInsights,
  locale: 'ar' | 'en',
): string {
  if (locale === 'ar') return buildArabic(draft, insights);
  return buildEnglish(draft, insights);
}

/* ── Context builder (shared) ──────────────────────── */

function buildContextEN(ins: GrowthInsights): string[] {
  const lines: string[] = [];
  lines.push(`- Action: ${ins.recommended_action} (confidence ${ins.confidence_score}%)`);

  const reasons = ins.reasons.slice(0, 2).map(r => {
    if (r.code === 'PROJECTED_BREACH') return `PROJECTED_BREACH(${r.metric ?? 'usage'})`;
    if (r.code === 'FREQUENT_LIMIT_HITS') return `FREQUENT_LIMIT_HITS(${r.count ?? r.hits ?? ''})`;
    if (r.code === 'HIGH_UTILIZATION') return `HIGH_UTILIZATION(${r.metric ?? ''})`;
    return r.code;
  });
  if (reasons.length) lines.push(`- Reasons: ${reasons.join(', ')}`);

  const utilEntries = Object.entries(ins.utilization_percent)
    .filter(([, v]) => v >= 50)
    .map(([k, v]) => `${k} ${v}%`);
  if (utilEntries.length) lines.push(`- Utilization: ${utilEntries.join(', ')}`);

  const proj = ins.projected_end_of_month_usage;
  const lim = ins.limits;
  if (lim.bookings_limit || lim.quotes_limit) {
    const parts: string[] = [];
    if (lim.bookings_limit) parts.push(`bookings ${proj.bookings}/${lim.bookings_limit}`);
    if (lim.quotes_limit) parts.push(`quotes ${proj.quotes}/${lim.quotes_limit}`);
    lines.push(`- Projection: ${parts.join(', ')}`);
  }

  return lines;
}

function buildContextAR(ins: GrowthInsights): string[] {
  const lines: string[] = [];
  lines.push(`- الإجراء: ${ins.recommended_action} (ثقة ${ins.confidence_score}%)`);

  const reasons = ins.reasons.slice(0, 2).map(r => {
    if (r.code === 'PROJECTED_BREACH') return `تجاوز متوقع (${r.metric ?? 'استخدام'})`;
    if (r.code === 'FREQUENT_LIMIT_HITS') return `وصول متكرر للحدود (${r.count ?? r.hits ?? ''})`;
    if (r.code === 'HIGH_UTILIZATION') return `استخدام عالي (${r.metric ?? ''})`;
    return r.code;
  });
  if (reasons.length) lines.push(`- الأسباب: ${reasons.join('، ')}`);

  const utilEntries = Object.entries(ins.utilization_percent)
    .filter(([, v]) => v >= 50)
    .map(([k, v]) => `${k} ${v}%`);
  if (utilEntries.length) lines.push(`- الاستخدام: ${utilEntries.join('، ')}`);

  const proj = ins.projected_end_of_month_usage;
  const lim = ins.limits;
  if (lim.bookings_limit || lim.quotes_limit) {
    const parts: string[] = [];
    if (lim.bookings_limit) parts.push(`حجوزات ${proj.bookings}/${lim.bookings_limit}`);
    if (lim.quotes_limit) parts.push(`عروض ${proj.quotes}/${lim.quotes_limit}`);
    lines.push(`- التوقعات: ${parts.join('، ')}`);
  }

  return lines;
}

/* ── 10 Smart Templates (EN) ──────────────────────── */

const templatesEN: Record<string, { task: string; output: string }> = {
  improve_conversion: {
    task: `Task:
1) Propose 3 ways to improve quote-to-booking conversion.
2) Suggest a follow-up message template.
3) Suggest one pricing or bundle experiment.`,
    output: `Output:
- Short bullet plan
- 1 ready-to-use follow-up message`,
  },
  add_services: {
    task: `Task:
1) Suggest 5 high-demand food service ideas.
2) Propose one premium add-on package.
3) Recommend pricing tiers (basic/standard/premium).`,
    output: `Output:
- Structured list
- Clear next action`,
  },
  vendor_cleanup: {
    task: `Task:
1) Suggest vendor performance cleanup criteria.
2) Propose vendor ranking logic.
3) Suggest whether upgrade or consolidation is smarter.`,
    output: `Output:
- Decision framework
- Step-by-step plan`,
  },
  invite_team: {
    task: `Task:
1) Suggest roles to delegate.
2) Propose task distribution model.
3) Recommend productivity improvements.`,
    output: `Output:
- Team structure proposal
- 30-day plan`,
  },
  projected_breach: {
    task: `Task:
1) Suggest 3 strategies to avoid breach.
2) Compare optimization vs upgrade.
3) Recommend most rational decision with reasoning.`,
    output: `Output:
- Decision table
- Final recommendation`,
  },
  frequent_hits: {
    task: `Task:
1) Identify root causes.
2) Propose workflow improvements.
3) Recommend operational restructuring.`,
    output: `Output:
- Root cause analysis
- Action checklist`,
  },
  pricing_optimization: {
    task: `Task:
1) Propose price restructuring strategy.
2) Suggest upsell bundles.
3) Suggest customer communication plan.`,
    output: `Output:
- Pricing tiers
- Customer messaging draft`,
  },
  service_audit: {
    task: `Task:
1) Suggest service performance metrics.
2) Propose elimination criteria.
3) Recommend top 3 focus services.`,
    output: `Output:
- Audit framework
- Optimization plan`,
  },
  cx_enhancement: {
    task: `Task:
1) Suggest 3 CX improvements.
2) Recommend automated touchpoints.
3) Propose loyalty or referral strategy.`,
    output: `Output:
- Action list
- Quick wins`,
  },
  strategic_growth: {
    task: `Task:
1) Summarize business health.
2) Identify biggest growth lever.
3) Recommend 90-day strategic roadmap.`,
    output: `Output:
- Executive summary
- Priority matrix
- 3-phase roadmap`,
  },
};

/* ── 10 Smart Templates (AR) ──────────────────────── */

const templatesAR: Record<string, { task: string; output: string }> = {
  improve_conversion: {
    task: `المهمة:
1) اقترح 3 طرق لتحسين تحويل العروض إلى حجوزات.
2) اقترح نموذج رسالة متابعة.
3) اقترح تجربة تسعير أو باقة.`,
    output: `المخرج:
- خطة نقاط مختصرة
- رسالة متابعة جاهزة`,
  },
  add_services: {
    task: `المهمة:
1) اقترح 5 أفكار خدمات طعام عالية الطلب.
2) اقترح باقة إضافية مميزة.
3) وصِّ بمستويات تسعير (أساسي/عادي/مميز).`,
    output: `المخرج:
- قائمة منظمة
- إجراء تالي واضح`,
  },
  vendor_cleanup: {
    task: `المهمة:
1) اقترح معايير تنظيف أداء المزوّدين.
2) اقترح منطق ترتيب المزوّدين.
3) وصِّ بالترقية أم الدمج.`,
    output: `المخرج:
- إطار قرار
- خطة خطوة بخطوة`,
  },
  invite_team: {
    task: `المهمة:
1) اقترح أدوار للتفويض.
2) اقترح نموذج توزيع المهام.
3) وصِّ بتحسينات الإنتاجية.`,
    output: `المخرج:
- هيكل الفريق المقترح
- خطة 30 يوم`,
  },
  projected_breach: {
    task: `المهمة:
1) اقترح 3 استراتيجيات لتجنب التجاوز.
2) قارن بين التحسين والترقية.
3) وصِّ بالقرار الأنسب مع التبرير.`,
    output: `المخرج:
- جدول قرارات
- توصية نهائية`,
  },
  frequent_hits: {
    task: `المهمة:
1) حدّد الأسباب الجذرية.
2) اقترح تحسينات سير العمل.
3) وصِّ بإعادة هيكلة تشغيلية.`,
    output: `المخرج:
- تحليل أسباب جذرية
- قائمة إجراءات`,
  },
  pricing_optimization: {
    task: `المهمة:
1) اقترح استراتيجية إعادة هيكلة الأسعار.
2) اقترح باقات بيع إضافية.
3) اقترح خطة تواصل مع العملاء.`,
    output: `المخرج:
- مستويات تسعير
- مسودة رسائل العملاء`,
  },
  service_audit: {
    task: `المهمة:
1) اقترح مؤشرات أداء الخدمات.
2) اقترح معايير الحذف.
3) وصِّ بأفضل 3 خدمات للتركيز عليها.`,
    output: `المخرج:
- إطار تدقيق
- خطة تحسين`,
  },
  cx_enhancement: {
    task: `المهمة:
1) اقترح 3 تحسينات لتجربة العملاء.
2) وصِّ بنقاط اتصال آلية.
3) اقترح استراتيجية ولاء أو إحالة.`,
    output: `المخرج:
- قائمة إجراءات
- مكاسب سريعة`,
  },
  strategic_growth: {
    task: `المهمة:
1) لخّص صحة الأعمال.
2) حدّد أكبر رافعة نمو.
3) وصِّ بخارطة طريق استراتيجية لـ 90 يوم.`,
    output: `المخرج:
- ملخص تنفيذي
- مصفوفة أولويات
- خارطة من 3 مراحل`,
  },
};

/* ── Context labels per draft (EN/AR) ─────────────── */

const contextLabelsEN: Record<string, string> = {
  improve_conversion: 'Quotes significantly higher than bookings. Conversion appears low.',
  add_services: 'Limited service offerings.',
  vendor_cleanup: 'Vendors nearing plan limit.',
  invite_team: 'Team size below potential.',
  projected_breach: 'Projected usage exceeds plan limit before month end.',
  frequent_hits: 'Plan limits hit multiple times recently.',
  pricing_optimization: 'Growth signals suggest scaling opportunity.',
  service_audit: 'Many services but weak bookings.',
  cx_enhancement: 'Business growth phase.',
  strategic_growth: 'Current utilization and growth indicators available.',
};

const contextLabelsAR: Record<string, string> = {
  improve_conversion: 'العروض أعلى بكثير من الحجوزات. التحويل يبدو ضعيفًا.',
  add_services: 'عروض خدمات محدودة.',
  vendor_cleanup: 'المزوّدون يقتربون من حد الخطة.',
  invite_team: 'حجم الفريق أقل من الإمكانية.',
  projected_breach: 'الاستخدام المتوقع يتجاوز حد الخطة قبل نهاية الشهر.',
  frequent_hits: 'وصول متكرر لحدود الخطة مؤخرًا.',
  pricing_optimization: 'مؤشرات النمو تشير لفرصة توسع.',
  service_audit: 'خدمات كثيرة لكن الحجوزات ضعيفة.',
  cx_enhancement: 'مرحلة نمو الأعمال.',
  strategic_growth: 'مؤشرات الاستخدام والنمو الحالية متاحة.',
};

/* ── Builders ──────────────────────────────────────── */

function buildEnglish(draft: DraftInsight, ins: GrowthInsights): string {
  const template = templatesEN[draft.id];
  const contextLabel = contextLabelsEN[draft.id] ?? '';
  const lines: string[] = [];

  lines.push('DRAFT ONLY – Do not execute.');
  lines.push('');
  lines.push('Context:');
  lines.push(...buildContextEN(ins));
  if (contextLabel) lines.push(`- Situation: ${contextLabel}`);
  lines.push('');

  if (template) {
    lines.push(template.task);
    lines.push('');
    lines.push(template.output);
  } else {
    lines.push('Task: Provide actionable recommendations.');
    lines.push('');
    lines.push('Output: short bullets + next best action.');
  }

  return lines.join('\n');
}

function buildArabic(draft: DraftInsight, ins: GrowthInsights): string {
  const template = templatesAR[draft.id];
  const contextLabel = contextLabelsAR[draft.id] ?? '';
  const lines: string[] = [];

  lines.push('مسودة فقط – بدون تنفيذ.');
  lines.push('');
  lines.push('السياق:');
  lines.push(...buildContextAR(ins));
  if (contextLabel) lines.push(`- الوضع: ${contextLabel}`);
  lines.push('');

  if (template) {
    lines.push(template.task);
    lines.push('');
    lines.push(template.output);
  } else {
    lines.push('المهمة: قدّم توصيات عملية.');
    lines.push('');
    lines.push('المخرج: نقاط مختصرة + أفضل إجراء تالي.');
  }

  return lines.join('\n');
}
