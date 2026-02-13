import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to manage contextual chat threads for booking quote requests.
 * Auto-creates a thread when a quote request is created,
 * adding customer + vendor owner as participants.
 */
export function useBookingChat() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  /**
   * Create a booking_quote chat thread and link it to a quote request.
   * Idempotent: returns existing thread if already linked.
   */
  const createQuoteThread = useCallback(async (params: {
    quoteRequestId: string;
    customerUserId: string;
    vendorId: string;
    serviceTitle: string;
  }): Promise<string | null> => {
    if (!currentWorkspace || !user) return null;

    // Check if thread already exists for this quote request
    const { data: existingQr } = await supabase
      .from('booking_quote_requests')
      .select('chat_thread_id')
      .eq('id', params.quoteRequestId)
      .single();

    if (existingQr?.chat_thread_id) return existingQr.chat_thread_id;

    // Get vendor owner user ID
    const { data: vendor } = await supabase
      .from('booking_vendors')
      .select('owner_user_id')
      .eq('id', params.vendorId)
      .single();

    if (!vendor) return null;

    // Create thread
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .insert({
        workspace_id: currentWorkspace.id,
        type: 'booking_quote',
        title: params.serviceTitle,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (threadError || !thread) {
      console.error('[BookingChat] Failed to create thread:', threadError?.message);
      return null;
    }

    // Add members: customer + vendor owner (deduplicated)
    const memberIds = [...new Set([params.customerUserId, vendor.owner_user_id])];
    const memberRows = memberIds.map(uid => ({
      thread_id: thread.id,
      user_id: uid,
      role: uid === params.customerUserId ? 'customer' : 'vendor',
    }));

    const { error: memberError } = await supabase
      .from('chat_thread_members')
      .insert(memberRows);

    if (memberError) {
      console.error('[BookingChat] Failed to add members:', memberError.message);
    }

    // Link thread to quote request
    await supabase
      .from('booking_quote_requests')
      .update({ chat_thread_id: thread.id } as any)
      .eq('id', params.quoteRequestId);

    return thread.id;
  }, [currentWorkspace?.id, user?.id]);

  return { createQuoteThread };
}
