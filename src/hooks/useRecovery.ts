/**
 * Recovery & Backup Hooks
 * Resilience Layer API for the Recovery Center UI
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ───

export interface BackupSettings {
  workspace_id: string;
  is_enabled: boolean;
  cadence: string;
  retain_count: number;
  include_tables: string[];
  store_in_storage: boolean;
}

export interface Snapshot {
  id: string;
  workspace_id: string;
  snapshot_type: string;
  created_reason: string;
  size_bytes: number | null;
  storage_path: string | null;
  checksum: string | null;
  created_by: string;
  created_at: string;
}

export interface RestorePreview {
  confirmation_token: string;
  summary: {
    will_replace: Record<string, number>;
    will_restore: Record<string, number>;
    snapshot_created_at: string;
    snapshot_type: string;
    snapshot_reason: string;
  };
  expires_in_seconds: number;
}

// ─── useRecoverySettings ───

export function useRecoverySettings() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['backup-settings', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await (supabase as any)
        .from('workspace_backup_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data as BackupSettings | null;
    },
    enabled: !!workspaceId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<BackupSettings>) => {
      if (!workspaceId) throw new Error('No workspace');
      const { error } = await (supabase as any)
        .from('workspace_backup_settings')
        .upsert({ workspace_id: workspaceId, ...updates }, { onConflict: 'workspace_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
      toast.success('Backup settings updated');
    },
    onError: () => toast.error('Failed to update backup settings'),
  });

  return { settings, isLoading, updateSettings };
}

// ─── useSnapshots ───

export function useSnapshots() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['snapshots', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await (supabase as any)
        .from('workspace_snapshots')
        .select('id, workspace_id, snapshot_type, created_reason, size_bytes, storage_path, checksum, created_by, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
    enabled: !!workspaceId,
  });

  return { snapshots, isLoading, refetch: () => queryClient.invalidateQueries({ queryKey: ['snapshots'] }) };
}

// ─── createSnapshot ───

export function useCreateSnapshot() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace || !user) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('create_workspace_snapshot', {
        _workspace_id: currentWorkspace.id,
        _snapshot_type: 'manual',
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      toast.success('Snapshot created successfully');
    },
    onError: () => toast.error('Failed to create snapshot'),
  });
}

// ─── previewRestore ───

export function usePreviewRestore() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('preview_restore_snapshot', {
        _snapshot_id: snapshotId,
        _actor: user.id,
      });
      if (error) throw error;
      return data as unknown as RestorePreview;
    },
    onError: () => toast.error('Failed to preview restore'),
  });
}

// ─── restoreSnapshot ───

export function useRestoreSnapshot() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ snapshotId, confirmationToken }: { snapshotId: string; confirmationToken: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('restore_workspace_snapshot', {
        _snapshot_id: snapshotId,
        _actor: user.id,
        _confirmation_token: confirmationToken,
      });
      if (error) throw error;
      return data as unknown as { success: boolean; restored_counts: Record<string, number> };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      const counts = data.restored_counts;
      toast.success(`Restored ${counts.tasks} tasks, ${counts.goals} goals, ${counts.plans} plans, ${counts.ideas} ideas`);
    },
    onError: () => toast.error('Failed to restore snapshot'),
  });
}

// ─── exportSnapshot ───

export function useExportSnapshot() {
  return useMutation({
    mutationFn: async (snapshotId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('backup-export', {
        body: null,
        headers: { Authorization: `Bearer ${token}` },
      });

      // Use query params approach
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-export?snapshot_id=${snapshotId}`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!resp.ok) throw new Error('Export failed');
      const result = await resp.json();

      if (result.download_url) {
        window.open(result.download_url, '_blank');
      } else if (result.snapshot) {
        // Download inline JSON
        const blob = new Blob([JSON.stringify(result.snapshot, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `snapshot-${snapshotId}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    },
    onSuccess: () => toast.success('Snapshot exported'),
    onError: () => toast.error('Failed to export snapshot'),
  });
}
