import { Sparkles, CheckCircle2, Loader2, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

function cleanAIResponse(text: string): string {
  return text
    .replace(/```ULL_MEANING_V1[\s\S]*?```/gi, '')
    .replace(/```(?:json|typescript|javascript|ts|js)?\s*[\s\S]*?```/gi, '')
    .trim();
}

export interface ActionItem {
  title: string;
  type: 'task' | 'decision';
  applied: boolean;
}

interface Props {
  summary: string | null;
  summaryLoading: boolean;
  actionItems: ActionItem[];
  onGenerateSummary: () => void;
  onSaveAndApply: () => void;
  saving: boolean;
}

export default function StepSummaryActions({
  summary, summaryLoading, actionItems,
  onGenerateSummary, onSaveAndApply, saving,
}: Props) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('workboard.checkinPage.summaryAndActions')}
        </CardTitle>
        <CardDescription>{t('workboard.checkinPage.summaryAndActionsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary && !summaryLoading && (
          <Button onClick={onGenerateSummary} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            {t('workboard.checkinPage.generateSummary')}
          </Button>
        )}

        {summaryLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {summary && (
          <div className="prose prose-sm prose-invert max-w-none p-3 rounded-lg bg-primary/5">
            <ReactMarkdown>{cleanAIResponse(summary)}</ReactMarkdown>
          </div>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {t('workboard.checkinPage.actionItemsList')}
            </p>
            {actionItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded bg-card border border-border">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${item.type === 'task' ? 'text-primary' : 'text-yellow-500'}`} />
                <span className="text-sm text-foreground flex-1">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.type === 'task' ? t('workboard.checkinPage.taskType') : t('workboard.checkinPage.decisionType')}
                </span>
              </div>
            ))}
          </div>
        )}

        {summary && (
          <Button onClick={onSaveAndApply} className="w-full" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {t('workboard.checkinPage.saveAndApply')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
