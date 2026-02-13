import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

interface BookingStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  requested: 'outline',
  quoted: 'secondary',
  accepted: 'default',
  paid_confirmed: 'default',
  completed: 'default',
  cancelled: 'destructive',
  pending: 'outline',
  approved: 'default',
  suspended: 'destructive',
  active: 'default',
  expired: 'destructive',
  grace: 'secondary',
};

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const { t } = useTranslation();

  // Try booking-specific status keys first, then vendor status keys
  const label =
    t(`booking.status.${status}`, { defaultValue: '' }) ||
    t(`booking.vendors.${status}`, { defaultValue: '' }) ||
    t(`booking.subscription.${status}`, { defaultValue: '' }) ||
    status;

  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'outline'} className={className}>
      {label}
    </Badge>
  );
}
