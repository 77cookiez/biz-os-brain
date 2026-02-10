import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type TeamRole = 'owner' | 'operations' | 'sales' | 'marketing' | 'finance' | 'custom';

export interface TeamMember {
  id: string;
  user_id: string;
  team_role: TeamRole;
  custom_role_name: string | null;
  invite_status: string;
  joined_at: string | null;
  full_name: string;
  email?: string;
}

export const PREDEFINED_ROLES: { value: TeamRole; labelKey: string }[] = [
  { value: 'owner', labelKey: 'settings.team.role.owner' },
  { value: 'operations', labelKey: 'settings.team.role.operations' },
  { value: 'sales', labelKey: 'settings.team.role.sales' },
  { value: 'marketing', labelKey: 'settings.team.role.marketing' },
  { value: 'finance', labelKey: 'settings.team.role.finance' },
  { value: 'custom', labelKey: 'settings.team.role.custom' },
];

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    const { data } = await supabase
      .from('workspace_members')
      .select('id, user_id, team_role, custom_role_name, invite_status, joined_at')
      .eq('workspace_id', currentWorkspace.id);

    if (data) {
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const membersWithNames: TeamMember[] = data.map(m => ({
        ...m,
        team_role: m.team_role as TeamRole,
        full_name: profiles?.find(p => p.user_id === m.user_id)?.full_name || 'Unknown',
      }));
      setMembers(membersWithNames);
    }
    setLoading(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const inviteMember = useCallback(async (
    email: string,
    teamRole: TeamRole,
    customRoleName?: string
  ): Promise<boolean> => {
    if (!currentWorkspace) return false;

    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          email,
          workspace_id: currentWorkspace.id,
          team_role: teamRole,
          custom_role_name: teamRole === 'custom' ? customRoleName : undefined,
        },
      });

      if (error) {
        toast.error('Failed to send invitation');
        return false;
      }

      if (data?.error === 'user_not_found') {
        toast.error(data.message || 'User not found. They need to sign up first.');
        return false;
      }

      if (data?.error === 'already_member') {
        toast.error(data.message || 'Already a member');
        return false;
      }

      if (data?.error) {
        toast.error(data.error);
        return false;
      }

      toast.success(`${data.member?.full_name || email} added to workspace!`);
      fetchMembers();
      return true;
    } catch {
      toast.error('Failed to invite member');
      return false;
    }
  }, [currentWorkspace?.id, fetchMembers]);

  const updateMemberRole = useCallback(async (
    memberId: string,
    teamRole: TeamRole,
    customRoleName?: string
  ): Promise<boolean> => {
    if (!currentWorkspace) return false;

    try {
      const { data, error } = await supabase.functions.invoke('manage-member', {
        body: {
          member_id: memberId,
          workspace_id: currentWorkspace.id,
          team_role: teamRole,
          custom_role_name: teamRole === 'custom' ? customRoleName : undefined,
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Failed to update role');
        return false;
      }

      toast.success('Role updated');
      fetchMembers();
      return true;
    } catch {
      toast.error('Failed to update role');
      return false;
    }
  }, [currentWorkspace?.id, fetchMembers]);

  const removeMember = useCallback(async (memberId: string): Promise<boolean> => {
    if (!currentWorkspace) return false;

    try {
      const { data, error } = await supabase.functions.invoke('manage-member', {
        body: {
          member_id: memberId,
          workspace_id: currentWorkspace.id,
          action: 'remove',
        },
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Failed to remove member');
        return false;
      }

      toast.success('Member removed');
      fetchMembers();
      return true;
    } catch {
      toast.error('Failed to remove member');
      return false;
    }
  }, [currentWorkspace?.id, fetchMembers]);

  const isOwner = members.some(m => m.user_id === user?.id && m.team_role === 'owner');

  const generateWhatsAppLink = useCallback((workspaceName: string) => {
    const appUrl = window.location.origin;
    const message = encodeURIComponent(
      `🚀 You're invited to join "${workspaceName}" on AiBizOS!\n\n` +
      `1. Sign up at: ${appUrl}/auth\n` +
      `2. Once registered, the workspace owner will add you.\n\n` +
      `Join now and collaborate with your team!`
    );
    return `https://wa.me/?text=${message}`;
  }, []);

  return {
    members,
    loading,
    isOwner,
    inviteMember,
    updateMemberRole,
    removeMember,
    fetchMembers,
    generateWhatsAppLink,
  };
}
