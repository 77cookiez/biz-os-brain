import { useState } from 'react';
import { ArrowLeft, UserPlus, Users, Mail, Shield, MoreHorizontal, Trash2, MessageCircle, Copy, Check, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { useTeamMembers, PREDEFINED_ROLES, type TeamRole } from '@/hooks/useTeamMembers';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function TeamRolesSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const {
    members, loading, isOwner,
    inviteMember, updateMemberRole, removeMember, generateWhatsAppLink,
  } = useTeamMembers();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('operations');
  const [customRoleName, setCustomRoleName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/auth`;

  const handleCopyLink = async () => {
    const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team member';
    const roleName = getRoleLabel(inviteRole, customRoleName);
    const text = `👋 Hi! ${inviterName} invited you to join "${currentWorkspace?.name}" on AiBizOS as ${roleName}.\n\n🚀 Sign up here: ${inviteLink}\n\nSee you inside! 🎯`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Invite link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLinkForMember = async (memberName: string, memberRole: TeamRole, memberCustomRole: string | null) => {
    const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team member';
    const roleName = getRoleLabel(memberRole, memberCustomRole);
    const text = `👋 Hi${memberName ? ' ' + memberName : ''}! ${inviterName} invited you to join "${currentWorkspace?.name}" on AiBizOS as ${roleName}.\n\n🚀 Sign up here: ${inviteLink}\n\nSee you inside! 🎯`;
    await navigator.clipboard.writeText(text);
    toast.success('Invite link copied!');
  };

  const handleWhatsAppForMember = (memberName: string, memberRole: TeamRole, memberCustomRole: string | null) => {
    if (!currentWorkspace) return;
    const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team member';
    const roleName = getRoleLabel(memberRole, memberCustomRole);
    const link = generateWhatsAppLink(currentWorkspace.name, inviterName, roleName, currentWorkspace.name);
    window.open(link, '_blank');
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team member';
    const companyName = currentWorkspace?.name || '';
    const ok = await inviteMember(
      inviteEmail.trim(), inviteRole, customRoleName.trim() || undefined,
      inviterName, companyName
    );
    if (ok) {
      setInviteSuccess({ email: inviteEmail.trim(), name: inviterName });
      setInviteEmail('');
      setCustomRoleName('');
      setInviteRole('operations');
    }
    setInviting(false);
  };

  const handleCloseInviteDialog = (open: boolean) => {
    setInviteOpen(open);
    if (!open) {
      setInviteSuccess(null);
      setCopied(false);
    }
  };

  const handleWhatsApp = (role?: string) => {
    if (!currentWorkspace) return;
    const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team member';
    const roleName = role || getRoleLabel(inviteRole, customRoleName);
    const link = generateWhatsAppLink(currentWorkspace.name, inviterName, roleName, currentWorkspace.name);
    window.open(link, '_blank');
  };

  const getRoleLabel = (role: TeamRole, customName: string | null) => {
    if (role === 'custom' && customName) return customName;
    const found = PREDEFINED_ROLES.find(r => r.value === role);
    return found ? t(found.labelKey, role.charAt(0).toUpperCase() + role.slice(1)) : role;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{t('settings.team.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('settings.team.description')}</p>
        </div>
      </div>

      {/* Invite Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          {t('settings.team.inviteMember')}
        </h3>
        <div className="flex gap-2">
          <Dialog open={inviteOpen} onOpenChange={handleCloseInviteDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Mail className="h-4 w-4" />
                {t('settings.team.sendInvite')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {inviteSuccess ? '✅ Member Added!' : t('settings.team.inviteMember')}
                </DialogTitle>
              </DialogHeader>

              {inviteSuccess ? (
                /* Success state with shareable link */
                <div className="space-y-4 pt-2">
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 text-center space-y-2">
                    <p className="text-sm text-foreground font-medium">
                      {inviteSuccess.email} has been added to the workspace!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Share the invite link below so they can sign up and join.
                    </p>
                  </div>

                  {/* Copy invite link */}
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteLink}
                      className="text-xs bg-secondary/50"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={handleCopyLink}
                    >
                      <Link2 className="h-4 w-4" />
                      {copied ? 'Copied!' : 'Copy Invite Message'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => handleWhatsApp()}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setInviteSuccess(null)}
                  >
                    + Invite another member
                  </Button>
                </div>
              ) : (
                /* Invite form */
                <div className="space-y-4 pt-2">
                  <Input
                    type="email"
                    placeholder={t('settings.team.enterEmail')}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {PREDEFINED_ROLES.filter(r => r.value !== 'owner').map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          {t(r.labelKey, r.value.charAt(0).toUpperCase() + r.value.slice(1))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {inviteRole === 'custom' && (
                    <Input
                      placeholder={t('settings.team.customRolePlaceholder', 'Enter custom role name')}
                      value={customRoleName}
                      onChange={(e) => setCustomRoleName(e.target.value)}
                    />
                  )}
                  <Button
                    className="w-full gap-2"
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                  >
                    <UserPlus className="h-4 w-4" />
                    {inviting ? t('common.loading') : 'Add & Get Invite Link'}
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-card px-2 text-muted-foreground">{t('common.or', 'or')}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={() => handleWhatsApp()}>
                    <MessageCircle className="h-4 w-4" />
                    {t('settings.team.inviteViaWhatsApp', 'Invite via WhatsApp')}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="gap-2" onClick={() => handleWhatsApp()}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Team Members */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t('settings.team.teamMembers')} ({members.length})
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isSelf = member.user_id === user?.id;
              const isOwnerMember = member.team_role === 'owner';

              return (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  {/* Member info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                      {member.full_name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.full_name || member.email || 'Invited User'}
                        </p>
                        {isSelf && <span className="text-xs text-muted-foreground">({t('common.you', 'You')})</span>}
                        {/* Mobile role badge */}
                        <Badge variant="outline" className="text-[10px] sm:hidden flex items-center gap-1 shrink-0">
                          <Shield className="h-2.5 w-2.5" />
                          {getRoleLabel(member.team_role, member.custom_role_name)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {member.email && <span className="truncate">{member.email}</span>}
                        {member.email && <span>•</span>}
                        <span className="shrink-0">{member.invite_status === 'pending' ? '⏳ Pending' : '✅ Active'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap ps-[52px] sm:ps-0 shrink-0">
                    {isOwner && member.invite_status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => handleCopyLinkForMember(member.full_name, member.team_role, member.custom_role_name)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t('settings.team.copyLink', 'Copy Link')}</span>
                          <span className="sm:hidden">Copy</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleWhatsAppForMember(member.full_name, member.team_role, member.custom_role_name)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}

                    {isOwner && !isOwnerMember && !isSelf ? (
                      <Select
                        value={member.team_role}
                        onValueChange={(v) => {
                          if (v === 'custom') {
                            const name = prompt(t('settings.team.customRolePlaceholder', 'Enter custom role name'));
                            if (name) updateMemberRole(member.id, 'custom', name);
                          } else {
                            updateMemberRole(member.id, v as TeamRole);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[120px] sm:w-[130px] h-8 text-xs hidden sm:flex">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {PREDEFINED_ROLES.filter(r => r.value !== 'owner').map(r => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">
                              {t(r.labelKey, r.value.charAt(0).toUpperCase() + r.value.slice(1))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs items-center gap-1 hidden sm:flex">
                        <Shield className="h-3 w-3" />
                        {getRoleLabel(member.team_role, member.custom_role_name)}
                      </Badge>
                    )}

                    {isOwner && !isSelf && !isOwnerMember && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive text-xs gap-2"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('settings.team.removeMember', 'Remove member')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
