import { ArrowLeft, UserPlus, Users, Mail, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function TeamRolesSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Mock team members
  const [members] = useState<TeamMember[]>([
    { id: '1', name: 'You', email: 'owner@example.com', role: 'Owner' },
  ]);

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }
    toast.success(t('toast.inviteSent', { email: inviteEmail }));
    setInviteEmail('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
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
          <Input
            placeholder={t('settings.team.enterEmail')}
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleInvite}>
            <Mail className="h-4 w-4 mr-2" />
            {t('settings.team.sendInvite')}
          </Button>
        </div>
      </div>

      {/* Team Members */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t('settings.team.teamMembers')}
        </h3>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                  {member.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
