/**
 * SafeBack hooks — re-exports from the shared Recovery hooks
 * plus SafeBack-specific hooks.
 */
export {
  useRecoverySettings,
  useSnapshots,
  useCreateSnapshot,
  usePreviewRestore,
  useRestoreSnapshot,
  useExportSnapshot,
  type BackupSettings,
  type Snapshot,
  type RestorePreview,
} from '@/hooks/useRecovery';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useState } from 'react';

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_user_id: string;
  entity_id: string | null;
  entity_type: string;
  metadata: Record<string, any> | null;
  created_at: string;
  workspace_id: string;
}

export function useAuditLogs(page = 0, pageSize = 20) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useQuery({
    queryKey: ['safeback-audit-logs', workspaceId, page, pageSize],
    queryFn: async () => {
      if (!workspaceId) return { data: [] as AuditLogEntry[], count: 0 };

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .or('action.like.workspace.snapshot_%,action.like.workspace.restore_%,action.like.workspace.backup_%')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: (data || []) as AuditLogEntry[], count: count || 0 };
    },
    enabled: !!workspaceId,
  });
}
