import { ArrowLeft, Bell, Mail, MessageSquare, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface NotificationSetting {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  descKey: string;
  enabled: boolean;
}

export default function NotificationsSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSetting[]>([
    { id: 'email', icon: Mail, titleKey: 'settings.notifications.email', descKey: 'settings.notifications.emailDesc', enabled: true },
    { id: 'push', icon: Smartphone, titleKey: 'settings.notifications.push', descKey: 'settings.notifications.pushDesc', enabled: false },
    { id: 'in-app', icon: MessageSquare, titleKey: 'settings.notifications.inApp', descKey: 'settings.notifications.inAppDesc', enabled: true },
  ]);

  const toggleSetting = (id: string) => {
    setSettings(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
    toast.success(t('toast.notificationUpdated'));
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
          <h1 className="text-2xl font-bold text-foreground">{t('settings.notifications.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('settings.notifications.description')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Bell className="h-4 w-4" />
          {t('settings.notifications.channels')}
        </h3>
        
        <div className="space-y-4">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <setting.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(setting.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(setting.descKey)}</p>
                </div>
              </div>
              <Switch
                checked={setting.enabled}
                onCheckedChange={() => toggleSetting(setting.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
