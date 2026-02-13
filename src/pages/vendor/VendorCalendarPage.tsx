import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { Calendar, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/EmptyState';
import { useBookingAvailability, type WeeklyRules } from '@/hooks/useBookingAvailability';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function VendorCalendarPage() {
  const { t } = useTranslation();
  const { vendorId } = useOutletContext<{ workspaceId: string; vendorId: string; tenantSlug: string }>();

  const { weeklyRules, blackouts, isLoading, upsertRules, addBlackout, removeBlackout } = useBookingAvailability(vendorId);

  const [localRules, setLocalRules] = useState<WeeklyRules | null>(null);
  const rules = localRules ?? weeklyRules;
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [newBlackoutReason, setNewBlackoutReason] = useState('');

  const toggleDay = (day: string, enabled: boolean) => {
    const updated = { ...rules };
    updated[day] = enabled ? [{ start: '09:00', end: '17:00' }] : [];
    setLocalRules(updated);
  };

  const updateSlot = (day: string, field: 'start' | 'end', value: string) => {
    const updated = { ...rules };
    if (updated[day]?.[0]) {
      updated[day] = [{ ...updated[day][0], [field]: value }];
      setLocalRules(updated);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.vendor.calendar')}</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('booking.calendar.weeklyAvailability')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(day => {
            const slots = rules[day] || [];
            const isOpen = slots.length > 0;
            return (
              <div key={day} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-[160px]">
                  <Switch checked={isOpen} onCheckedChange={c => toggleDay(day, c)} />
                  <span className="text-sm font-medium text-foreground">{t(`booking.calendar.${day}`)}</span>
                </div>
                {isOpen ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" className="w-28" value={slots[0]?.start || '09:00'} onChange={e => updateSlot(day, 'start', e.target.value)} />
                    <span className="text-muted-foreground">—</span>
                    <Input type="time" className="w-28" value={slots[0]?.end || '17:00'} onChange={e => updateSlot(day, 'end', e.target.value)} />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('booking.calendar.closed')}</span>
                )}
              </div>
            );
          })}
          {localRules && (
            <Button onClick={() => { upsertRules.mutate(localRules, { onSuccess: () => setLocalRules(null) }); }} disabled={upsertRules.isPending}>
              {t('common.save')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('booking.calendar.blackoutDates')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input type="date" value={newBlackoutDate} onChange={e => setNewBlackoutDate(e.target.value)} className="w-auto" />
            <Input placeholder={t('booking.calendar.reason')} value={newBlackoutReason} onChange={e => setNewBlackoutReason(e.target.value)} />
            <Button size="sm" onClick={() => {
              if (newBlackoutDate) {
                addBlackout.mutate({ date: newBlackoutDate, reason: newBlackoutReason || undefined }, {
                  onSuccess: () => { setNewBlackoutDate(''); setNewBlackoutReason(''); },
                });
              }
            }} disabled={!newBlackoutDate || addBlackout.isPending}>
              <Plus className="h-4 w-4 me-1" />{t('booking.calendar.addBlackout')}
            </Button>
          </div>
          {blackouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('booking.calendar.noBlackouts')}</p>
          ) : (
            <div className="space-y-2">
              {blackouts.map(bo => (
                <div key={bo.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-foreground">{bo.blackout_date}</span>
                    {bo.reason && <span className="text-sm text-muted-foreground ms-2">— {bo.reason}</span>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeBlackout.mutate(bo.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
