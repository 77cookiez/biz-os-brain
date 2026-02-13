import { Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ULLText } from '@/components/ull/ULLText';

export interface GoalReview {
  goalId: string;
  title: string;
  meaningObjectId?: string | null;
  sourceLang?: string;
  status: 'on_track' | 'off_track' | 'pending';
  kpiCurrent?: number | null;
  kpiTarget?: number | null;
  kpiName?: string | null;
}

interface Props {
  goalReviews: GoalReview[];
  onUpdateStatus: (goalId: string, status: 'on_track' | 'off_track') => void;
}

export default function StepGoalReview({ goalReviews, onUpdateStatus }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          {t('workboard.checkinPage.goalReview')}
        </CardTitle>
        <CardDescription>{t('workboard.checkinPage.goalReviewDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {goalReviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('workboard.checkinPage.noActiveGoals')}</p>
        ) : (
          goalReviews.map(goal => (
            <div key={goal.goalId} className="p-3 rounded-lg border border-border space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <ULLText meaningId={goal.meaningObjectId} table="goals" id={goal.goalId} field="title" fallback={goal.title} sourceLang={goal.sourceLang || 'en'} className="text-sm font-medium text-foreground truncate" as="p" />
                  {goal.kpiName && (
                    <p className="text-xs text-muted-foreground">
                      {goal.kpiName}: {goal.kpiCurrent ?? 0} / {goal.kpiTarget ?? '—'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={goal.status === 'on_track' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdateStatus(goal.goalId, 'on_track')}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  {t('workboard.checkinPage.onTrack')}
                </Button>
                <Button
                  variant={goal.status === 'off_track' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => onUpdateStatus(goal.goalId, 'off_track')}
                  className="flex-1"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  {t('workboard.checkinPage.offTrack')}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
