import { ArrowLeft, Brain, Eye, Shield, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useOILSettings } from '@/hooks/useOILSettings';

export default function IntelligenceSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { settings, isLoading, updateSettings } = useOILSettings();

  const update = (key: string, value: unknown) => {
    updateSettings.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('settings.intelligence.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('settings.intelligence.description')}
          </p>
        </div>
      </div>

      {/* 9.1 Visibility & Timing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t('settings.intelligence.visibility.title')}</CardTitle>
          </div>
          <CardDescription>{t('settings.intelligence.visibility.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('settings.intelligence.visibility.level')}
            </label>
            <Select
              value={settings.insights_visibility}
              onValueChange={(v) => update('insights_visibility', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">
                  {t('settings.intelligence.visibility.minimal')}
                </SelectItem>
                <SelectItem value="balanced">
                  {t('settings.intelligence.visibility.balanced')}
                </SelectItem>
                <SelectItem value="proactive">
                  {t('settings.intelligence.visibility.proactive')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.visibility.brainOnly')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.intelligence.visibility.brainOnlyDesc')}
              </p>
            </div>
            <Switch
              checked={settings.show_in_brain_only}
              onCheckedChange={(v) => update('show_in_brain_only', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.visibility.indicatorStrip')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.intelligence.visibility.indicatorStripDesc')}
              </p>
            </div>
            <Switch
              checked={settings.show_indicator_strip}
              onCheckedChange={(v) => update('show_indicator_strip', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 9.2 Guidance Style */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t('settings.intelligence.guidance.title')}</CardTitle>
          </div>
          <CardDescription>{t('settings.intelligence.guidance.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.guidance_style}
            onValueChange={(v) => update('guidance_style', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">
                {t('settings.intelligence.guidance.conservative')}
              </SelectItem>
              <SelectItem value="advisory">
                {t('settings.intelligence.guidance.advisory')}
              </SelectItem>
              <SelectItem value="challenging">
                {t('settings.intelligence.guidance.challenging')}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 9.3 Leadership Support Level */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t('settings.intelligence.leadership.title')}</CardTitle>
          </div>
          <CardDescription>{t('settings.intelligence.leadership.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.leadership.enabled')}
              </p>
            </div>
            <Switch
              checked={settings.leadership_guidance_enabled}
              onCheckedChange={(v) => update('leadership_guidance_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.leadership.bestPractice')}
              </p>
            </div>
            <Switch
              checked={settings.show_best_practice_comparisons}
              onCheckedChange={(v) => update('show_best_practice_comparisons', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.leadership.explainWhy')}
              </p>
            </div>
            <Switch
              checked={settings.always_explain_why}
              onCheckedChange={(v) => update('always_explain_why', v)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.leadership.blindSpots')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.intelligence.leadership.blindSpotsDesc')}
              </p>
            </div>
            <Switch
              checked={settings.auto_surface_blind_spots}
              onCheckedChange={(v) => update('auto_surface_blind_spots', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 9.4 Knowledge & Trends Awareness */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t('settings.intelligence.knowledge.title')}</CardTitle>
          </div>
          <CardDescription>{t('settings.intelligence.knowledge.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('settings.intelligence.knowledge.level')}
            </label>
            <Select
              value={settings.external_knowledge}
              onValueChange={(v) => update('external_knowledge', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">
                  {t('settings.intelligence.knowledge.off')}
                </SelectItem>
                <SelectItem value="conditional">
                  {t('settings.intelligence.knowledge.conditional')}
                </SelectItem>
                <SelectItem value="on_demand">
                  {t('settings.intelligence.knowledge.onDemand')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.knowledge.benchmarks')}
              </p>
            </div>
            <Switch
              checked={settings.include_industry_benchmarks}
              onCheckedChange={(v) => update('include_industry_benchmarks', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.knowledge.bestPractices')}
              </p>
            </div>
            <Switch
              checked={settings.include_operational_best_practices}
              onCheckedChange={(v) => update('include_operational_best_practices', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.intelligence.knowledge.excludeNews')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.intelligence.knowledge.excludeNewsDesc')}
              </p>
            </div>
            <Switch
              checked={settings.exclude_market_news}
              onCheckedChange={(v) => update('exclude_market_news', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
