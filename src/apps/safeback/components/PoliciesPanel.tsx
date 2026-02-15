import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { FallbackProviderDescriptors } from '@/core/snapshot/providerRegistry';
import type { SnapshotPolicy } from '@/core/snapshot/types';
import type { BackupSettings } from '@/hooks/useRecovery';
import { toast } from 'sonner';

interface PoliciesPanelProps {
  settings: BackupSettings | null;
  onUpdate: (updates: Partial<BackupSettings>) => void;
  updatePending?: boolean;
}

const policyLabels: Record<SnapshotPolicy, string> = {
  none: 'Not protected',
  metadata_only: 'Metadata only',
  full: 'Full data',
  full_plus_files: 'Full + file refs',
};

const policyIcons: Record<SnapshotPolicy, typeof ShieldCheck> = {
  none: ShieldOff,
  metadata_only: ShieldAlert,
  full: ShieldCheck,
  full_plus_files: ShieldCheck,
};

const policyVariants: Record<SnapshotPolicy, 'destructive' | 'secondary' | 'default' | 'outline'> = {
  none: 'destructive',
  metadata_only: 'secondary',
  full: 'default',
  full_plus_files: 'default',
};

export default function PoliciesPanel({ settings, onUpdate, updatePending }: PoliciesPanelProps) {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  // Fetch effective providers from DB
  const { data: effectiveProviders } = useQuery({
    queryKey: ['effective-providers', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return FallbackProviderDescriptors.map(p => ({
        ...p,
        effective_policy: p.default_policy,
        include_files: false,
        limits: {},
      }));

      const { data, error } = await (supabase as any).rpc('get_effective_snapshot_providers', {
        _workspace_id: workspaceId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Update per-provider policy
  const updatePolicy = useMutation({
    mutationFn: async ({ providerId, policy }: { providerId: string; policy: SnapshotPolicy }) => {
      if (!workspaceId) throw new Error('No workspace');
      const { error } = await (supabase as any)
        .from('snapshot_provider_policies')
        .upsert(
          { workspace_id: workspaceId, provider_id: providerId, policy, updated_at: new Date().toISOString() },
          { onConflict: 'workspace_id,provider_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['effective-providers'] });
      toast.success('Provider policy updated');
    },
    onError: () => toast.error('Failed to update policy'),
  });

  const providers = effectiveProviders || FallbackProviderDescriptors.map(p => ({
    ...p,
    effective_policy: p.default_policy,
    include_files: false,
    limits: {},
  }));

  return (
    <div className="space-y-4">
      {/* Provider Coverage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('apps.safeback.policies.coverage', 'Provider Coverage')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground mb-2">
            {t('apps.safeback.policies.coverageDesc', 'Configure what data each provider captures in snapshots.')}
          </p>
          <div className="space-y-3">
            {providers.map((p: any) => {
              const effectivePolicy = (p.effective_policy || p.default_policy) as SnapshotPolicy;
              const Icon = policyIcons[effectivePolicy];
              return (
                <div key={p.provider_id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        <Badge variant={p.critical ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {p.critical ? 'Critical' : 'Optional'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={policyVariants[effectivePolicy]} className="text-[10px]">
                      {policyLabels[effectivePolicy]}
                    </Badge>
                    <Select
                      value={effectivePolicy}
                      onValueChange={(v) => updatePolicy.mutate({ providerId: p.provider_id, policy: v as SnapshotPolicy })}
                      disabled={updatePolicy.isPending}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not protected</SelectItem>
                        <SelectItem value="metadata_only">Metadata only</SelectItem>
                        <SelectItem value="full">Full data</SelectItem>
                        {!p.critical && (
                          <SelectItem value="full_plus_files">Full + files</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Retention Policy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('apps.safeback.policies.title', 'Retention Policies')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('apps.safeback.policies.retainCount', 'Maximum snapshots to retain')}</Label>
            <p className="text-xs text-muted-foreground">{t('apps.safeback.policies.retainDesc', 'Older snapshots beyond this limit are automatically removed.')}</p>
            <Select
              value={String(settings?.retain_count || 30)}
              onValueChange={(v) => onUpdate({ retain_count: parseInt(v) })}
              disabled={updatePending}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 snapshots</SelectItem>
                <SelectItem value="14">14 snapshots</SelectItem>
                <SelectItem value="30">30 snapshots</SelectItem>
                <SelectItem value="60">60 snapshots</SelectItem>
                <SelectItem value="90">90 snapshots</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
