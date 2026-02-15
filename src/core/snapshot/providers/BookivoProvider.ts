/**
 * BookivoProvider — Descriptor only (v2).
 * Capture/restore logic is entirely server-side.
 * Caps: max_rows_per_table=5000, files=refs only.
 */
import type { ProviderDescriptor } from '../types';

export const BookivoDescriptor: ProviderDescriptor = {
  provider_id: 'bookivo',
  name: 'Bookivo',
  description: 'Booking services, vendors, availability, bookings, quotes, settings (file refs only)',
  critical: true,
  default_policy: 'full',
  is_enabled: true,
};

// Legacy export for backward compat with tests
export const BookivoProvider = {
  id: 'bookivo',
  version: 1,
  describe: () => ({
    name: BookivoDescriptor.name,
    description: BookivoDescriptor.description,
    critical: BookivoDescriptor.critical,
  }),
};
