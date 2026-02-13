/**
 * Single Source of Truth: Tenant Resolution
 *
 * All booking contexts (public, vendor, admin) MUST use this resolver
 * to go from tenantSlug → workspace details. Never query booking_settings
 * directly for tenant resolution outside this file.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ResolvedTenant {
  id: string;           // booking_settings.id
  workspace_id: string;
  workspace_name: string;
  tenant_slug: string;
  is_live: boolean;
  primary_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  currency: string;
  theme_template: string;
  contact_email: string | null;
  whatsapp_number: string | null;
  cancellation_policy: string;
  deposit_enabled: boolean;
  deposit_type: string | null;
  deposit_value: number | null;
  tone: string | null;
}

/**
 * Resolve a tenant slug to full workspace + booking settings.
 * Uses the SECURITY DEFINER RPC to ensure safe, public-accessible resolution.
 */
export async function resolveTenanBySlug(slug: string): Promise<ResolvedTenant | null> {
  if (!slug) return null;

  const { data, error } = await supabase.rpc('get_live_booking_tenant_by_slug', {
    p_slug: slug,
  });

  if (error) {
    console.error('[TenantResolver] RPC error:', error.message);
    return null;
  }

  return data as unknown as ResolvedTenant | null;
}

/**
 * React Query key factory for tenant resolution.
 * Ensures consistent cache keys across all booking modules.
 */
export const tenantQueryKey = (slug: string | undefined) =>
  ['booking-tenant', slug] as const;

/**
 * React Query options for tenant resolution.
 * Use with useQuery for consistent caching + error handling.
 */
export function tenantQueryOptions(slug: string | undefined) {
  return {
    queryKey: tenantQueryKey(slug),
    queryFn: () => resolveTenanBySlug(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 min — tenant settings rarely change
  };
}
