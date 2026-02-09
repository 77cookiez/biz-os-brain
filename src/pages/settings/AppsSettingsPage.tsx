import { useState, useEffect } from 'react';
import { Package, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface AppInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: string;
  pricing: string;
  is_active: boolean;
}

export default function AppsSettingsPage() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentWorkspace, installedApps, activateApp, deactivateApp, refreshInstalledApps } = useWorkspace();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (currentWorkspace) {
      fetchApps();
    }
  }, [currentWorkspace?.id, installedApps]);

  const fetchApps = async () => {
    if (!currentWorkspace) return;
    setLoading(true);

    const installedIds = installedApps.map(a => a.app_id);
    if (installedIds.length === 0) {
      setApps([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('app_registry')
      .select('id, name, description, icon, status, pricing')
      .in('id', installedIds);

    if (data) {
      const merged = data.map(app => ({
        ...app,
        is_active: installedApps.find(a => a.app_id === app.id)?.is_active ?? false,
      }));
      setApps(merged);
    }
    setLoading(false);
  };

  const handleToggle = async (appId: string, currentActive: boolean) => {
    try {
      if (currentActive) {
        await deactivateApp(appId);
        toast.success('App deactivated');
      } else {
        await activateApp(appId);
        toast.success('App activated');
      }
    } catch {
      toast.error('Failed to update app');
    }
  };

  const handleUninstall = async (appId: string, appName: string) => {
    if (!currentWorkspace) return;
    try {
      const { error } = await supabase
        .from('workspace_apps')
        .delete()
        .eq('workspace_id', currentWorkspace.id)
        .eq('app_id', appId);

      if (error) throw error;

      await refreshInstalledApps();
      toast.success(`${appName} uninstalled`);
    } catch {
      toast.error('Failed to uninstall app');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.apps.title', 'Installed Apps')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('settings.apps.description', 'Manage your installed applications')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/marketplace')}>
          <Store className="h-4 w-4 mr-2" />
          {t('navigation.marketplace', 'Marketplace')}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : apps.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2">
              {t('settings.apps.empty', 'No apps installed')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('settings.apps.emptyDescription', 'Visit the Marketplace to discover and install apps')}
            </p>
            <Button onClick={() => navigate('/marketplace')}>
              <Store className="h-4 w-4 mr-2" />
              {t('settings.apps.browse', 'Browse Marketplace')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {apps.map(app => (
            <div
              key={app.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{app.name}</p>
                  <Badge variant={app.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {app.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {app.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{app.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={app.is_active}
                  onCheckedChange={() => handleToggle(app.id, app.is_active)}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-foreground">Uninstall {app.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the app from your workspace. You can reinstall it later from the Marketplace.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleUninstall(app.id, app.name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Uninstall
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
