import { LucideIcon, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">{description}</p>
        )}
        {actionLabel && onAction && (
          <Button size="sm" onClick={onAction}>{actionLabel}</Button>
        )}
      </CardContent>
    </Card>
  );
}
