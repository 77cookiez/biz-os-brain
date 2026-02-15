import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

const features = [
  { key: 'manualSnapshots', free: true, pro: true, enterprise: true },
  { key: 'restoreWithToken', free: true, pro: true, enterprise: true },
  { key: 'preRestoreSafety', free: true, pro: true, enterprise: true },
  { key: 'scheduledBackups', free: false, pro: true, enterprise: true },
  { key: 'higherRetention', free: false, pro: true, enterprise: true },
  { key: 'storageExport', free: false, pro: true, enterprise: true },
  { key: 'complianceReports', free: false, pro: false, enterprise: true },
  { key: 'drDrills', free: false, pro: false, enterprise: true },
  { key: 'immutableBackups', free: false, pro: false, enterprise: true },
];

function Cell({ val }: { val: boolean }) {
  return val ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
}

export default function PlansUpsell() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('apps.safeback.plans.title', 'SafeBack Plans')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">{t('apps.safeback.plans.feature', 'Feature')}</th>
                <th className="text-center py-2 px-3">
                  <Badge variant="secondary">Free</Badge>
                </th>
                <th className="text-center py-2 px-3">
                  <Badge variant="default">Pro</Badge>
                </th>
                <th className="text-center py-2 px-3">
                  <Badge variant="outline">Enterprise</Badge>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.key} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-foreground">{t(`apps.safeback.plans.${f.key}`, f.key)}</td>
                  <td className="py-2 px-3"><Cell val={f.free} /></td>
                  <td className="py-2 px-3"><Cell val={f.pro} /></td>
                  <td className="py-2 px-3"><Cell val={f.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
