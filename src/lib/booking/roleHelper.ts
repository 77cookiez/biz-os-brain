/**
 * Booking RBAC Helper
 *
 * Centralised role checks for booking module.
 * Roles: 'admin' | 'owner' | 'vendor' | 'customer' | 'member'
 */
import { supabase } from '@/integrations/supabase/client';

export type BookingRole = 'admin' | 'owner' | 'vendor' | 'customer' | 'member';

export interface UserRoleInfo {
  roles: BookingRole[];
  vendorId: string | null;
  vendorStatus: string | null;
}

/**
 * Determine user's booking roles for a specific workspace.
 * Returns all matching roles so callers can check any combination.
 */
export async function getUserBookingRoles(
  workspaceId: string,
  userId: string
): Promise<UserRoleInfo> {
  const roles: BookingRole[] = [];
  let vendorId: string | null = null;
  let vendorStatus: string | null = null;

  // Check workspace membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('team_role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (member) {
    roles.push('member');
    if (member.team_role === 'owner') {
      roles.push('owner');
    }
  }

  // Check company-level admin/owner roles
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('company_id')
    .eq('id', workspaceId)
    .single();

  if (workspace?.company_id) {
    const { data: companyRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('company_id', workspace.company_id)
      .eq('user_id', userId);

    companyRoles?.forEach(r => {
      if (r.role === 'owner' && !roles.includes('owner')) roles.push('owner');
      if (r.role === 'admin' && !roles.includes('admin')) roles.push('admin');
    });
  }

  // Check vendor status
  const { data: vendor } = await supabase
    .from('booking_vendors')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (vendor) {
    vendorId = vendor.id;
    vendorStatus = vendor.status;
    roles.push('vendor');
  }

  // Check if customer (has quote requests)
  const { count } = await supabase
    .from('booking_quote_requests')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('customer_user_id', userId);

  if (count && count > 0) {
    roles.push('customer');
  }

  return { roles, vendorId, vendorStatus };
}

/**
 * Check if user has ANY of the required roles.
 * Throws if none match.
 */
export async function requireRole(
  workspaceId: string,
  userId: string,
  requiredRoles: BookingRole[]
): Promise<UserRoleInfo> {
  const info = await getUserBookingRoles(workspaceId, userId);
  const hasRole = requiredRoles.some(r => info.roles.includes(r));

  if (!hasRole) {
    throw new Error(
      `Access denied: user requires one of [${requiredRoles.join(', ')}], ` +
      `has [${info.roles.join(', ')}]`
    );
  }

  return info;
}
