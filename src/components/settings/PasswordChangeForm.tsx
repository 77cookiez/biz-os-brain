import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function PasswordChangeForm() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (password: string): { label: string; color: string; width: string } => {
    if (password.length === 0) return { label: '', color: 'bg-muted', width: '0%' };
    if (password.length < 6) return { label: t('account.passwordWeak'), color: 'bg-destructive', width: '25%' };
    if (password.length < 8) return { label: t('account.passwordFair'), color: 'bg-yellow-500', width: '50%' };
    if (password.length < 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { label: t('account.passwordGood'), color: 'bg-primary', width: '75%' };
    }
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
      return { label: t('account.passwordStrong'), color: 'bg-green-500', width: '100%' };
    }
    return { label: t('account.passwordGood'), color: 'bg-primary', width: '75%' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error(t('account.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('account.passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success(t('account.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || t('account.passwordUpdateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleShowPassword = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">{t('account.newPassword')}</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPasswords.new ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => toggleShowPassword('new')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {newPassword && (
          <div className="space-y-1">
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                style={{ width: passwordStrength.width }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">{t('account.confirmPassword')}</Label>
        <div className="relative">
          <Input
            id="confirm-password"
            type={showPasswords.confirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => toggleShowPassword('confirm')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="text-xs text-destructive">{t('account.passwordMismatch')}</p>
        )}
      </div>

      <Button 
        type="submit" 
        disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
      >
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t('account.updatePassword')}
      </Button>
    </form>
  );
}
