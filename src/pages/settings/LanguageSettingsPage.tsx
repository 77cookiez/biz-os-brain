import { ArrowLeft, Check, Globe, Shield, Server, Database, Zap, Languages, Mail, Bell, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useLanguage, AVAILABLE_LANGUAGES, Language } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ContentLanguagePicker } from "@/components/settings/ContentLanguagePicker";
import { useDigestPreferences } from "@/hooks/useDigestPreferences";

export default function LanguageSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage, enabledLanguages, setCurrentLanguage, toggleLanguage, contentLocale, setContentLocale } = useLanguage();
  const { user } = useAuth();
  const { prefs: digestPrefs, updatePrefs: updateDigestPrefs } = useDigestPreferences();

  const isEnabled = (lang: Language) => 
    enabledLanguages.some(l => l.code === lang.code);

  const isCurrent = (lang: Language) => 
    currentLanguage.code === lang.code;

  const handleSetActive = async (lang: Language) => {
    setCurrentLanguage(lang);
    // Persist to profiles.preferred_locale
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_locale: lang.code })
        .eq('user_id', user.id);
      if (error) {
        console.error('[ULL] Failed to persist locale:', error.message);
      }
    }
  };

  const handleToggle = (lang: Language) => {
    toggleLanguage(lang);
    // If toggling on and it's the only one, also set as active
    if (!isEnabled(lang)) {
      // Will be enabled
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{t('settings.language.title')}</h1>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              <Shield className="h-3 w-3 mr-1" />
              ULL
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{t('settings.language.description')}</p>
        </div>
      </div>

      {/* Enabled Languages */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t('settings.language.languages')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {enabledLanguages.length === 1 
              ? t('settings.language.singleMode')
              : t('settings.language.multiMode', { count: enabledLanguages.length })}
          </p>
        </div>
        
        <div className="space-y-2">
          {AVAILABLE_LANGUAGES.map((lang) => (
            <div
              key={lang.code}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer",
                isEnabled(lang)
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-secondary/50"
              )}
              onClick={() => handleToggle(lang)}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold",
                  isEnabled(lang) ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                )}>
                  {lang.code.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{lang.name}</p>
                  <p className="text-xs text-muted-foreground">{lang.nativeName} • {lang.dir.toUpperCase()}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isCurrent(lang) && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
                {isEnabled(lang) && (
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          {t('settings.language.enableHint')}
        </p>
      </div>

      {/* Active Language Selection */}
      {enabledLanguages.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-medium text-foreground">{t('settings.language.setActive')}</h3>
          <div className="flex flex-wrap gap-2">
            {enabledLanguages.map((lang) => (
              <Button
                key={lang.code}
                variant={isCurrent(lang) ? "default" : "outline"}
                size="sm"
                onClick={() => handleSetActive(lang)}
              >
                {lang.nativeName}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ULL Status Panel */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {t('settings.language.ullStatus', 'ULL Status')}
          </h3>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">System</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {t('settings.language.currentLocaleLabel', 'Current Locale')}
            </p>
            <p className="text-sm font-medium text-foreground">{currentLanguage.nativeName} ({currentLanguage.code.toUpperCase()})</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Server className="h-3 w-3" />
              {t('settings.language.translationProvider', 'Translation Provider')}
            </p>
            <p className="text-sm font-medium text-foreground">Lovable AI Gateway</p>
            <p className="text-[10px] text-muted-foreground">gemini-2.5-flash-lite</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              {t('settings.language.cacheStatus', 'Translation Cache')}
            </p>
            <p className="text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {t('settings.language.cacheEnabled', 'Enabled')}
              </span>
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('settings.language.fallbackBehavior', 'Fallback Behavior')}</p>
            <p className="text-sm font-medium text-foreground">{t('settings.language.fallbackDesc', 'Show original text')}</p>
          </div>
        </div>
      </div>

      {/* Content Language (ULL Projection) */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {t('settings.language.contentLanguageTitle', 'Content Language (ULL Projection)')}
          </h3>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">ULL</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('settings.language.contentLanguageDesc', 'This controls the language for AI-generated content, Brain responses, and ULL-translated text. This is separate from the UI language (which only supports English, Arabic, and French).')}
        </p>

        <ContentLanguagePicker
          value={contentLocale || currentLanguage.code}
          onChange={(code) => {
            setContentLocale(code);
            toast.success(t('settings.language.contentLanguageSaved', 'Content language updated'));
          }}
          placeholder={t('common.search', 'Search languages...')}
        />

        <p className="text-[11px] text-muted-foreground border-t border-border pt-3 mt-3">
          {t('settings.language.contentLanguageFallback', 'Fallback chain: Content Language → UI Language → Workspace Default → English')}
        </p>
      </div>

      {/* Weekly Digest Settings */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {t('digest.settingsTitle', 'Weekly Digest')}
          </h3>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">ULL</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('digest.settingsDesc', 'Receive a calm, weekly summary of your workspace activity. Once per week, no spam.')}
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t('digest.enabled', 'Weekly Digest')}</p>
                <p className="text-xs text-muted-foreground">{t('digest.enabledDesc', 'Enable or disable the weekly digest')}</p>
              </div>
            </div>
            <Switch
              checked={digestPrefs.enabled}
              onCheckedChange={(enabled) => updateDigestPrefs({ enabled })}
            />
          </div>

          {digestPrefs.enabled && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('digest.inApp', 'In-app')}</p>
                    <p className="text-xs text-muted-foreground">{t('digest.inAppDesc', 'Show digest card when you open the app')}</p>
                  </div>
                </div>
                <Switch
                  checked={digestPrefs.in_app}
                  onCheckedChange={(in_app) => updateDigestPrefs({ in_app })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('digest.email', 'Email')}</p>
                    <p className="text-xs text-muted-foreground">{t('digest.emailDesc', 'Receive a weekly email summary')}</p>
                  </div>
                </div>
                <Switch
                  checked={digestPrefs.email}
                  onCheckedChange={(email) => updateDigestPrefs({ email })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Developer docs link */}
      <button
        onClick={() => navigate('/docs/system/ull')}
        className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-secondary hover:border-primary/20 transition-all"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{t('settings.language.devContract', 'Developer Contract')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.language.devContractDesc', 'Meaning-first rules, data model, and integration guide')}</p>
        </div>
      </button>
    </div>
  );
}
