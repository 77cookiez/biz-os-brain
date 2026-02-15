/**
 * Recovery & Backup Hooks — Server-Side Only (v2)
 *
 * All operations go through the safeback-engine Edge Function.
 * NO direct table deletes/inserts from the client.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  captureFullSnapshot,
  previewRestore as enginePreview,
  restoreFromSnapshot,
  type PreviewResult,
} from '@/core/snapshot/engine';

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
  created_by: string;
  created_at: string;
}

export type RestorePreview = PreviewResult;

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
        .select('id, workspace_id, snapshot_type, created_by, created_at')
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

// ─── createSnapshot (server-side via Edge Function) ───

export function useCreateSnapshot() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace || !user) throw new Error('Not authenticated');
      return captureFullSnapshot(currentWorkspace.id, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      toast.success('Snapshot created successfully');
    },
    onError: () => toast.error('Failed to create snapshot'),
  });
}

// ─── previewRestore (server-side via Edge Function) ───

export function usePreviewRestore() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!user) throw new Error('Not authenticated');
      return enginePreview(snapshotId, user.id);
    },
    onError: () => toast.error('Failed to preview restore'),
  });
}

// ─── restoreSnapshot (server-side via Edge Function, atomic RPC) ───

export function useRestoreSnapshot() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ snapshotId, confirmationToken }: { snapshotId: string; confirmationToken: string }) => {
      if (!user || !currentWorkspace) throw new Error('Not authenticated');
      const restoredCounts = await restoreFromSnapshot(
        snapshotId,
        confirmationToken,
        user.id,
        currentWorkspace.id,
      );
      return { success: true, restored_counts: restoredCounts };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      const counts = data.restored_counts;
      const summary = Object.entries(counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      toast.success(`Restored: ${summary}`);
    },
    onError: () => toast.error('Failed to restore snapshot'),
  });
}

// ─── exportSnapshot (unchanged) ───

export function useExportSnapshot() {
  return useMutation({
    mutationFn: async (snapshotId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Not authenticated');

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
