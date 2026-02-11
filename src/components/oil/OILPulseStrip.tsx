import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { useOILIndicators, getHealthLevel, getHealthColor, getDotColor } from '@/hooks/useOILIndicators';
import { cn } from '@/lib/utils';

const INDICATOR_LABEL_MAP: Record<string, string> = {
  ExecutionHealth: 'oil.pulse.executionHealth',
  DeliveryRisk: 'oil.pulse.deliveryRisk',
  GoalProgress: 'oil.pulse.goalProgress',
};

const STATUS_LABEL_MAP: Record<string, Record<string, string>> = {
  ExecutionHealth: { needsAttention: 'oil.pulse.needsAttention', steady: 'oil.pulse.steady', strong: 'oil.pulse.strong' },
  DeliveryRisk: { needsAttention: 'oil.pulse.high', steady: 'oil.pulse.moderate', strong: 'oil.pulse.low' },
  GoalProgress: { needsAttention: 'oil.pulse.needsAttention', steady: 'oil.pulse.onTrack', strong: 'oil.pulse.strong' },
};

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'up': return <TrendingUp className="h-3 w-3" />;
    case 'down': return <TrendingDown className="h-3 w-3" />;
    default: return <Minus className="h-3 w-3" />;
  }
}

export function OILPulseStrip() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { coreIndicators, showStrip, isLoading } = useOILIndicators();

  if (!showStrip || isLoading) return null;

  return (
    <button
      onClick={() => navigate('/insights')}
      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-all group"
    >
      <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-3 overflow-x-auto flex-1">
        {coreIndicators.map((indicator, idx) => {
          const level = getHealthLevel(indicator.score);
          const dotColor = getDotColor(level);
          const textColor = getHealthColor(level);
          const labelKey = INDICATOR_LABEL_MAP[indicator.indicator_key] || indicator.indicator_key;
          const statusKey = STATUS_LABEL_MAP[indicator.indicator_key]?.[level] || `oil.pulse.${level}`;

          return (
            <div key={indicator.indicator_key} className="flex items-center gap-1.5 shrink-0">
              {idx > 0 && <span className="text-border mx-1">|</span>}
              <div className={cn('h-2 w-2 rounded-full', dotColor)} />
              <span className="text-xs text-muted-foreground">{t(labelKey)}:</span>
              <span className={cn('text-xs font-medium', textColor)}>{t(statusKey)}</span>
              <span className={textColor}>
                <TrendIcon trend={indicator.trend} />
              </span>
            </div>
          );
        })}
      </div>
    </button>
  );
}
