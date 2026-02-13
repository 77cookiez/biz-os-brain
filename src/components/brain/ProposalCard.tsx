import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Shield, Clock, AlertTriangle } from 'lucide-react';
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
};

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  member: 'secondary',
  admin: 'default',
  owner: 'destructive',
};

export function ProposalCard({ proposal, onConfirm, onReject, isExecuting }: ProposalCardProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  const isExpired = proposal.expires_at ? Date.now() > proposal.expires_at : false;
  const timeLeft = proposal.expires_at
    ? Math.max(0, Math.round((proposal.expires_at - Date.now()) / 1000 / 60))
    : null;

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
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] capitalize">
                {proposal.type}
              </Badge>
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
          {t('brain.confirm', 'Confirm & Execute')}
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
