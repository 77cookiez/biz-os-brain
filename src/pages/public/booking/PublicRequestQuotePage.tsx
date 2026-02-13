import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext, useSearchParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ULLText } from '@/components/ull/ULLText';
import { useAuth } from '@/contexts/AuthContext';
import { useBookingQuotes } from '@/hooks/useBookingQuotes';
import { useBookingChat } from '@/hooks/useBookingChat';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function PublicRequestQuotePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { settings, tenantSlug } = useOutletContext<{ settings: any; tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const workspaceId = settings?.workspace_id;

  const preVendor = searchParams.get('vendor') || '';
  const preService = searchParams.get('service') || '';

  const { createQuoteRequest } = useBookingQuotes();
  const { createQuoteThread } = useBookingChat();

  const [form, setForm] = useState({
    vendor_id: preVendor,
    service_id: preService,
    event_date: '',
    event_time: '',
    guest_count: '',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  // Fetch vendors + services for selectors
  const { data: vendors = [] } = useQuery({
    queryKey: ['public-vendors-select', workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('booking_vendors')
        .select('id, booking_vendor_profiles(display_name, display_name_meaning_object_id)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'approved');
      return (data || []).map((v: any) => ({
        id: v.id,
        display_name: v.booking_vendor_profiles?.[0]?.display_name || v.id,
        meaning_id: v.booking_vendor_profiles?.[0]?.display_name_meaning_object_id || null,
      }));
    },
    enabled: !!workspaceId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['public-services-select', workspaceId, form.vendor_id],
    queryFn: async () => {
      let q = supabase
        .from('booking_services')
        .select('id, title, title_meaning_object_id')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);
      if (form.vendor_id) q = q.eq('vendor_id', form.vendor_id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  if (!user) {
    return <Navigate to={`/auth?redirect=/b/${tenantSlug}/request`} replace />;
  }

  const handleSubmit = async () => {
    if (!form.vendor_id || !form.service_id) return;
    try {
      const result = await createQuoteRequest.mutateAsync({
        vendor_id: form.vendor_id,
        service_id: form.service_id,
        event_date: form.event_date || undefined,
        event_time: form.event_time || undefined,
        guest_count: form.guest_count ? Number(form.guest_count) : undefined,
        notes: form.notes || undefined,
      });

      // Auto-create chat thread
      const selectedService = services.find((s: any) => s.id === form.service_id);
      await createQuoteThread({
        quoteRequestId: result.id,
        customerUserId: user.id,
        vendorId: form.vendor_id,
        serviceTitle: selectedService?.title || 'Quote',
      });

      setSubmitted(true);
    } catch {
      toast.error(t('booking.quotes.requestFailed'));
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Send className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{t('booking.public.requestSent')}</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">{t('booking.public.requestSentDesc')}</p>
        <Link to={`/b/${tenantSlug}/my`}>
          <Button variant="outline">{t('booking.public.viewMyBookings')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link to={`/b/${tenantSlug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('booking.public.requestQuote')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('booking.quotes.selectVendor')}</Label>
            <Select value={form.vendor_id} onValueChange={v => setForm(p => ({ ...p, vendor_id: v, service_id: '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {vendors.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    <ULLText meaningId={v.meaning_id} fallback={v.display_name} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('booking.quotes.selectService')}</Label>
            <Select value={form.service_id} onValueChange={v => setForm(p => ({ ...p, service_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {services.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    <ULLText meaningId={s.title_meaning_object_id} fallback={s.title} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('booking.quotes.eventDate')}</Label>
              <Input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
            </div>
            <div>
              <Label>{t('booking.quotes.eventTime')}</Label>
              <Input type="time" value={form.event_time} onChange={e => setForm(p => ({ ...p, event_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>{t('booking.quotes.guestCount')}</Label>
            <Input type="number" value={form.guest_count} onChange={e => setForm(p => ({ ...p, guest_count: e.target.value }))} />
          </div>
          <div>
            <Label>{t('booking.quotes.notes')}</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!form.vendor_id || !form.service_id || createQuoteRequest.isPending}
          >
            {t('booking.public.submitRequest')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
