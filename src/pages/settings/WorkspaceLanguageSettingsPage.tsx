import { useState, useEffect } from 'react';
import { ArrowLeft, Globe, Shield, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AVAILABLE_LANGUAGES } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function WorkspaceLanguageSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentWorkspace, updateWorkspace } = useWorkspace();
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      setDefaultLocale(currentWorkspace.default_locale || 'en');
    }
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, { default_locale: defaultLocale });
      toast.success(t('settings.language.workspaceSaved', 'Workspace language updated'));
    } catch {
      toast.error(t('common.error', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = currentWorkspace?.default_locale !== defaultLocale;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {t('settings.language.workspaceTitle', 'Workspace Language')}
            </h1>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {t('settings.language.workspaceDescription', 'Set the default language for this workspace')}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {t('settings.language.defaultLocale', 'Default Language')}
          </h3>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('settings.language.defaultLocaleHint', 'Used as fallback when a user has no personal language preference set. Also determines the default language for new content created in this workspace.')}
        </p>

        <Select value={defaultLocale} onValueChange={setDefaultLocale}>
          <SelectTrigger className="bg-input border-border text-foreground w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {AVAILABLE_LANGUAGES.map(lang => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{lang.nativeName}</span>
                  <span className="text-muted-foreground text-xs">({lang.name})</span>
                  <span className="text-muted-foreground text-[10px] uppercase">{lang.dir}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleSave} disabled={!hasChanged || saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </Button>
      </div>

      {/* Workspace info */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h3 className="text-sm font-medium text-foreground">
          {t('settings.language.currentWorkspace', 'Current Workspace')}
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">{t('common.name', 'Name')}</p>
            <p className="text-foreground font-medium">{currentWorkspace?.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t('settings.language.currentLocale', 'Current Locale')}</p>
            <p className="text-foreground font-medium">{currentWorkspace?.default_locale?.toUpperCase()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
