import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, LayoutDashboard, ListChecks, Globe, Settings, X, ChevronRight } from 'lucide-react';

const TOUR_STEPS = [
  { icon: LayoutDashboard, titleKey: 'tour.step1Title', descKey: 'tour.step1Desc' },
  { icon: Brain, titleKey: 'tour.step2Title', descKey: 'tour.step2Desc' },
  { icon: ListChecks, titleKey: 'tour.step3Title', descKey: 'tour.step3Desc' },
  { icon: Globe, titleKey: 'tour.step4Title', descKey: 'tour.step4Desc' },
  { icon: Settings, titleKey: 'tour.step5Title', descKey: 'tour.step5Desc' },
];

export function OnboardingTour() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || !currentWorkspace || checked) return;
    setChecked(true);

    supabase
      .from('onboarding_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', currentWorkspace.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setVisible(true);
      });
  }, [user?.id, currentWorkspace?.id, checked]);

  const completeTour = async () => {
    setVisible(false);
    if (!user || !currentWorkspace) return;
    await supabase.from('onboarding_completions').insert({
      user_id: user.id,
      workspace_id: currentWorkspace.id,
    });
  };

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeTour();
    }
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 border-primary/20 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <Button variant="ghost" size="icon" onClick={completeTour}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t(current.titleKey, current.titleKey)}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {t(current.descKey, current.descKey)}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <Button size="sm" onClick={handleNext} className="gap-1">
              {step < TOUR_STEPS.length - 1
                ? t('tour.next', 'Next')
                : t('tour.finish', 'Get Started')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
