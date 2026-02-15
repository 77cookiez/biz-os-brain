import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Database } from 'lucide-react';
import type { BackupSettings } from '@/hooks/useRecovery';

interface ScheduleSettingsProps {
  settings: BackupSettings | null;
  onUpdate: (updates: Partial<BackupSettings>) => void;
  updatePending?: boolean;
}

export default function ScheduleSettings({ settings, onUpdate, updatePending }: ScheduleSettingsProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          {t('recovery.settings', 'Backup Settings')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>{t('recovery.autoBackup', 'Automatic Backups')}</Label>
            <p className="text-xs text-muted-foreground">{t('recovery.autoBackupDesc', 'Create snapshots on a schedule')}</p>
          </div>
          <Switch
            checked={settings?.is_enabled ?? false}
            onCheckedChange={(checked) => onUpdate({ is_enabled: checked })}
            disabled={updatePending}
          />
        </div>

        {settings?.is_enabled && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('recovery.cadence', 'Frequency')}</Label>
                <Select value={settings?.cadence || 'daily'} onValueChange={(v) => onUpdate({ cadence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('recovery.retention', 'Keep latest')}</Label>
                <Select value={String(settings?.retain_count || 30)} onValueChange={(v) => onUpdate({ retain_count: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 snapshots</SelectItem>
                    <SelectItem value="14">14 snapshots</SelectItem>
                    <SelectItem value="30">30 snapshots</SelectItem>
                    <SelectItem value="60">60 snapshots</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
