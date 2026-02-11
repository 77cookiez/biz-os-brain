import { ArrowLeft, Globe, Shield, Server, Database, Zap, Languages } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage, AVAILABLE_LANGUAGES } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ContentLanguagePicker } from "@/components/settings/ContentLanguagePicker";

export default function LanguageSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage, contentLocale, setContentLocale } = useLanguage();

  const handleContentLanguageChange = (code: string) => {
    setContentLocale(code);
    toast.success(t('settings.language.contentLanguageSaved', 'Language updated'));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
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

      {/* Step 1 — Your Language (Content Language) */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {t('settings.language.yourLanguage', 'Your Language')}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('settings.language.yourLanguageDesc', 'Select the language you want to work in. All AI content, Brain responses, tasks, goals, and chat translations will appear in this language.')}
        </p>

        <ContentLanguagePicker
          value={contentLocale || currentLanguage.code}
          onChange={handleContentLanguageChange}
          placeholder={t('common.search', 'Search languages...')}
        />
      </div>

      {/* Auto-sync note */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('settings.language.autoSyncNote', 'If you choose a language other than English, Arabic, French, Spanish, or German, all AI content will appear in your language, while buttons and menus will display in the closest supported language.')}
        </p>
      </div>

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
