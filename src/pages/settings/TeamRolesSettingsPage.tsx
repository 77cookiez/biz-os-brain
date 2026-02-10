import { useState } from 'react';
import { ArrowLeft, UserPlus, Users, Mail, Shield, MoreHorizontal, Trash2, MessageCircle } from 'lucide-react';
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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const ok = await inviteMember(inviteEmail.trim(), inviteRole, customRoleName.trim() || undefined);
    if (ok) {
      setInviteEmail('');
      setCustomRoleName('');
      setInviteRole('operations');
      setInviteOpen(false);
    }
    setInviting(false);
  };

  const handleWhatsApp = () => {
    if (!currentWorkspace) return;
    const link = generateWhatsAppLink(currentWorkspace.name);
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
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Mail className="h-4 w-4" />
                {t('settings.team.sendInvite')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">{t('settings.team.inviteMember')}</DialogTitle>
              </DialogHeader>
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
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                  >
                    <Mail className="h-4 w-4" />
                    {inviting ? t('common.loading') : t('settings.team.sendInvite')}
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">{t('common.or', 'or')}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={handleWhatsApp}>
                  <MessageCircle className="h-4 w-4" />
                  {t('settings.team.inviteViaWhatsApp', 'Invite via WhatsApp')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="gap-2" onClick={handleWhatsApp}>
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
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                      {member.full_name[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {member.full_name} {isSelf && <span className="text-muted-foreground">({t('common.you', 'You')})</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.invite_status}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role badge or selector */}
                    {isOwner && !isOwnerMember && !isSelf ? (
                      <Select
                        value={member.team_role}
                        onValueChange={(v) => {
                          if (v === 'custom') {
                            // For custom, show a prompt-like approach
                            const name = prompt(t('settings.team.customRolePlaceholder', 'Enter custom role name'));
                            if (name) updateMemberRole(member.id, 'custom', name);
                          } else {
                            updateMemberRole(member.id, v as TeamRole);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
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
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {getRoleLabel(member.team_role, member.custom_role_name)}
                      </Badge>
                    )}

                    {/* Remove button (owner only, not self, not other owners) */}
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
