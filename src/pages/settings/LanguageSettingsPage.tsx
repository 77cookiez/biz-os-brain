import { ArrowLeft, Check, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage, AVAILABLE_LANGUAGES, Language } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function LanguageSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage, enabledLanguages, setCurrentLanguage, toggleLanguage } = useLanguage();

  const isEnabled = (lang: Language) => 
    enabledLanguages.some(l => l.code === lang.code);

  const isCurrent = (lang: Language) => 
    currentLanguage.code === lang.code;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.language.title')}</h1>
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
              onClick={() => toggleLanguage(lang)}
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
                onClick={() => setCurrentLanguage(lang)}
              >
                {lang.nativeName}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
