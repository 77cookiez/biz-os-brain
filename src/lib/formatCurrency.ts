/**
 * Global currency formatter using Intl.NumberFormat.
 * Supports all ISO 4217 codes.
 */

export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en',
): string {
  try {
    return new Intl.NumberFormat(locale, {
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
