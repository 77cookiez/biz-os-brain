/**
 * Maps structured Supabase/Postgres error codes and messages
 * to user-friendly i18n keys for toast notifications.
 */

import i18n from '@/i18n';

interface PostgresError {
  code?: string;
  message?: string;
  details?: string;
}

const LIMIT_ERROR_MAP: Record<string, string> = {
  VENDOR_LIMIT_REACHED: 'errors.limits.vendorLimitReached',
  BOOKING_LIMIT_REACHED: 'errors.limits.bookingLimitReached',
  SERVICES_LIMIT_REACHED: 'errors.limits.servicesLimitReached',
  QUOTES_LIMIT_REACHED: 'errors.limits.quotesLimitReached',
};

const ERRCODE_MAP: Record<string, string> = {
  '42501': 'errors.permissions.forbidden', // insufficient_privilege
  P0001: 'errors.limits.planLimitReached', // fallback for limit errors
};

/**
 * Parses a Supabase error and returns a translated user-friendly message.
 * Returns null if the error is not a recognized structured error.
 */
export function mapDbError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;

  const err = error as PostgresError;
  const message = err.message || '';
  const code = err.code || '';

  // 1) Check for specific limit messages (P0001 with known message)
  for (const [key, i18nKey] of Object.entries(LIMIT_ERROR_MAP)) {
    if (message.includes(key)) {
      return i18n.t(i18nKey);
    }
  }

  // 2) Check by error code
  if (ERRCODE_MAP[code]) {
    return i18n.t(ERRCODE_MAP[code]);
  }

  // 3) FORBIDDEN text match (fallback)
  if (message.includes('FORBIDDEN') || message.includes('Forbidden')) {
    return i18n.t('errors.permissions.forbidden');
  }

  return null;
}

/**
 * Returns the user-friendly message, or the raw error message as fallback.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  return mapDbError(error) || fallback || i18n.t('common.error');
}

/**
 * Returns true if the error is a plan limit error (P0001 with *_LIMIT_REACHED).
 */
export function isLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = (error as PostgresError).message || '';
  return Object.keys(LIMIT_ERROR_MAP).some((key) => msg.includes(key));
}
