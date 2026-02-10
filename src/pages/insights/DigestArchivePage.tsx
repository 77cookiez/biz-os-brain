import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, Archive, CheckCircle2, TrendingUp, ShieldAlert,
  MessageSquare, Sparkles, ChevronLeft, Calendar
} from 'lucide-react';
import { useDigestArchive, DigestArchiveItem } from '@/hooks/useDigestArchive';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function DigestArchivePage() {
  const { t } = useTranslation();
  const { digests, loading, error } = useDigestArchive();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      {/* Header */}
      <div className="pt-2 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => navigate('/insights')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            {t('digest.archiveTitle', 'Weekly Digest Archive')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('digest.archiveSubtitle', 'Browse your past weekly summaries')}
          </p>
        </div>
      </div>

      {/* Empty State */}
      {digests.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-16 text-center">
            <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Archive className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {t('digest.archiveEmpty', 'No digests yet')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('digest.archiveEmptyDesc', 'Weekly digests will appear here after your first week of activity.')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Digest List */}
      {digests.map((digest) => (
        <DigestCard
          key={digest.id}
          digest={digest}
          expanded={expandedId === digest.id}
          onToggle={() => setExpandedId(expandedId === digest.id ? null : digest.id)}
        />
      ))}
    </div>
  );
}

function DigestCard({
  digest,
  expanded,
  onToggle,
}: {
  digest: DigestArchiveItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const stats = digest.stats;
  const isEmpty = stats.tasks_created === 0 && stats.tasks_completed === 0;

  return (
    <Card
      className={`border-border bg-card transition-all cursor-pointer hover:border-primary/30 ${
        expanded ? 'ring-1 ring-primary/20' : ''
      }`}
      onClick={onToggle}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            {digest.week_start} — {digest.week_end}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!digest.read_at && (
              <Badge variant="default" className="text-xs">
                {t('digest.unread', 'New')}
              </Badge>
            )}
            {isEmpty && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {t('digest.quiet', 'Quiet week')}
              </Badge>
            )}
          </div>
        </div>
        {/* Quick stats row */}
        {!isEmpty && !expanded && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {stats.tasks_completed > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {stats.tasks_completed}
              </span>
            )}
            {stats.tasks_created > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-primary" />
                {stats.tasks_created}
              </span>
            )}
            {stats.tasks_blocked > 0 && (
              <span className="flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-orange-500" />
                {stats.tasks_blocked}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* Detailed stats */}
          <ul className="space-y-2 mb-4">
            {stats.tasks_completed > 0 && (
              <li className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                {t('digest.completed', 'You completed {{count}} tasks', { count: stats.tasks_completed })}
              </li>
            )}
            {stats.tasks_created > 0 && (
              <li className="flex items-center gap-2 text-sm text-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                {t('digest.created', '{{count}} new tasks created', { count: stats.tasks_created })}
              </li>
            )}
            {stats.tasks_blocked > 0 && (
              <li className="flex items-center gap-2 text-sm text-foreground">
                <ShieldAlert className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                {t('digest.blocked', '{{count}} items are currently blocked', { count: stats.tasks_blocked })}
              </li>
            )}
            {stats.tasks_from_chat > 0 && (
              <li className="flex items-center gap-2 text-sm text-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                {t('digest.fromChat', '{{count}} tasks from conversations', { count: stats.tasks_from_chat })}
              </li>
            )}
          </ul>

          {/* Narrative */}
          {digest.narrative_text && (
            <div className="border-l-2 border-primary/20 pl-3 mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('digest.aiSummary', 'AI Summary')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground italic">{digest.narrative_text}</p>
            </div>
          )}

          {isEmpty && (
            <p className="text-sm text-muted-foreground">
              {digest.narrative_text || t('digest.empty', "Nothing major happened this week — but you're all set for the next one.")}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
