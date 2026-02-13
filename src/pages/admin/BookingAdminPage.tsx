/**
 * Admin Backoffice — Vendor Management
 * Route: /admin/booking/:tenantSlug
 * Access: owner/admin only. Approve/suspend vendors.
 */
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { tenantQueryOptions } from '@/lib/booking/tenantResolver';
import { auditAndEmit } from '@/lib/booking/auditHelper';
import { ULLText } from '@/components/ull/ULLText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Store, CheckCircle2, Ban, Shield, Copy, ExternalLink,
  Loader2, AlertTriangle, Users,
} from 'lucide-react';
import { toast } from 'sonner';

export default function BookingAdminPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Resolve tenant
  const { data: tenant, isLoading: tLoading, error: tErr } = useQuery(tenantQueryOptions(tenantSlug));

  // Fetch vendors
  const { data: vendors = [], isLoading: vLoading } = useQuery({
    queryKey: ['admin-vendors', tenant?.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_vendors')
        .select('*, profile:booking_vendor_profiles(display_name, display_name_meaning_object_id, email, logo_url)')
        .eq('workspace_id', tenant!.workspace_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((v: any) => ({
        ...v,
        profile: Array.isArray(v.profile) ? v.profile[0] : v.profile,
      }));
    },
    enabled: !!tenant?.workspace_id,
  });

  // Approve vendor
  const approveVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!user || !tenant) throw new Error('Unauthorized');
      const { error } = await supabase
        .from('booking_vendors')
        .update({
          status: 'approved' as any,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          suspended_at: null,
        })
        .eq('id', vendorId);
      if (error) throw error;

      await auditAndEmit({
        workspace_id: tenant.workspace_id,
        actor_user_id: user.id,
        action: 'booking.vendor_approved',
        event_type: 'booking.vendor_approved',
        entity_type: 'booking_vendor',
        entity_id: vendorId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      toast.success('Vendor approved');
    },
    onError: () => toast.error('Failed to approve vendor'),
  });

  // Suspend vendor
  const suspendVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!user || !tenant) throw new Error('Unauthorized');
      const { error } = await supabase
        .from('booking_vendors')
        .update({
          status: 'suspended' as any,
          suspended_at: new Date().toISOString(),
        })
        .eq('id', vendorId);
      if (error) throw error;

      await auditAndEmit({
        workspace_id: tenant.workspace_id,
        actor_user_id: user.id,
        action: 'booking.vendor_suspended',
        event_type: 'booking.vendor_suspended',
        entity_type: 'booking_vendor',
        entity_id: vendorId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      toast.success('Vendor suspended');
    },
    onError: () => toast.error('Failed to suspend vendor'),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (tLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant || tErr) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold text-foreground">Tenant not found</h1>
        <p className="text-muted-foreground text-sm">Slug: {tenantSlug}</p>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/b2/${tenantSlug}`;
  const vendorUrl = `${window.location.origin}/v2/${tenantSlug}`;

  const statusColor = (s: string) => {
    if (s === 'approved') return 'default';
    if (s === 'pending') return 'secondary';
    if (s === 'suspended') return 'destructive';
    return 'outline';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">
              Booking Admin — {tenant.workspace_name}
            </h1>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground mr-1">Public:</span>
              <Input
                readOnly
                value={publicUrl}
                className="h-7 text-xs w-52 bg-transparent border-0 p-0"
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(publicUrl)}>
                <Copy className="h-3 w-3" />
              </Button>
              <Link to={`/b2/${tenantSlug}`} target="_blank">
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground mr-1">Vendor:</span>
              <Input
                readOnly
                value={vendorUrl}
                className="h-7 text-xs w-52 bg-transparent border-0 p-0"
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(vendorUrl)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vendors ({vendors.length})
          </h2>
        </div>

        {vLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
        ) : vendors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No vendors registered yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {vendors.map((v: any) => (
              <Card key={v.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {v.profile?.logo_url ? (
                        <img src={v.profile.logo_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                          {(v.profile?.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          <ULLText
                            meaningId={v.profile?.display_name_meaning_object_id}
                            fallback={v.profile?.display_name || 'Unknown'}
                          />
                        </p>
                        {v.profile?.email && (
                          <p className="text-xs text-muted-foreground truncate">{v.profile.email}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Joined: {new Date(v.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusColor(v.status) as any} className="text-xs">
                        {v.status}
                      </Badge>
                      {v.status === 'pending' && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => approveVendor.mutate(v.id)}
                          disabled={approveVendor.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      )}
                      {v.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => suspendVendor.mutate(v.id)}
                          disabled={suspendVendor.isPending}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Suspend
                        </Button>
                      )}
                      {v.status === 'suspended' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => approveVendor.mutate(v.id)}
                          disabled={approveVendor.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
