/**
 * V2 Vendor Quotes Inbox
 * Shows all quote requests with send-quote flow.
 * Uses auditAndEmit for all writes. DEV debug helper included.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { ULLText } from '@/components/ull/ULLText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import { auditAndEmit } from '@/lib/booking/auditHelper';
import { MessageSquare, Send, Calendar, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function VendorQuotesPageV2() {
  const { t } = useTranslation();
  const { workspaceId, vendorId, tenantSlug } = useOutletContext<{
    workspaceId: string;
    vendorId: string;
    tenantSlug: string;
  }>();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [quoteForm, setQuoteForm] = useState({ amount: '', deposit: '', notes: '', expiry: '48' });

  // Fetch quote requests for this vendor
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['vendor-quotes-v2', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_quote_requests')
        .select('*, service:booking_services(title, title_meaning_object_id, currency)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((qr: any) => ({
        ...qr,
        service_title_fallback: qr.service?.title || '—',
        service_title_meaning_id: qr.service?.title_meaning_object_id || null,
        service_currency: qr.service?.currency || 'AED',
      }));
    },
    enabled: !!vendorId,
  });

  // Fetch sent quotes
  const { data: sentQuotes = [] } = useQuery({
    queryKey: ['vendor-sent-quotes-v2', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_quotes')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

  // Map quotes by request ID
  const quotesByRequest: Record<string, any> = {};
  sentQuotes.forEach((q: any) => {
    quotesByRequest[q.quote_request_id] = q;
  });

  // Send quote mutation
  const sendQuote = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !user) throw new Error('Missing context');

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
      const currency = selectedRequest.service_currency || 'AED';
      const payload = {
        workspace_id: workspaceId,
        quote_request_id: selectedRequest.id,
        vendor_id: vendorId,
        amount: Number(quoteForm.amount),
        currency,
        deposit_amount: quoteForm.deposit ? Number(quoteForm.deposit) : null,
        notes: quoteForm.notes || null,
        meaning_object_id: meaningId,
        source_lang: currentLanguage.code,
        expiry_hours: expiryHours,
        expires_at: new Date(Date.now() + expiryHours * 3600000).toISOString(),
      };
      guardMeaningInsert('booking_quotes', payload);

      const { data, error } = await supabase
        .from('booking_quotes')
        .insert(payload as any)
        .select('id')
        .single();
      if (error) throw error;

      // Update request status to quoted
      await supabase
        .from('booking_quote_requests')
        .update({ status: 'quoted' as any })
        .eq('id', selectedRequest.id);

      // Audit + OIL
      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.quote_sent',
        event_type: 'booking.quote_sent',
        entity_type: 'booking_quote',
        entity_id: data.id,
        meaning_object_id: meaningId,
      });

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-quotes-v2'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-sent-quotes-v2'] });
      toast.success(t('booking.quotes.quoteSent'));
      setQuoteDialogOpen(false);
      setQuoteForm({ amount: '', deposit: '', notes: '', expiry: '48' });
      setSelectedRequest(null);
    },
    onError: () => toast.error(t('booking.quotes.quoteFailed')),
  });

  const statusGroups = {
    pending: requests.filter((r: any) => r.status === 'requested'),
    quoted: requests.filter((r: any) => r.status === 'quoted'),
    accepted: requests.filter((r: any) => r.status === 'accepted'),
    other: requests.filter((r: any) => !['requested', 'quoted', 'accepted'].includes(r.status)),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('booking.vendor.quotes')}</h1>
        <Badge variant="outline" className="text-xs">
          {statusGroups.pending.length} {t('booking.quotes.pending')}
        </Badge>
      </div>

      {/* DEV-only debug helper */}
      {import.meta.env.DEV && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              console.log('[DEV] VendorQuotesV2 context:', { workspaceId, vendorId, tenantSlug });
              console.log('[DEV] Requests:', requests.length, 'Sent quotes:', sentQuotes.length);
              console.log('[DEV] First request:', requests[0] || 'none');
            }}
          >
            🐛 Log Quote Context
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            ws:{workspaceId?.slice(0, 8)} v:{vendorId?.slice(0, 8)}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t('booking.quotes.emptyTitle')}
          description={t('booking.quotes.emptyDesc')}
        />
      ) : (
        <div className="space-y-6">
          {/* Pending section */}
          {statusGroups.pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t('booking.quotes.newRequests')} ({statusGroups.pending.length})
              </h2>
              <div className="space-y-3">
                {statusGroups.pending.map((qr: any) => (
                  <RequestCard
                    key={qr.id}
                    request={qr}
                    onSendQuote={() => {
                      setSelectedRequest(qr);
                      setQuoteDialogOpen(true);
                    }}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Quoted section */}
          {statusGroups.quoted.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t('booking.quotes.quoted')} ({statusGroups.quoted.length})
              </h2>
              <div className="space-y-3">
                {statusGroups.quoted.map((qr: any) => {
                  const quote = quotesByRequest[qr.id];
                  return (
                    <RequestCard
                      key={qr.id}
                      request={qr}
                      quote={quote}
                      t={t}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Accepted section */}
          {statusGroups.accepted.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t('booking.quotes.accepted')} ({statusGroups.accepted.length})
              </h2>
              <div className="space-y-3">
                {statusGroups.accepted.map((qr: any) => {
                  const quote = quotesByRequest[qr.id];
                  return (
                    <RequestCard
                      key={qr.id}
                      request={qr}
                      quote={quote}
                      t={t}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Other statuses */}
          {statusGroups.other.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t('booking.quotes.otherStatuses')} ({statusGroups.other.length})
              </h2>
              <div className="space-y-3">
                {statusGroups.other.map((qr: any) => (
                  <RequestCard key={qr.id} request={qr} t={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Send Quote Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={v => { if (!v) { setQuoteDialogOpen(false); setSelectedRequest(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('booking.quotes.sendQuote')}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">
                  <ULLText meaningId={selectedRequest.service_title_meaning_id} fallback={selectedRequest.service_title_fallback} />
                </p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {selectedRequest.event_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(selectedRequest.event_date), 'PP')}
                    </span>
                  )}
                  {selectedRequest.guest_count && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {selectedRequest.guest_count} guests
                    </span>
                  )}
                </div>
                {selectedRequest.notes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <ULLText meaningId={selectedRequest.meaning_object_id} fallback={selectedRequest.notes} />
                  </p>
                )}
              </div>

              <div>
                <Label>{t('booking.quotes.quoteAmount')} ({selectedRequest.service_currency || 'AED'}) *</Label>
                <Input
                  type="number"
                  value={quoteForm.amount}
                  onChange={e => setQuoteForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>{t('booking.quotes.depositAmount')}</Label>
                <Input
                  type="number"
                  value={quoteForm.deposit}
                  onChange={e => setQuoteForm(p => ({ ...p, deposit: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>{t('booking.quotes.expiryPreset')}</Label>
                <Select value={quoteForm.expiry} onValueChange={v => setQuoteForm(p => ({ ...p, expiry: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24h</SelectItem>
                    <SelectItem value="48">48h</SelectItem>
                    <SelectItem value="72">72h</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('booking.quotes.notes')}</Label>
                <Textarea
                  value={quoteForm.notes}
                  onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder={t('booking.quotes.notesPlaceholder')}
                  rows={3}
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => sendQuote.mutate()}
                disabled={!quoteForm.amount || sendQuote.isPending}
              >
                <Send className="h-4 w-4" />
                {t('booking.quotes.sendQuote')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Request Card ──
function RequestCard({
  request,
  quote,
  onSendQuote,
  t,
}: {
  request: any;
  quote?: any;
  onSendQuote?: () => void;
  t: (key: string, opts?: any) => string;
}) {
  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            <ULLText meaningId={request.service_title_meaning_id} fallback={request.service_title_fallback} />
          </p>
          <BookingStatusBadge status={request.status} />
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {request.event_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(request.event_date), 'PP')}
            </span>
          )}
          {request.guest_count && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {request.guest_count} {t('booking.quotes.guestCount').toLowerCase()}
            </span>
          )}
          <span>{format(new Date(request.created_at), 'PP')}</span>
        </div>
        {request.notes && (
          <p className="text-xs text-muted-foreground">
            <ULLText meaningId={request.meaning_object_id} fallback={request.notes} />
          </p>
        )}
        {quote && (
          <div className="flex items-center gap-3 text-xs bg-muted/40 rounded p-2">
            <span className="font-medium text-foreground">{quote.currency} {quote.amount}</span>
            {quote.deposit_amount && <span>Deposit: {quote.currency} {quote.deposit_amount}</span>}
            <Badge variant="secondary" className="text-[10px]">{quote.status}</Badge>
          </div>
        )}
        {onSendQuote && request.status === 'requested' && (
          <Button size="sm" onClick={onSendQuote} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {t('booking.quotes.sendQuote')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
