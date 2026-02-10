import { ArrowLeft, Bell, Mail, Smartphone, Clock, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useDigestPreferences } from "@/hooks/useDigestPreferences";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationsSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { prefs, loading, updatePrefs } = useDigestPreferences();
  const { markAllAsRead, unreadCount } = useNotifications();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('settings.notifications.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('settings.notifications.description')}</p>
        </div>
      </div>

      {/* Unread notifications summary */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('notifications.unreadCount', { count: unreadCount, defaultValue: '{{count}} unread notifications' })}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            {t('notifications.markAllRead', 'Mark all read')}
          </Button>
        </div>
      )}

      {/* Weekly Digest Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            {t('digest.settingsTitle', 'Weekly Digest')}
          </h3>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">ULL</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('digest.settingsDesc', 'Receive a calm, weekly summary of your workspace activity. Once per week, no spam.')}
        </p>

        {/* Enable/disable digest */}
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
              disabled={loading}
              checked={prefs.enabled}
              onCheckedChange={(enabled) => updatePrefs({ enabled })}
            />
          </div>

          {prefs.enabled && (
            <>
              {/* Delivery Channels */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('settings.notifications.channels', 'Delivery Channels')}
                </h4>

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
                    checked={prefs.in_app}
                    onCheckedChange={(in_app) => updatePrefs({ in_app })}
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
                    checked={prefs.email}
                    onCheckedChange={(email) => updatePrefs({ email })}
                  />
                </div>
              </div>

              {/* Schedule */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('digest.schedule', 'Delivery Schedule')}
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t('digest.scheduleDay', 'Day')}</p>
                    <Select
                      value={String(prefs.schedule_day)}
                      onValueChange={(v) => updatePrefs({ schedule_day: Number(v) })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t('digest.monday', 'Monday')}</SelectItem>
                        <SelectItem value="2">{t('digest.tuesday', 'Tuesday')}</SelectItem>
                        <SelectItem value="3">{t('digest.wednesday', 'Wednesday')}</SelectItem>
                        <SelectItem value="4">{t('digest.thursday', 'Thursday')}</SelectItem>
                        <SelectItem value="5">{t('digest.friday', 'Friday')}</SelectItem>
                        <SelectItem value="6">{t('digest.saturday', 'Saturday')}</SelectItem>
                        <SelectItem value="0">{t('digest.sunday', 'Sunday')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t('digest.scheduleTime', 'Time')}</p>
                    <Select
                      value={String(prefs.schedule_hour)}
                      onValueChange={(v) => updatePrefs({ schedule_hour: Number(v) })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t('digest.scheduleNote', 'Maximum one digest per week. Uses workspace timezone.')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
