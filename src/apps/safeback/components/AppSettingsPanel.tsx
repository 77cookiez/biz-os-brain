import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import ScheduleSettings from './ScheduleSettings';
import PoliciesPanel from './PoliciesPanel';
import type { BackupSettings } from '@/hooks/useRecovery';

interface AppSettingsPanelProps {
  settings: BackupSettings | null;
  onUpdate: (updates: Partial<BackupSettings>) => void;
  updatePending?: boolean;
}

export default function AppSettingsPanel({ settings, onUpdate, updatePending }: AppSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t('apps.safeback.settings.title', 'SafeBack Settings')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t('apps.safeback.settings.subtitle', 'Configure backup schedules and retention policies.')}</p>
      </div>
      <ScheduleSettings settings={settings} onUpdate={onUpdate} updatePending={updatePending} />
      <PoliciesPanel settings={settings} onUpdate={onUpdate} updatePending={updatePending} />
    </div>
  );
}
