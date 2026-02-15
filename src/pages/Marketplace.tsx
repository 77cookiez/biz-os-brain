import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Package, ArrowRight, Check, Loader2, Shield, Crown, ExternalLink, Settings, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isSystemApp, HIDDEN_FROM_MARKETPLACE } from '@/lib/systemApps';
import safebackIcon from '@/assets/safeback-icon.png';

interface AppItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  pricing: 'free' | 'paid' | 'subscription';
  status: 'active' | 'available' | 'coming_soon' | 'deprecated';
  capabilities: string[];
}

const pricingLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  free: { label: 'Free', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'default' },
  subscription: { label: 'Subscription', variant: 'outline' },
};

const iconMap: Record<string, React.ElementType> = {
  crown: Crown,
};

/** Apps that use a custom image icon instead of a Lucide icon */
const appImageIcons: Record<string, string> = {
  safeback: safebackIcon,
};

export default function Marketplace() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const { installedApps, activateApp, deactivateApp, currentWorkspace, refreshInstalledApps } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchApps();
  }, []);

  // Auto-highlight app from query param
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight && apps.length > 0) {
      const app = apps.find(a => a.id === highlight);
      if (app) setSelectedApp(app);
    }
  }, [searchParams, apps]);

  const fetchApps = async () => {
    const hidden = HIDDEN_FROM_MARKETPLACE.map(id => `"${id}"`).join(',');
    const { data } = await supabase
      .from('app_registry')
      .select('*')
      .not('id', 'in', `(${hidden})`)
      .eq('status', 'available')
      .order('name', { ascending: true });
    setApps((data as AppItem[]) || []);
  };

  const isAppInstalled = (appId: string) => installedApps.some(a => a.app_id === appId && a.is_active);

  const handleActivate = async (app: AppItem) => {
    setActivating(true);
    try {
      await activateApp(app.id);

      // Write audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user && currentWorkspace) {
        await supabase.from('audit_logs').insert({
          workspace_id: currentWorkspace.id,
          actor_user_id: user.id,
          action: 'app.install',
          entity_type: 'app',
          entity_id: app.id,
          metadata: { app_id: app.id, plan: app.pricing },
        });
      }

      toast.success(`${app.name} activated!`);
      setSelectedApp(null);
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async (app: AppItem) => {
    setDeactivating(true);
    try {
      await deactivateApp(app.id);

      if (currentWorkspace) {
        await supabase
          .from('workspace_apps')
          .update({ uninstalled_at: new Date().toISOString() } as any)
          .eq('workspace_id', currentWorkspace.id)
          .eq('app_id', app.id);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('audit_logs').insert({
            workspace_id: currentWorkspace.id,
            actor_user_id: user.id,
            action: 'app.uninstall',
            entity_type: 'app',
            entity_id: app.id,
            metadata: { app_id: app.id, plan: app.pricing },
          });
        }
      }

      await refreshInstalledApps();
      toast.success(`${app.name} deactivated`);
      setSelectedApp(null);
    } finally {
      setDeactivating(false);
    }
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">App Marketplace</h1>
        <p className="text-muted-foreground">Extend AI Brain with specialized business apps</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search apps..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-input border-border" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredApps.map(app => {
          const installed = isAppInstalled(app.id);
          const systemApp = isSystemApp(app.id);
          const AppIcon = iconMap[app.icon || ''] || Package;
          return (
            <Card key={app.id} className={`border-border bg-card cursor-pointer hover:border-primary/50 ${app.status === 'coming_soon' ? 'opacity-50' : ''}`} onClick={() => setSelectedApp(app)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                    {appImageIcons[app.id] ? (
                      <img src={appImageIcons[app.id]} alt={app.name} className="h-10 w-10 rounded-lg object-cover" />
                    ) : systemApp ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <AppIcon className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {systemApp && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">System</Badge>}
                    <Badge variant={pricingLabels[app.pricing].variant}>{pricingLabels[app.pricing].label}</Badge>
                  </div>
                </div>
                <CardTitle className="text-foreground mt-3">{app.name}</CardTitle>
                <CardDescription className="line-clamp-2">{app.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {installed ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><Check className="h-3 w-3 mr-1" />{systemApp ? 'Always Active' : 'Installed'}</Badge>
                ) : app.status === 'coming_soon' ? (
                  <Badge variant="secondary">Coming Soon</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Click to install</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="bg-card border-border">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {appImageIcons[selectedApp.id] && (
                    <img src={appImageIcons[selectedApp.id]} alt={selectedApp.name} className="h-8 w-8 rounded-lg" />
                  )}
                  {selectedApp.name}
                  <Badge variant={pricingLabels[selectedApp.pricing].variant} className="text-[10px]">
                    {pricingLabels[selectedApp.pricing].label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedApp.description}</DialogDescription>
              </DialogHeader>

              {selectedApp.capabilities && selectedApp.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedApp.capabilities.map(cap => (
                    <Badge key={cap} variant="secondary" className="text-[10px]">
                      {cap.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="pt-4 space-y-2">
                {isSystemApp(selectedApp.id) ? (
                  <div className="text-center space-y-2">
                    <Badge variant="outline" className="border-primary/30 text-primary">System App — Always Active</Badge>
                    <p className="text-xs text-muted-foreground">This is a core OS module required by other apps. It cannot be deactivated or removed.</p>
                  </div>
                ) : selectedApp.status === 'coming_soon' ? (
                  <Button disabled className="w-full">Coming Soon</Button>
                ) : isAppInstalled(selectedApp.id) ? (
                  <div className="space-y-2">
                    <Button className="w-full gap-2" onClick={() => { navigate(`/apps/${selectedApp.id}`); setSelectedApp(null); }}>
                      <ExternalLink className="h-4 w-4" />
                      Open App
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { navigate(`/apps/${selectedApp.id}/settings`); setSelectedApp(null); }}>
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1 gap-1.5" onClick={() => handleDeactivate(selectedApp)} disabled={deactivating}>
                        {deactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Uninstall
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => handleActivate(selectedApp)} disabled={activating}>
                    {activating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {selectedApp.pricing === 'paid' ? 'Install (Paid)' : 'Activate'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
