import { Bell, Check, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { relativeTime } from '@/lib/relativeTime';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { t } = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (notification: typeof notifications[0]) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    // Deep link based on type
    const data = notification.data_json as Record<string, string>;
    if (data?.link) {
      navigate(data.link);
    } else if (notification.type === 'weekly_digest') {
      navigate('/insights');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-popover border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            {t('notifications.title', 'Notifications')}
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              {t('notifications.markAllRead', 'Mark all read')}
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('notifications.empty', 'No notifications yet')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors',
                    !n.read_at && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-1 h-2 w-2 rounded-full shrink-0',
                      n.read_at ? 'bg-transparent' : 'bg-primary'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => navigate('/settings/notifications')}
            >
              {t('notifications.settings', 'Notification Settings')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
