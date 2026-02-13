/**
 * V2 Vendor Profile Page
 * Edit display_name, bio, email, whatsapp + vendor logo upload.
 * All writes use auditAndEmit.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { auditAndEmit } from '@/lib/booking/auditHelper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageUpload } from '@/components/booking/ImageUpload';
import { Save, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileForm {
  display_name: string;
  bio: string;
  email: string;
  whatsapp: string;
  logo_url: string;
}

export default function VendorProfilePage() {
  const { t } = useTranslation();
  const { workspaceId, vendorId, tenantSlug } = useOutletContext<{
    workspaceId: string;
    vendorId: string;
    tenantSlug: string;
  }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ProfileForm>({
    display_name: '',
    bio: '',
    email: '',
    whatsapp: '',
    logo_url: '',
  });

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['vendor-profile-v2', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_vendor_profiles')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!vendorId,
  });

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        email: profile.email || '',
        whatsapp: profile.whatsapp || '',
        logo_url: profile.logo_url || '',
      });
    }
  }, [profile]);

  // Save mutation
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('Not authenticated');

      const updates: Record<string, unknown> = {
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        email: form.email.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        logo_url: form.logo_url || null,
      };

      const { error } = await supabase
        .from('booking_vendor_profiles')
        .update(updates as any)
        .eq('vendor_id', vendorId);
      if (error) throw error;

      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.vendor_profile_updated',
        event_type: 'booking.vendor_profile_updated',
        entity_type: 'booking_vendor_profile',
        entity_id: vendorId,
        metadata: { fields_changed: Object.keys(updates) },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-profile-v2'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-portal-v2'] });
      toast.success(t('booking.vendor.profileUpdated'));
    },
    onError: () => toast.error(t('booking.vendor.profileUpdateFailed')),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-32" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('booking.vendor.profile')}</h1>

      {/* DEV-only debug */}
      {import.meta.env.DEV && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              console.log('[DEV] VendorProfilePage context:', { workspaceId, vendorId, tenantSlug });
              console.log('[DEV] Profile:', profile);
            }}
          >
            🐛 Log Profile Context
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            v:{vendorId?.slice(0, 8)}
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('booking.vendor.businessProfile')}
          </CardTitle>
          <CardDescription>{t('booking.vendor.profileDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo Upload */}
          <div>
            <Label className="mb-2 block">{t('booking.vendor.logoLabel')}</Label>
            <div className="max-w-[160px]">
              <ImageUpload
                currentUrl={form.logo_url || null}
                workspaceId={workspaceId}
                category="vendor-logo"
                entityId={vendorId}
                onUploaded={url => setForm(p => ({ ...p, logo_url: url }))}
                onRemoved={() => setForm(p => ({ ...p, logo_url: '' }))}
                aspectRatio="square"
              />
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label>{t('booking.vendor.businessName')} *</Label>
            <Input
              value={form.display_name}
              onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
              placeholder={t('booking.vendor.businessNamePlaceholder')}
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label>{t('booking.vendor.bioLabel')}</Label>
            <Textarea
              value={form.bio}
              onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              placeholder={t('booking.vendor.bioPlaceholder')}
              rows={3}
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('booking.public.auth.email')}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="vendor@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                placeholder="+971501234567"
              />
            </div>
          </div>

          <Button
            onClick={() => saveProfile.mutate()}
            disabled={!form.display_name.trim() || saveProfile.isPending}
            className="gap-2"
          >
            {saveProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
