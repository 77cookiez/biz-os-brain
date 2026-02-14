import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { DraftObject, DryRunResult } from '@/lib/agentContract';

// ─── Legacy Proposal type (kept for backward compat) ───

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
  suggested_action?: string;
}

const EXECUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-execute-action`;

export function useBrainExecute() {
  const [isSigningProposals, setIsSigningProposals] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [signedProposals, setSignedProposals] = useState<BrainProposal[]>([]);
  const [executionError, setExecutionError] = useState<ExecutionError | null>(null);
  // Draft dry-run results keyed by draft.id
  const [dryRunResults, setDryRunResults] = useState<Record<string, DryRunResult>>({});
  const [isDryRunning, setIsDryRunning] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  // ─── Legacy: Sign proposals ───

  const signProposals = useCallback(async (proposals: BrainProposal[]): Promise<BrainProposal[]> => {
    if (!currentWorkspace || proposals.length === 0) return [];
    setIsSigningProposals(true);
    setExecutionError(null);

    try {
      const token = await getAccessToken();
      if (!token) { toast.error(t('common.authRequired')); return []; }

      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'sign', proposals, workspace_id: currentWorkspace.id }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setExecutionError(err as ExecutionError);
        toast.error((err as ExecutionError).reason || 'Failed to sign proposals');
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

  // ─── Legacy: Execute proposal ───

  const executeProposal = useCallback(async (proposal: BrainProposal): Promise<{ success: boolean; result?: unknown }> => {
    if (!currentWorkspace) return { success: false };
    setIsExecuting(true);
    setExecutionError(null);

    try {
      const token = await getAccessToken();
      if (!token) { toast.error(t('common.authRequired')); return { success: false }; }

      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'execute', proposal, workspace_id: currentWorkspace.id }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setExecutionError(data as ExecutionError);
        if (data.code === 'EXECUTION_DENIED') {
          if (data.reason?.includes('expired')) toast.error(t('brain.proposalExpired', 'Proposal expired. Please regenerate.'));
          else if (data.reason?.includes('role') || data.reason?.includes('permission')) toast.error(t('brain.insufficientRole', 'Insufficient permissions for this action.'));
          else toast.error(data.reason || 'Execution denied');
        }
        return { success: false };
      }

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

  // ─── Draft: Dry run ───

  const dryRunDraft = useCallback(async (draft: DraftObject): Promise<DryRunResult | null> => {
    if (!currentWorkspace) return null;
    setIsDryRunning(true);

    try {
      const token = await getAccessToken();
      if (!token) { toast.error(t('common.authRequired')); return null; }

      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'dry_run', workspace_id: currentWorkspace.id, draft }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        console.error('[BrainExecute] dry_run error:', data);
        return null;
      }

      const result = data as DryRunResult;
      setDryRunResults(prev => ({ ...prev, [draft.id]: result }));
      return result;
    } catch (e) {
      console.error('[BrainExecute] dry_run error:', e);
      return null;
    } finally {
      setIsDryRunning(false);
    }
  }, [currentWorkspace, getAccessToken, t]);

  // ─── Draft: Confirm (get hash) ───

  const confirmDraft = useCallback(async (draft: DraftObject): Promise<{ confirmation_hash: string; expires_at: number; meaning_object_id?: string } | null> => {
    if (!currentWorkspace) return null;

    try {
      const token = await getAccessToken();
      if (!token) { toast.error(t('common.authRequired')); return null; }

      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'confirm', workspace_id: currentWorkspace.id, draft }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        console.error('[BrainExecute] confirm error:', data);
        toast.error(data.reason || 'Failed to confirm draft');
        return null;
      }
      return data as { confirmation_hash: string; expires_at: number; meaning_object_id?: string };
    } catch (e) {
      console.error('[BrainExecute] confirm error:', e);
      toast.error('Failed to confirm draft');
      return null;
    }
  }, [currentWorkspace, getAccessToken, t]);

  // ─── Draft: Execute ───

  const executeDraft = useCallback(async (draft: DraftObject, confirmationHash?: string): Promise<{ success: boolean; entities?: { type: string; id: string; action: string }[] }> => {
    if (!currentWorkspace) return { success: false };
    setIsExecuting(true);
    setExecutionError(null);

    try {
      const token = await getAccessToken();
      if (!token) { toast.error(t('common.authRequired')); return { success: false }; }

      // If no hash provided, request one first
      let hash = confirmationHash;
      let expiresAt = draft.expires_at;
      let resolvedDraft = draft;
      if (!hash) {
        const confirmResult = await confirmDraft(draft);
        if (!confirmResult) return { success: false };
        hash = confirmResult.confirmation_hash;
        expiresAt = confirmResult.expires_at;
        // Patch meaning if minted during confirm
        if (confirmResult.meaning_object_id) {
          resolvedDraft = { ...draft, meaning: { meaning_object_id: confirmResult.meaning_object_id } };
        }
      }

      const draftWithExpiry = { ...resolvedDraft, expires_at: expiresAt };

      const resp = await fetch(EXECUTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'execute', workspace_id: currentWorkspace.id, draft: draftWithExpiry, confirmation_hash: hash }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setExecutionError(data as ExecutionError);
        if (data.reason?.includes('expired')) toast.error(t('brain.proposalExpired', 'Draft expired. Please regenerate.'));
        else if (data.reason?.includes('role') || data.reason?.includes('permission')) toast.error(t('brain.insufficientRole', 'Insufficient permissions.'));
        else toast.error(data.reason || 'Execution failed');
        return { success: false };
      }

      // Clear dry-run cache for this draft
      setDryRunResults(prev => {
        const next = { ...prev };
        delete next[draft.id];
        return next;
      });

      return { success: true, entities: data.entities };
    } catch (e) {
      console.error('[BrainExecute] executeDraft error:', e);
      toast.error('Execution failed');
      return { success: false };
    } finally {
      setIsExecuting(false);
    }
  }, [currentWorkspace, getAccessToken, t, confirmDraft]);

  const clearProposals = useCallback(() => {
    setSignedProposals([]);
    setExecutionError(null);
    setDryRunResults({});
  }, []);

  return {
    // Legacy
    signProposals,
    executeProposal,
    signedProposals,
    isSigningProposals,
    // Draft pipeline
    dryRunDraft,
    confirmDraft,
    executeDraft,
    dryRunResults,
    isDryRunning,
    // Shared
    isExecuting,
    executionError,
    clearProposals,
  };
}
