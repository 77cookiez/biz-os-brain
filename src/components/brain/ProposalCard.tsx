import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Shield, Clock, AlertTriangle, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { BrainProposal } from '@/hooks/useBrainExecute';

interface ProposalCardProps {
  proposal: BrainProposal;
  onConfirm: (proposal: BrainProposal) => Promise<void>;
  onReject: (proposal: BrainProposal) => void;
  isExecuting: boolean;
}

const typeIcons: Record<string, string> = {
  task: '📋',
  goal: '🎯',
  plan: '📊',
  idea: '💡',
  update: '✏️',
  draft_plan: '📝',
  draft_message: '💬',
  draft_design_change: '🎨',
  draft_task_set: '📦',
};

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  member: 'secondary',
  owner: 'destructive',
};

export function ProposalCard({ proposal, onConfirm, onReject, isExecuting }: ProposalCardProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isExpired = proposal.expires_at ? Date.now() > proposal.expires_at : false;
  const timeLeft = proposal.expires_at
    ? Math.max(0, Math.round((proposal.expires_at - Date.now()) / 1000 / 60))
    : null;

  // Extract draft-specific fields
  const scope = proposal.payload.scope as { affected_modules?: string[]; impact_summary?: string; affected_entities?: { entity_type: string; action: string; diff?: Record<string, unknown> }[] } | undefined;
  const risks = (proposal.payload.risks as string[]) || [];
  const isDraft = proposal.type.startsWith('draft_');

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(proposal);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-3 transition-all",
      isExpired ? "border-destructive/30 opacity-60" : "border-border hover:border-primary/30",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{typeIcons[proposal.type] || '📄'}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{proposal.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] capitalize">
                {isDraft ? 'Draft' : proposal.type}
              </Badge>
              {isDraft && (
                <Badge variant="secondary" className="text-[10px]">
                  <Eye className="h-2.5 w-2.5 mr-0.5" />
                  Preview
                </Badge>
              )}
              <Badge variant={roleBadgeVariant[proposal.required_role] || 'secondary'} className="text-[10px]">
                <Shield className="h-2.5 w-2.5 mr-0.5" />
                {proposal.required_role}
              </Badge>
            </div>
          </div>
        </div>

        {timeLeft !== null && !isExpired && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            {timeLeft}m
          </div>
        )}
      </div>

      {/* Payload preview */}
      {proposal.payload.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {proposal.payload.description as string}
        </p>
      )}

      {/* Dry-Run Preview (expandable) */}
      {(scope || risks.length > 0) && (
        <div className="space-y-2">
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Eye className="h-3 w-3" />
            {t('brain.preview', 'Preview Impact')}
            {previewOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {previewOpen && (
            <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2 text-xs">
              {/* Impact summary */}
              {scope?.impact_summary && (
                <p className="text-foreground">{scope.impact_summary}</p>
              )}

              {/* Affected modules */}
              {scope?.affected_modules && scope.affected_modules.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground">Modules:</span>
                  {scope.affected_modules.map(m => (
                    <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
              )}

              {/* Affected entities (diff) */}
              {scope?.affected_entities && scope.affected_entities.length > 0 && (
                <div className="space-y-1">
                  {scope.affected_entities.map((entity, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant={entity.action === 'delete' ? 'destructive' : entity.action === 'create' ? 'default' : 'secondary'} className="text-[10px]">
                        {entity.action}
                      </Badge>
                      <span className="text-muted-foreground">{entity.entity_type}</span>
                      {entity.diff && Object.entries(entity.diff).map(([field, value]) => {
                        const diffVal = value as { before?: unknown; after?: unknown } | unknown;
                        if (diffVal && typeof diffVal === 'object' && 'before' in diffVal && 'after' in diffVal) {
                          return (
                            <span key={field} className="text-muted-foreground">
                              {field}: <span className="line-through text-destructive">{String((diffVal as { before: unknown }).before)}</span> → <span className="text-primary">{String((diffVal as { after: unknown }).after)}</span>
                            </span>
                          );
                        }
                        return (
                          <span key={field} className="text-muted-foreground">
                            {field}: {JSON.stringify(diffVal)}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Risks */}
              {risks.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border">
                  <span className="text-muted-foreground font-medium">⚠️ Risks:</span>
                  {risks.map((risk, i) => (
                    <p key={i} className="text-muted-foreground ps-4">• {risk}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expired warning */}
      {isExpired && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          {t('brain.proposalExpired', 'Proposal expired. Please regenerate.')}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-8 text-xs flex-1"
          onClick={handleConfirm}
          disabled={isExpired || confirming || isExecuting}
        >
          {confirming ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          )}
          {isDraft
            ? t('brain.confirmDraft', 'Approve & Execute')
            : t('brain.confirm', 'Confirm & Execute')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onReject(proposal)}
          disabled={confirming || isExecuting}
        >
          <XCircle className="h-3 w-3 mr-1" />
          {t('brain.dismiss', 'Dismiss')}
        </Button>
      </div>
    </div>
  );
}
