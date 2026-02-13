/**
 * GCC-aware currency formatter using Intl.NumberFormat.
 * Supports AED, SAR, QAR, KWD, BHD, OMR and any ISO 4217 code.
 */

const LOCALE_MAP: Record<string, string> = {
  ar: 'ar-AE',
  en: 'en-AE',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
};

export function formatCurrency(
  amount: number,
  currency: string = 'AED',
  locale: string = 'en',
): string {
  const resolvedLocale = LOCALE_MAP[locale] || locale;
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unknown currency codes
    return `${currency} ${amount.toFixed(2)}`;
  }
}
