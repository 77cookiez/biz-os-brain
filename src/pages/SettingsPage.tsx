import { User, Building, FolderOpen, Globe, Users, Bell, Palette, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const settingSections = [
    { icon: User, titleKey: "account.title", descKey: "account.description", path: "/settings/account" },
    { icon: Building, titleKey: "settings.company.title", descKey: "settings.company.description", path: "/settings/company" },
    { icon: FolderOpen, titleKey: "workspaces.title", descKey: "workspaces.description", path: "/settings/workspaces" },
    { icon: Users, titleKey: "settings.team.title", descKey: "settings.team.description", path: "/settings/team" },
    { icon: Globe, titleKey: "settings.language.title", descKey: "settings.language.description", path: "/settings/language" },
    { icon: Bell, titleKey: "settings.notifications.title", descKey: "settings.notifications.description", path: "/settings/notifications" },
    { icon: Palette, titleKey: "settings.appearance.title", descKey: "settings.appearance.description", path: "/settings/appearance" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="space-y-2">
        {settingSections.map((s) => (
          <button
            key={s.titleKey}
            onClick={() => navigate(s.path)}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-secondary hover:border-primary/20"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t(s.titleKey)}</p>
              <p className="text-xs text-muted-foreground">{t(s.descKey)}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
