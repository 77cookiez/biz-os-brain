import { useState } from 'react';
import { Target, Sparkles, Loader2, Check, X, Edit2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';

export interface SuggestedPriority {
  id: string;
  title: string;
  accepted: boolean | undefined;
  editing?: boolean;
}

interface Props {
  priorities: SuggestedPriority[];
  suggestionsLoading: boolean;
  onRequestSuggestions: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  manualPriorities: string[];
  onManualChange: (index: number, value: string) => void;
  onSuggestManual: () => void;
  onResuggestManual: () => void;
  manualSuggestionsLoading: boolean;
}

export default function StepPriorities({
  priorities, suggestionsLoading, onRequestSuggestions,
  onAccept, onReject, onEdit,
  manualPriorities, onManualChange,
  onSuggestManual, onResuggestManual, manualSuggestionsLoading,
}: Props) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const hasManualContent = manualPriorities.some(p => p.trim() !== '');

  const startEdit = (p: SuggestedPriority) => {
    setEditingId(p.id);
    setEditValue(p.title);
  };

  const saveEdit = (id: string) => {
    onEdit(id, editValue);
    setEditingId(null);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          {t('workboard.checkinPage.nextWeekPriorities')}
        </CardTitle>
        <CardDescription>{t('workboard.checkinPage.nextWeekPrioritiesDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Suggestions */}
        {priorities.length === 0 && !suggestionsLoading && (
          <Button variant="outline" onClick={onRequestSuggestions} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            {t('workboard.checkinPage.suggestPriorities')}
          </Button>
        )}

        {suggestionsLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">{t('workboard.checkinPage.thinking')}</span>
          </div>
        )}

        {priorities.map(p => (
          <div key={p.id} className="p-3 rounded-lg border border-border space-y-2">
            {editingId === p.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="bg-input border-border text-foreground min-h-[50px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(p.id)}>
                    <Check className="h-3.5 w-3.5 mr-1" /> {t('common.save')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-foreground flex-1">{p.title}</p>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(p)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {p.accepted === undefined && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onAccept(p.id)}>
                      <Check className="h-3.5 w-3.5 mr-1" /> {t('workboard.checkinPage.acceptPriority')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onReject(p.id)}>
                      <X className="h-3.5 w-3.5 mr-1" /> {t('workboard.checkinPage.skip')}
                    </Button>
                  </div>
                )}
                {p.accepted === true && (
                  <span className="text-xs text-emerald-500 flex items-center gap-1">
                    <Check className="h-3 w-3" /> {t('workboard.checkinPage.accepted')}
                  </span>
                )}
                {p.accepted === false && (
                  <span className="text-xs text-muted-foreground">{t('workboard.checkinPage.skipped')}</span>
                )}
              </>
            )}
          </div>
        ))}

        {/* Manual priorities */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('workboard.checkinPage.manualPriorities')}
            </p>
            <div className="flex items-center gap-1">
              {hasManualContent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResuggestManual}
                  disabled={manualSuggestionsLoading}
                  className="h-7 gap-1.5 text-xs"
                  title={t('workboard.checkinPage.resuggestPriorities')}
                >
                  {manualSuggestionsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {t('workboard.checkinPage.resuggestPriorities')}
                </Button>
              )}
              {!hasManualContent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSuggestManual}
                  disabled={manualSuggestionsLoading}
                  className="h-7 gap-1.5 text-xs"
                >
                  {manualSuggestionsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {t('workboard.checkinPage.suggestManualPriorities')}
                </Button>
              )}
            </div>
          </div>
          {manualPriorities.map((priority, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 ${priority.trim() ? 'animate-fade-in' : ''}`}
              style={priority.trim() ? { animationDelay: `${i * 150}ms`, animationFillMode: 'both' } : undefined}
            >
              <span className="text-lg font-bold text-primary">{i + 1}</span>
              <Textarea
                value={priority}
                onChange={(e) => onManualChange(i, e.target.value)}
                placeholder={i === 0 ? t('workboard.checkinPage.mostImportant') : t('workboard.checkinPage.optionalPriority')}
                className="bg-input border-border text-foreground min-h-[50px]"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
