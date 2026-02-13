import { useTranslation } from 'react-i18next';
import { useBookingVendors, BookingVendor } from '@/hooks/useBookingVendors';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import { EmptyState } from '@/components/EmptyState';
import { Store, CheckCircle2, XCircle, Clock, RefreshCw, Copy, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  switch (status) {
    case 'approved':
      return <Badge variant="default" className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" />{t('booking.status.approved')}</Badge>;
    case 'suspended':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{t('booking.status.suspended')}</Badge>;
    default:
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{t('booking.status.pending')}</Badge>;
  }
}

export default function BookingVendorsPage() {
  const { t } = useTranslation();
  const { vendors, isLoading, approveVendor, suspendVendor, reactivateVendor } = useBookingVendors();
  const { settings } = useBookingSettings();

  const vendorInviteLink = settings?.tenant_slug
    ? `${window.location.origin}/v/${settings.tenant_slug}`
    : null;

  const copyInviteLink = () => {
    if (vendorInviteLink) {
      navigator.clipboard.writeText(vendorInviteLink);
      toast.success(t('booking.vendors.linkCopied'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{t('booking.vendors.title')}</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('booking.vendors.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('booking.vendors.subtitle', { count: vendors.length })}
          </p>
        </div>
      </div>

      {/* Invite Link Card */}
      {vendorInviteLink && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t('booking.vendors.inviteTitle')}</p>
                <p className="text-xs text-muted-foreground truncate">{vendorInviteLink}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copyInviteLink}>
                <Copy className="h-3.5 w-3.5" />
                {t('booking.vendors.copyLink')}
              </Button>
              <a href={vendorInviteLink} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendors Table */}
      {vendors.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t('booking.vendors.emptyTitle')}
          description={t('booking.vendors.emptyDesc')}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('booking.vendors.vendorName')}</TableHead>
                <TableHead>{t('booking.vendors.contact')}</TableHead>
                <TableHead>{t('booking.vendors.statusLabel')}</TableHead>
                <TableHead>{t('booking.vendors.joined')}</TableHead>
                <TableHead className="text-right">{t('booking.vendors.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {vendor.profile?.display_name?.charAt(0)?.toUpperCase() || 'V'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{vendor.profile?.display_name || '—'}</p>
                        {vendor.profile?.bio && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{vendor.profile.bio}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {vendor.profile?.email && (
                        <p className="text-xs text-muted-foreground">{vendor.profile.email}</p>
                      )}
                      {vendor.profile?.whatsapp && (
                        <p className="text-xs text-muted-foreground">{vendor.profile.whatsapp}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={vendor.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {vendor.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs gap-1"
                          onClick={() => approveVendor.mutate(vendor.id)}
                          disabled={approveVendor.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('booking.vendors.approve')}
                        </Button>
                      )}
                      {vendor.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 text-destructive"
                          onClick={() => suspendVendor.mutate(vendor.id)}
                          disabled={suspendVendor.isPending}
                        >
                          <XCircle className="h-3 w-3" />
                          {t('booking.vendors.suspend')}
                        </Button>
                      )}
                      {vendor.status === 'suspended' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1"
                          onClick={() => reactivateVendor.mutate(vendor.id)}
                          disabled={reactivateVendor.isPending}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t('booking.vendors.reactivate')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
