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
    customRoleName?: string,
    inviterName?: string,
    companyName?: string
  ): Promise<boolean> => {
    if (!currentWorkspace) return false;

    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          email,
          workspace_id: currentWorkspace.id,
          team_role: teamRole,
          custom_role_name: teamRole === 'custom' ? customRoleName : undefined,
          inviter_name: inviterName,
          company_name: companyName,
        },
      });

      // functions.invoke puts non-2xx responses in error
      if (error) {
        // Try to parse the error response body
        let errBody: any = null;
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === 'function') {
            errBody = await ctx.json();
          }
        } catch {}

        if (errBody?.error === 'user_not_found') {
          toast.error(errBody.message || 'User not found. They need to sign up first.');
        } else if (errBody?.error === 'already_member') {
          toast.error(errBody.message || 'Already a member');
        } else {
          toast.error(errBody?.error || errBody?.message || 'Failed to send invitation');
        }
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

  const generateWhatsAppLink = useCallback((
    workspaceName: string,
    inviterName?: string,
    roleName?: string,
    companyName?: string
  ) => {
    const appUrl = window.location.origin;
    const inviter = inviterName || 'Your teammate';
    const company = companyName || workspaceName;
    const role = roleName ? `\n📋 *Your Role:* ${roleName}` : '';

    const message = encodeURIComponent(
      `👋 Hi there!\n\n` +
      `*${inviter}* has invited you to join *${company}* on AiBizOS — your AI-powered business operating system.\n` +
      role + `\n\n` +
      `🚀 *Getting Started:*\n` +
      `1️⃣ Sign up here: ${appUrl}/auth\n` +
      `2️⃣ Complete your profile\n` +
      `3️⃣ You'll be added to the *${workspaceName}* workspace automatically\n\n` +
      `💡 AiBizOS helps teams manage tasks, collaborate, and grow smarter — all in one place.\n\n` +
      `See you inside! 🎯`
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
