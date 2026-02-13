import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { ULLText } from '@/components/ull/ULLText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOIL } from '@/hooks/useOIL';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function VendorQuotesPage() {
  const { t } = useTranslation();
  const { vendorId } = useOutletContext<{ workspaceId: string; vendorId: string; tenantSlug: string }>();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const { emitEvent } = useOIL();
  const queryClient = useQueryClient();
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [quoteForm, setQuoteForm] = useState({ amount: '', deposit: '', notes: '', expiry: '48' });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['vendor-all-requests', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_quote_requests')
        .select('*, service:booking_services(title, title_meaning_object_id)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((qr: any) => ({
        ...qr,
        service_title_fallback: qr.service?.title || '—',
        service_title_meaning_id: qr.service?.title_meaning_object_id || null,
      }));
    },
    enabled: !!vendorId,
  });

  const sendQuote = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error('Missing context');
      const workspaceId = selectedRequest.workspace_id;

      const meaningId = await createMeaningObject({
        workspaceId,
        createdBy: user.id,
        type: 'MESSAGE',
        sourceLang: currentLanguage.code,
        meaningJson: buildMeaningFromText({
          type: 'MESSAGE',
          title: quoteForm.notes || `Quote: ${quoteForm.amount}`,
          createdFrom: 'user',
        }),
      });
      if (!meaningId) throw new Error('Meaning creation failed');

      const expiryHours = Number(quoteForm.expiry) || 48;
      const payload = {
        workspace_id: workspaceId,
        quote_request_id: selectedRequest.id,
        vendor_id: vendorId,
        amount: Number(quoteForm.amount),
        currency: 'USD',
        deposit_amount: quoteForm.deposit ? Number(quoteForm.deposit) : null,
        notes: quoteForm.notes || null,
        meaning_object_id: meaningId,
        source_lang: currentLanguage.code,
        expiry_hours: expiryHours,
        expires_at: new Date(Date.now() + expiryHours * 3600000).toISOString(),
      };
      guardMeaningInsert('booking_quotes', payload);
      const { error } = await supabase.from('booking_quotes').insert(payload as any);
      if (error) throw error;

      await supabase
        .from('booking_quote_requests')
        .update({ status: 'quoted' as any })
        .eq('id', selectedRequest.id);

      emitEvent({
        event_type: 'booking.quote_sent',
        object_type: 'booking_quote',
        meaning_object_id: meaningId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-all-requests'] });
      toast.success(t('booking.quotes.quoteSent'));
      setQuoteDialogOpen(false);
      setQuoteForm({ amount: '', deposit: '', notes: '', expiry: '48' });
    },
    onError: () => toast.error(t('booking.quotes.quoteFailed')),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.vendor.quotes')}</h1>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : requests.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('booking.quotes.emptyTitle')} description={t('booking.quotes.emptyDesc')} />
      ) : (
        <div className="space-y-4">
          {requests.map(qr => (
            <Card key={qr.id}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    <ULLText meaningId={qr.service_title_meaning_id} fallback={qr.service_title_fallback} />
                  </p>
                  <BookingStatusBadge status={qr.status} />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {qr.event_date && <span>{format(new Date(qr.event_date), 'PP')}</span>}
                  {qr.guest_count && <span>{qr.guest_count} {t('booking.quotes.guestCount').toLowerCase()}</span>}
                </div>
                {qr.notes && (
                  <p className="text-sm text-muted-foreground">
                    <ULLText meaningId={qr.meaning_object_id} fallback={qr.notes} />
                  </p>
                )}
                {qr.status === 'requested' && (
                  <Button size="sm" onClick={() => { setSelectedRequest(qr); setQuoteDialogOpen(true); }}>
                    <Send className="h-4 w-4 me-1" />
                    {t('booking.quotes.sendQuote')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('booking.quotes.sendQuote')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('booking.quotes.quoteAmount')}</Label>
              <Input type="number" value={quoteForm.amount} onChange={e => setQuoteForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>{t('booking.quotes.depositAmount')}</Label>
              <Input type="number" value={quoteForm.deposit} onChange={e => setQuoteForm(p => ({ ...p, deposit: e.target.value }))} />
            </div>
            <div>
              <Label>{t('booking.quotes.expiryPreset')}</Label>
              <Select value={quoteForm.expiry} onValueChange={v => setQuoteForm(p => ({ ...p, expiry: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 {t('booking.quotes.hours')}</SelectItem>
                  <SelectItem value="48">48 {t('booking.quotes.hours')}</SelectItem>
                  <SelectItem value="72">72 {t('booking.quotes.hours')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('booking.quotes.notes')}</Label>
              <Textarea value={quoteForm.notes} onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => sendQuote.mutate()} disabled={!quoteForm.amount || sendQuote.isPending}>
              {t('booking.quotes.sendQuote')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
