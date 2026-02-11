import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

interface Props {
  completedItems: string[];
}

export default function StepCompleted({ completedItems }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          {t('workboard.checkinPage.completedThisWeek')}
        </CardTitle>
        <CardDescription>{t('workboard.checkinPage.completedDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {completedItems.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('workboard.checkinPage.noTasksCompleted')}</p>
        ) : (
          completedItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
