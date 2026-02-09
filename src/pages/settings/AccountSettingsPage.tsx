import { ArrowLeft, User, Mail, Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName });
      toast.success(t('account.profileUpdated'));
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('account.profileUpdateFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmail = async () => {
    if (email === user?.email) {
      toast.info(t('account.emailUnchanged'));
      return;
    }

    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success(t('account.emailConfirmationSent'));
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || t('account.emailUpdateFailed'));
    } finally {
      setSavingEmail(false);
    }
  };

  const handleAvatarUpload = async (url: string) => {
    await updateProfile({ avatar_url: url || null });
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
          <h1 className="text-2xl font-bold text-foreground">{t('account.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('account.description')}</p>
        </div>
      </div>

      {/* Profile Section */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('account.profile')}</h2>
        </div>

        <AvatarUpload
          currentAvatarUrl={profile?.avatar_url || null}
          userId={user?.id || ''}
          displayName={fullName || user?.email?.split('@')[0] || 'User'}
          onUploadComplete={handleAvatarUpload}
        />

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="full-name">{t('account.fullName')}</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('account.fullNamePlaceholder')}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('account.saveProfile')}
          </Button>
        </div>
      </div>

      {/* Email Section */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('account.emailSection')}</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('account.email')}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
          <p className="text-xs text-muted-foreground">{t('account.emailHint')}</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveEmail} disabled={savingEmail}>
            {savingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('account.updateEmail')}
          </Button>
        </div>
      </div>

      {/* Password Section */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('account.passwordSection')}</h2>
        </div>

        <PasswordChangeForm />
      </div>
    </div>
  );
}
