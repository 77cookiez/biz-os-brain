import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield } from 'lucide-react';
import type { BackupSettings } from '@/hooks/useRecovery';

interface PoliciesPanelProps {
  settings: BackupSettings | null;
  onUpdate: (updates: Partial<BackupSettings>) => void;
  updatePending?: boolean;
}

export default function PoliciesPanel({ settings, onUpdate, updatePending }: PoliciesPanelProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t('apps.safeback.policies.title', 'Retention Policies')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t('apps.safeback.policies.retainCount', 'Maximum snapshots to retain')}</Label>
          <p className="text-xs text-muted-foreground">{t('apps.safeback.policies.retainDesc', 'Older snapshots beyond this limit are automatically removed.')}</p>
          <Select
            value={String(settings?.retain_count || 30)}
            onValueChange={(v) => onUpdate({ retain_count: parseInt(v) })}
            disabled={updatePending}
          >
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 snapshots</SelectItem>
              <SelectItem value="14">14 snapshots</SelectItem>
              <SelectItem value="30">30 snapshots</SelectItem>
              <SelectItem value="60">60 snapshots</SelectItem>
              <SelectItem value="90">90 snapshots</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
