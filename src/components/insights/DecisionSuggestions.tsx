import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye, X, ShieldAlert, MessageSquare, Target,
  TrendingDown, Loader2, Sparkles
} from 'lucide-react';
import { useDecisionSignals, DecisionSuggestion } from '@/hooks/useDecisionSignals';

const signalIcons: Record<string, React.ElementType> = {
  repeated_blocker: ShieldAlert,
  stale_discussed: MessageSquare,
  dormant_goal: Target,
  work_imbalance: TrendingDown,
};

const confidenceColors: Record<string, string> = {
  low: 'text-muted-foreground border-border',
  medium: 'text-orange-500 border-orange-500/30',
  high: 'text-destructive border-destructive/30',
};

export function DecisionSuggestions() {
  const { t } = useTranslation();
  const { suggestions, loading, error } = useDecisionSignals();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id));

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {t('decisions.loading', 'Analyzing patterns...')}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error || visibleSuggestions.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          {t('decisions.title', 'Worth a Look')}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {t('decisions.subtitle', 'Patterns noticed from your recent activity')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onDismiss={() => handleDismiss(suggestion.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionCard({
  suggestion,
  onDismiss,
}: {
  suggestion: DecisionSuggestion;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const Icon = signalIcons[suggestion.signal_type] || Sparkles;
  const confidenceClass = confidenceColors[suggestion.confidence_level] || confidenceColors.low;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 group">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {suggestion.explanation}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className={`text-xs ${confidenceClass}`}>
            {t(`decisions.confidence.${suggestion.confidence_level}`, suggestion.confidence_level)}
          </Badge>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
