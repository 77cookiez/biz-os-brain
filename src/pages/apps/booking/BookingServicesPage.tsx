import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { SubscriptionBanner } from '@/components/booking/SubscriptionBanner';
import { ULLText } from '@/components/ull/ULLText';
import { useBookingServices } from '@/hooks/useBookingServices';
import { useBookingVendors } from '@/hooks/useBookingVendors';
import { useBookingSubscription } from '@/hooks/useBookingSubscription';

export default function BookingServicesPage() {
  const { t } = useTranslation();
  const { services, isLoading, createService, toggleActive } = useBookingServices();
  const { vendors } = useBookingVendors();
  const { canWrite } = useBookingSubscription();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vendor_id: '',
    title: '',
    description: '',
    price_type: 'fixed',
    price_amount: '',
    currency: 'AED',
    min_guests: '',
    max_guests: '',
    duration_minutes: '',
  });

  const approvedVendors = vendors.filter(v => v.status === 'approved');

  const handleCreate = () => {
    createService.mutate(
      {
        vendor_id: form.vendor_id,
        title: form.title,
        description: form.description || undefined,
        price_type: form.price_type,
        price_amount: form.price_amount ? Number(form.price_amount) : undefined,
        currency: form.currency,
        min_guests: form.min_guests ? Number(form.min_guests) : undefined,
        max_guests: form.max_guests ? Number(form.max_guests) : undefined,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ vendor_id: '', title: '', description: '', price_type: 'fixed', price_amount: '', currency: 'AED', min_guests: '', max_guests: '', duration_minutes: '' });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <SubscriptionBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('booking.services.title')}</h1>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 me-1" />{t('booking.services.addService')}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('booking.services.addService')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('booking.quotes.selectVendor')}</Label>
                  <Select value={form.vendor_id} onValueChange={v => setForm(p => ({ ...p, vendor_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {approvedVendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.profile?.display_name || v.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('booking.services.serviceTitle')}</Label>
                  <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <Label>{t('booking.services.serviceDescription')}</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('booking.services.priceType')}</Label>
                    <Select value={form.price_type} onValueChange={v => setForm(p => ({ ...p, price_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">{t('booking.services.priceFixed')}</SelectItem>
                        <SelectItem value="hourly">{t('booking.services.priceHourly')}</SelectItem>
                        <SelectItem value="custom_quote">{t('booking.services.priceCustom')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.price_type !== 'custom_quote' && (
                    <div>
                      <Label>{t('booking.services.priceAmount')}</Label>
                      <Input type="number" value={form.price_amount} onChange={e => setForm(p => ({ ...p, price_amount: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('booking.services.minGuests')}</Label>
                    <Input type="number" value={form.min_guests} onChange={e => setForm(p => ({ ...p, min_guests: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t('booking.services.maxGuests')}</Label>
                    <Input type="number" value={form.max_guests} onChange={e => setForm(p => ({ ...p, max_guests: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>{t('booking.services.durationMinutes')}</Label>
                  <Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!form.vendor_id || !form.title || createService.isPending}
                >
                  {t('booking.services.createService')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : services.length === 0 ? (
        <EmptyState icon={Package} title={t('booking.services.emptyTitle')} description={t('booking.services.emptyDesc')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(service => (
            <Card key={service.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">
                    <ULLText meaningId={service.meaning_object_id} fallback={service.title} />
                  </CardTitle>
                  <Badge variant={service.is_active ? 'default' : 'secondary'}>
                    {service.is_active ? t('booking.services.active') : t('booking.services.inactive')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {service.description && (
                  <p className="text-sm text-muted-foreground">
                    <ULLText meaningId={service.meaning_object_id} fallback={service.description} />
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('booking.services.vendor')}</span>
                  <span className="text-foreground">{service.vendor_name}</span>
                </div>
                {service.price_type !== 'custom_quote' && service.price_amount && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('booking.services.price')}</span>
                    <span className="text-foreground font-medium">{service.currency} {service.price_amount}</span>
                  </div>
                )}
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => toggleActive.mutate({ id: service.id, is_active: !service.is_active })}
                  >
                    {service.is_active ? <ToggleRight className="h-4 w-4 me-1" /> : <ToggleLeft className="h-4 w-4 me-1" />}
                    {service.is_active ? t('booking.services.inactive') : t('booking.services.active')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
