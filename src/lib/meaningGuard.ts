/**
 * ULL Runtime Guard
 * 
 * Ensures no content is inserted into meaning-protected tables
 * without a meaning_object_id. Logs warnings and optionally blocks.
 */

const MEANING_PROTECTED_TABLES = [
  'tasks', 'goals', 'ideas', 'brain_messages', 'plans', 'chat_messages',
  'booking_vendor_profiles', 'booking_services', 'booking_service_addons',
  'booking_quote_requests', 'booking_quotes',
] as const;

type ProtectedTable = typeof MEANING_PROTECTED_TABLES[number];

/**
 * Validates that an insert payload for a meaning-protected table
 * includes a meaning_object_id. Logs a warning if missing.
 * 
 * @param table - The table being inserted into
 * @param payload - The insert payload (single object or array)
 * @param options - { block: boolean } - if true, throws instead of warning
 * @returns true if valid, false if missing meaning_object_id
 */
export function guardMeaningInsert(
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[],
  options: { block?: boolean } = { block: true }
): boolean {
  if (!MEANING_PROTECTED_TABLES.includes(table as ProtectedTable)) {
    return true;
  }

  const rows = Array.isArray(payload) ? payload : [payload];

  for (const row of rows) {
    if (!row.meaning_object_id) {
      const message = `[ULL Guard] ⚠️ Insert into "${table}" without meaning_object_id. This violates the Meaning-First rule. Payload: ${JSON.stringify(row, null, 2).slice(0, 200)}`;
      
      if (options.block) {
        console.error(message);
        throw new Error(`[ULL Guard] Blocked insert into "${table}" — meaning_object_id is required.`);
      }

      console.warn(message);
      return false;
    }
  }

  return true;
}
