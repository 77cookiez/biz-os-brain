import { useState } from 'react';
import { Lightbulb, Loader2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

export interface IssueItem {
  id: string;
  issue: string;
  source: 'blocked' | 'off_track';
  resolution?: string;
  accepted?: boolean;
  loading?: boolean;
}

interface Props {
  issues: IssueItem[];
  onRequestSolution: (issueId: string) => void;
  onAcceptResolution: (issueId: string) => void;
  onSkipResolution: (issueId: string) => void;
}

export default function StepIDS({ issues, onRequestSolution, onAcceptResolution, onSkipResolution }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          {t('workboard.checkinPage.problemSolving')}
        </CardTitle>
        <CardDescription>{t('workboard.checkinPage.problemSolvingDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {issues.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('workboard.checkinPage.noIssues')}</p>
        ) : (
          issues.map(item => (
            <div key={item.id} className="p-3 rounded-lg border border-border space-y-2">
              <div className="flex items-start gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  item.source === 'blocked' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-destructive/10 text-destructive'
                }`}>
                  {item.source === 'blocked' 
                    ? t('workboard.checkinPage.blockedLabel') 
                    : t('workboard.checkinPage.offTrackLabel')}
                </span>
                <p className="text-sm text-foreground flex-1">{item.issue}</p>
              </div>

              {!item.resolution && !item.loading && (
                <Button variant="outline" size="sm" onClick={() => onRequestSolution(item.id)}>
                  <Lightbulb className="h-3.5 w-3.5 mr-1" />
                  {t('workboard.checkinPage.suggestSolution')}
                </Button>
              )}

              {item.loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('workboard.checkinPage.thinking')}
                </div>
              )}

              {item.resolution && !item.loading && (
                <div className="space-y-2">
                  <div className="p-2 rounded bg-primary/5 text-sm prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{item.resolution}</ReactMarkdown>
                  </div>
                  {item.accepted === undefined && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onAcceptResolution(item.id)}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {t('workboard.checkinPage.acceptSolution')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onSkipResolution(item.id)}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        {t('workboard.checkinPage.skip')}
                      </Button>
                    </div>
                  )}
                  {item.accepted === true && (
                    <span className="text-xs text-emerald-500 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {t('workboard.checkinPage.accepted')}
                    </span>
                  )}
                  {item.accepted === false && (
                    <span className="text-xs text-muted-foreground">{t('workboard.checkinPage.skipped')}</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
