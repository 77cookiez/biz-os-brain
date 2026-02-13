import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { BookingChatPanel } from '@/components/booking/BookingChatPanel';
import { ULLText } from '@/components/ull/ULLText';
import { MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

export default function VendorChatPage() {
  const { t } = useTranslation();
  const { vendorId } = useOutletContext<{ workspaceId: string; vendorId: string; tenantSlug: string }>();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  // Fetch quote requests that have linked chat threads
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['vendor-chat-threads', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_quote_requests')
        .select('id, chat_thread_id, created_at, service:booking_services(title, title_meaning_object_id)')
        .eq('vendor_id', vendorId)
        .not('chat_thread_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((qr: any) => ({
        quoteRequestId: qr.id,
        threadId: qr.chat_thread_id,
        createdAt: qr.created_at,
        serviceTitleFallback: qr.service?.title || '—',
        serviceTitleMeaningId: qr.service?.title_meaning_object_id || null,
      }));
    },
    enabled: !!vendorId,
  });

  if (selectedThread) {
    return (
      <div className="h-[70vh]">
        <BookingChatPanel
          threadId={selectedThread}
          onBack={() => setSelectedThread(null)}
          className="h-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.vendor.chat')}</h1>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : threads.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('booking.chat.emptyTitle')} description={t('booking.chat.emptyDesc')} />
      ) : (
        <div className="space-y-3">
          {threads.map(th => (
            <Card
              key={th.threadId}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedThread(th.threadId)}
            >
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    <ULLText meaningId={th.serviceTitleMeaningId} fallback={th.serviceTitleFallback} />
                  </p>
                  <p className="text-xs text-muted-foreground">{format(new Date(th.createdAt), 'PP')}</p>
                </div>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
