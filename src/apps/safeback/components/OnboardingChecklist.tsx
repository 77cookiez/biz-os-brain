import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, Circle, ChevronDown, ChevronUp, X } from 'lucide-react';

const STEPS = [
  { id: 'auto_backup', labelKey: 'apps.safeback.onboarding.enableBackups', link: '/apps/safeback/schedules' },
  { id: 'retention', labelKey: 'apps.safeback.onboarding.setRetention', link: '/apps/safeback/policies' },
  { id: 'first_snapshot', labelKey: 'apps.safeback.onboarding.createSnapshot', link: '/apps/safeback/snapshots' },
  { id: 'test_restore', labelKey: 'apps.safeback.onboarding.testRestore', link: '/apps/safeback/snapshots' },
  { id: 'export', labelKey: 'apps.safeback.onboarding.exportSnapshot', link: '/apps/safeback/exports' },
];

function getStorageKey(workspaceId: string) {
  return `safeback:onboarding:v1:${workspaceId}`;
}

interface OnboardingState {
  dismissed: boolean;
  completed: string[];
}

export default function OnboardingChecklist() {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<OnboardingState>({ dismissed: false, completed: [] });

  const storageKey = currentWorkspace?.id ? getStorageKey(currentWorkspace.id) : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  const persist = (next: OnboardingState) => {
    setState(next);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const toggleStep = (stepId: string) => {
    const completed = state.completed.includes(stepId)
      ? state.completed.filter(s => s !== stepId)
      : [...state.completed, stepId];
    persist({ ...state, completed });
  };

  if (state.dismissed) return null;

  const allDone = STEPS.every(s => state.completed.includes(s.id));

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                <CardTitle className="text-base">{t('apps.safeback.onboarding.title', 'Getting Started')}</CardTitle>
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" onClick={() => persist({ ...state, dismissed: true })} title="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {state.completed.length}/{STEPS.length} {t('apps.safeback.onboarding.completed', 'completed')}
          </p>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {STEPS.map(step => {
              const done = state.completed.includes(step.id);
              return (
                <div key={step.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <button
                    className="flex items-center gap-2 text-sm text-foreground hover:underline"
                    onClick={() => toggleStep(step.id)}
                  >
                    {done ? <CheckCircle className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={done ? 'line-through text-muted-foreground' : ''}>{t(step.labelKey, step.id)}</span>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(step.link)} className="text-xs">
                    {t('common.open', 'Open')}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
