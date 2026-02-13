/**
 * ULL Runtime Guard
 * 
 * Ensures no content is inserted into meaning-protected tables
 * without required meaning columns. Logs warnings and optionally blocks.
 * 
 * Supports per-table meaning column configuration for tables with
 * multiple or non-standard meaning columns (e.g. booking_vendor_profiles).
 */

/**
 * Per-table meaning column mapping.
 * 
 * - Tables with a single 'meaning_object_id' column use the shorthand.
 * - Tables with multiple or custom meaning columns specify an array.
 * - For columns where null is acceptable (e.g. bio_meaning_object_id),
 *   suffix with '?' to mark as optional.
 */
const MEANING_PROTECTED_CONFIG: Record<string, string[]> = {
  // Core content tables
  tasks: ['meaning_object_id'],
  goals: ['meaning_object_id'],
  ideas: ['meaning_object_id'],
  brain_messages: ['meaning_object_id'],
  plans: ['meaning_object_id'],
  chat_messages: ['meaning_object_id'],

  // Booking tables — per-field mapping
  booking_vendor_profiles: ['display_name_meaning_object_id', 'bio_meaning_object_id?'],
  booking_services: ['title_meaning_object_id', 'description_meaning_object_id?'],
  booking_service_addons: ['meaning_object_id'],
  booking_quote_requests: ['meaning_object_id'],
  booking_quotes: ['meaning_object_id'],
} as const;

// Derive the list of protected table names for external consumers
export const MEANING_PROTECTED_TABLES = Object.keys(MEANING_PROTECTED_CONFIG);

/**
 * Validates that an insert payload for a meaning-protected table
 * includes all required meaning columns. Logs a warning if missing.
 * 
 * @param table - The table being inserted into
 * @param payload - The insert payload (single object or array)
 * @param options - { block: boolean } - if true, throws instead of warning
 * @returns true if valid, false if missing required meaning column(s)
 */
export function guardMeaningInsert(
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[],
  options: { block?: boolean } = { block: true }
): boolean {
  const config = MEANING_PROTECTED_CONFIG[table];
  if (!config) {
    return true; // Not a protected table
  }

  const rows = Array.isArray(payload) ? payload : [payload];
  const requiredColumns = config.filter(col => !col.endsWith('?'));
  // Optional columns (ending with '?') are not enforced

  for (const row of rows) {
    for (const col of requiredColumns) {
      if (!row[col]) {
        const message = `[ULL Guard] ⚠️ Insert into "${table}" without required meaning column "${col}". This violates the Meaning-First rule. Payload: ${JSON.stringify(row, null, 2).slice(0, 200)}`;
        
        if (options.block) {
          console.error(message);
          throw new Error(`[ULL Guard] Blocked insert into "${table}" — "${col}" is required.`);
        }

        console.warn(message);
        return false;
      }
    }
  }

  return true;
}
