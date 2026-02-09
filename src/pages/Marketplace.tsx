import { useState, useEffect } from 'react';
import { Search, Package, ArrowRight, Check, Loader2, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isSystemApp, HIDDEN_FROM_MARKETPLACE } from '@/lib/systemApps';

interface AppItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  pricing: 'free' | 'paid' | 'subscription';
  status: 'active' | 'available' | 'coming_soon';
  capabilities: string[];
}

const pricingLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  free: { label: 'Free', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'default' },
  subscription: { label: 'Subscription', variant: 'outline' },
};

export default function Marketplace() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [activating, setActivating] = useState(false);
  const { installedApps, activateApp, deactivateApp } = useWorkspace();

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    const { data } = await supabase
      .from('app_registry')
      .select('*')
      .not('id', 'in', `(${HIDDEN_FROM_MARKETPLACE.join(',')})`)
      .order('name');
    setApps((data as AppItem[]) || []);
  };

  const isAppInstalled = (appId: string) => installedApps.some(a => a.app_id === appId && a.is_active);

  const handleActivate = async (app: AppItem) => {
    setActivating(true);
    try {
      await activateApp(app.id);
      toast.success(`${app.name} activated!`);
      setSelectedApp(null);
    } finally {
      setActivating(false);
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
          return (
            <Card key={app.id} className={`border-border bg-card cursor-pointer hover:border-primary/50 ${app.status === 'coming_soon' ? 'opacity-50' : ''}`} onClick={() => setSelectedApp(app)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {systemApp ? <Shield className="h-5 w-5 text-primary" /> : <Package className="h-5 w-5 text-primary" />}
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
                <DialogTitle>{selectedApp.name}</DialogTitle>
                <DialogDescription>{selectedApp.description}</DialogDescription>
              </DialogHeader>
              <div className="pt-4">
                {isSystemApp(selectedApp.id) ? (
                  <div className="text-center space-y-2">
                    <Badge variant="outline" className="border-primary/30 text-primary">System App — Always Active</Badge>
                    <p className="text-xs text-muted-foreground">This is a core OS module required by other apps. It cannot be deactivated or removed.</p>
                  </div>
                ) : selectedApp.status === 'coming_soon' ? (
                  <Button disabled className="w-full">Coming Soon</Button>
                ) : isAppInstalled(selectedApp.id) ? (
                  <Button variant="secondary" className="w-full" onClick={() => { deactivateApp(selectedApp.id); setSelectedApp(null); toast.success('Deactivated'); }}>Deactivate</Button>
                ) : (
                  <Button className="w-full" onClick={() => handleActivate(selectedApp)} disabled={activating}>
                    {activating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Activate<ArrowRight className="h-4 w-4 ml-2" />
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
