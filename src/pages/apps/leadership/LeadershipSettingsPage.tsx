import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Crown, ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function LeadershipSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace, deactivateApp, refreshInstalledApps } = useWorkspace();
  const [uninstalling, setUninstalling] = useState(false);

  const handleUninstall = async () => {
    if (!currentWorkspace) return;
    setUninstalling(true);
    try {
      // Mark as uninstalled
      await deactivateApp('leadership');

      // Update uninstalled_at timestamp
      await supabase
        .from('workspace_apps')
        .update({ uninstalled_at: new Date().toISOString() } as any)
        .eq('workspace_id', currentWorkspace.id)
        .eq('app_id', 'leadership');

      // Write audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          workspace_id: currentWorkspace.id,
          actor_user_id: user.id,
          action: 'app.uninstall',
          entity_type: 'app',
          entity_id: 'leadership',
          metadata: { app_id: 'leadership', plan: 'paid' },
        });
      }

      await refreshInstalledApps();
      toast.success(t('leadership.uninstalled', 'Aurelius uninstalled'));
      navigate('/marketplace');
    } catch (err) {
      toast.error('Failed to uninstall');
    } finally {
      setUninstalling(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="pt-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/apps/leadership')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            {t('leadership.settingsTitle', 'Aurelius Settings')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('leadership.settingsSubtitle', 'Configure your Aurelius executive intelligence preferences')}
          </p>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm">{t('leadership.coachingPrefs', 'Coaching Preferences')}</CardTitle>
          <CardDescription>{t('leadership.coachingPrefsDesc', 'Customize how the AI coach interacts with you')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="proactive-coaching" className="text-sm">
              {t('leadership.proactiveCoaching', 'Proactive coaching nudges')}
            </Label>
            <Switch id="proactive-coaching" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="team-insights" className="text-sm">
              {t('leadership.teamInsights', 'Include team dynamics in Brain responses')}
            </Label>
            <Switch id="team-insights" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="meeting-briefs" className="text-sm">
              {t('leadership.meetingBriefs', 'Auto-generate meeting prep briefs')}
            </Label>
            <Switch id="meeting-briefs" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20 bg-card">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">{t('leadership.dangerZone', 'Danger Zone')}</CardTitle>
          <CardDescription>
            {t('leadership.uninstallDesc', 'Uninstalling will remove all Leadership features. Your data will be preserved but inaccessible.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                {t('leadership.uninstall', 'Uninstall Aurelius')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('leadership.confirmUninstall', 'Uninstall Aurelius?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('leadership.confirmUninstallDesc', 'This will remove Aurelius from your workspace. All executive intelligence features will be disabled. Your data will be preserved but inaccessible until you reinstall.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleUninstall} disabled={uninstalling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {uninstalling ? t('common.removing', 'Removing...') : t('common.uninstall', 'Uninstall')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
