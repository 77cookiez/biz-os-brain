import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface BrainProposal {
  id: string;
  type: 'task' | 'goal' | 'plan' | 'idea' | 'update';
  title: string;
  payload: Record<string, unknown>;
  required_role: 'member' | 'owner';
  confirmation_hash?: string;
  expires_at?: number;
}

interface ExecutionError {
  code: string;
  reason: string;
  suggested_action: string;
}

const EXECUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-execute-action`;

export function useBrainExecute() {
  const [isSigningProposals, setIsSigningProposals] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [signedProposals, setSignedProposals] = useState<BrainProposal[]>([]);
  const [executionError, setExecutionError] = useState<ExecutionError | null>(null);
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  /** Sign proposals server-side to get HMAC confirmation hashes */
  const signProposals = useCallback(async (proposals: BrainProposal[]): Promise<BrainProposal[]> => {
    if (!currentWorkspace || proposals.length === 0) return [];
    setIsSigningProposals(true);
    setExecutionError(null);

    try {
      const token = await getAccessToken();
      if (!token) { toast.error(t('common.authRequired')); return []; }

      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'sign',
          proposals,
          workspace_id: currentWorkspace.id,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setExecutionError(err as ExecutionError);
        toast.error(err.reason || 'Failed to sign proposals');
        return [];
      }

      const { proposals: signed } = await resp.json();
      setSignedProposals(signed);
      return signed;
    } catch (e) {
      console.error('[BrainExecute] Sign error:', e);
      toast.error('Failed to prepare proposals');
      return [];
    } finally {
      setIsSigningProposals(false);
    }
  }, [currentWorkspace, getAccessToken, t]);

  /** Execute a single signed proposal */
  const executeProposal = useCallback(async (proposal: BrainProposal): Promise<{ success: boolean; result?: unknown }> => {
    if (!currentWorkspace) return { success: false };
    setIsExecuting(true);
    setExecutionError(null);

    try {
      const token = await getAccessToken();
      if (!token) { toast.error(t('common.authRequired')); return { success: false }; }

      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'execute',
          proposal,
          workspace_id: currentWorkspace.id,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setExecutionError(data as ExecutionError);
        
        if (data.code === 'EXECUTION_DENIED') {
          if (data.reason?.includes('expired')) {
            toast.error(t('brain.proposalExpired', 'Proposal expired. Please regenerate.'));
          } else if (data.reason?.includes('role') || data.reason?.includes('permission')) {
            toast.error(t('brain.insufficientRole', 'Insufficient permissions for this action.'));
          } else {
            toast.error(data.reason || 'Execution denied');
          }
        }
        return { success: false };
      }

      // Remove from signed list
      setSignedProposals(prev => prev.filter(p => p.id !== proposal.id));
      return { success: true, result: data.result };
    } catch (e) {
      console.error('[BrainExecute] Execute error:', e);
      toast.error('Execution failed');
      return { success: false };
    } finally {
      setIsExecuting(false);
    }
  }, [currentWorkspace, getAccessToken, t]);

  const clearProposals = useCallback(() => {
    setSignedProposals([]);
    setExecutionError(null);
  }, []);

  return {
    signProposals,
    executeProposal,
    signedProposals,
    isSigningProposals,
    isExecuting,
    executionError,
    clearProposals,
  };
}
