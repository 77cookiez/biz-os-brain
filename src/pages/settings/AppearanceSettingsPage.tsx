import { ArrowLeft, Moon, Palette, Sun, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type ThemeOption = 'dark' | 'light' | 'system';

export default function AppearanceSettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const themes: { id: ThemeOption; icon: React.ComponentType<{ className?: string }>; titleKey: string }[] = [
    { id: 'dark', icon: Moon, titleKey: 'settings.appearance.dark' },
    { id: 'light', icon: Sun, titleKey: 'settings.appearance.light' },
    { id: 'system', icon: Monitor, titleKey: 'settings.appearance.system' },
  ];

  const handleThemeChange = (newTheme: ThemeOption) => {
    setTheme(newTheme);
    toast.success(t('toast.themeChanged', { theme: t(`settings.appearance.${newTheme}`) }));
  };

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
          <h1 className="text-2xl font-bold text-foreground">{t('settings.appearance.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('settings.appearance.description')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Palette className="h-4 w-4" />
          {t('settings.appearance.theme')}
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {themes.map((themeOption) => (
            <button
              key={themeOption.id}
              onClick={() => handleThemeChange(themeOption.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                theme === themeOption.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              )}
            >
              <div className={cn(
                "h-12 w-12 rounded-lg flex items-center justify-center",
                theme === themeOption.id ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
              )}>
                <themeOption.icon className="h-6 w-6" />
              </div>
              <span className={cn(
                "text-sm font-medium",
                theme === themeOption.id ? "text-primary" : "text-muted-foreground"
              )}>
                {t(themeOption.titleKey)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
