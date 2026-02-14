import { DraftInsight } from '@/lib/brainDrafts';
import { GrowthInsights } from '@/hooks/useGrowthInsights';

/**
 * Builds a structured command prompt from a DraftInsight for the Brain Command Bar.
 * Output is a concise draft-only instruction (6–10 lines).
 * No execution — plan/suggestions only.
 */
export function buildCommandPrompt(
  draft: DraftInsight,
  insights: GrowthInsights,
  locale: 'ar' | 'en',
): string {
  if (locale === 'ar') return buildArabic(draft, insights);
  return buildEnglish(draft, insights);
}

function buildEnglish(draft: DraftInsight, ins: GrowthInsights): string {
  const lines: string[] = [];

  lines.push('Create a DRAFT plan only (no execution).');
  lines.push('');
  lines.push('Context:');
  lines.push(`- Action: ${ins.recommended_action} (confidence ${ins.confidence_score}%)`);

  // Top 2 reasons
  const reasons = ins.reasons.slice(0, 2).map(r => {
    if (r.code === 'PROJECTED_BREACH') return `PROJECTED_BREACH(${r.metric ?? 'usage'})`;
    if (r.code === 'FREQUENT_LIMIT_HITS') return `FREQUENT_LIMIT_HITS(${r.count ?? r.hits ?? ''})`;
    if (r.code === 'HIGH_UTILIZATION') return `HIGH_UTILIZATION(${r.metric ?? ''})`;
    return r.code;
  });
  if (reasons.length) lines.push(`- Reasons: ${reasons.join(', ')}`);

  // Utilization (only metrics above 50%)
  const utilEntries = Object.entries(ins.utilization_percent)
    .filter(([, v]) => v >= 50)
    .map(([k, v]) => `${k} ${v}%`);
  if (utilEntries.length) lines.push(`- Utilization: ${utilEntries.join(', ')}`);

  // Projections
  const proj = ins.projected_end_of_month_usage;
  const lim = ins.limits;
  if (lim.bookings_limit || lim.quotes_limit) {
    const parts: string[] = [];
    if (lim.bookings_limit) parts.push(`bookings ${proj.bookings}/${lim.bookings_limit}`);
    if (lim.quotes_limit) parts.push(`quotes ${proj.quotes}/${lim.quotes_limit}`);
    lines.push(`- Projection: ${parts.join(', ')}`);
  }

  lines.push('');

  // Task based on draft type
  const taskMap: Record<string, string> = {
    improve_conversion: 'Suggest 3 ways to improve quote-to-booking conversion rate.',
    add_services: 'Suggest service ideas to expand the catalog and attract more customers.',
    vendor_cleanup: 'Recommend which vendors to keep, suspend, or how to restructure capacity.',
    invite_team: 'Draft an onboarding plan for new team members to speed up operations.',
    projected_breach: 'Analyze whether to upgrade the plan or optimize current usage to stay within limits.',
    frequent_hits: 'Suggest workflow optimizations to reduce limit hits, or recommend the right plan upgrade.',
  };
  lines.push(`Task: ${taskMap[draft.id] ?? 'Provide actionable recommendations.'}`);
  lines.push('');
  lines.push('Output: short bullets + next best action. Draft only, no execution.');

  return lines.join('\n');
}

function buildArabic(draft: DraftInsight, ins: GrowthInsights): string {
  const lines: string[] = [];

  lines.push('أنشئ خطة مسودة فقط (بدون تنفيذ).');
  lines.push('');
  lines.push('السياق:');
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

  lines.push('');

  const taskMap: Record<string, string> = {
    improve_conversion: 'اقترح 3 طرق لتحسين تحويل العروض إلى حجوزات.',
    add_services: 'اقترح أفكار خدمات جديدة لتوسيع الكتالوج وجذب عملاء أكثر.',
    vendor_cleanup: 'وصِّ بأي المزوّدين يُبقى عليهم أو يُعلّقون أو كيف يُعاد هيكلة السعة.',
    invite_team: 'ضع خطة لإعداد أعضاء فريق جدد لتسريع العمليات.',
    projected_breach: 'حلّل هل يجب ترقية الخطة أم تحسين الاستخدام الحالي للبقاء ضمن الحدود.',
    frequent_hits: 'اقترح تحسينات لسير العمل لتقليل الوصول للحدود، أو وصِّ بالخطة المناسبة.',
  };
  lines.push(`المهمة: ${taskMap[draft.id] ?? 'قدّم توصيات عملية.'}`);
  lines.push('');
  lines.push('المخرج: نقاط مختصرة + أفضل إجراء تالي. مسودة فقط، بدون تنفيذ.');

  return lines.join('\n');
}
