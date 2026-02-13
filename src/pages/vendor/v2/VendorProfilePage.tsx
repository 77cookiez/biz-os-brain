/**
 * V2 Vendor Profile Page — ULL Compliant
 * Creates/updates meaning objects for display_name and bio.
 * All writes use auditAndEmit.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createMeaningObject, updateMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
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
  const { currentLanguage } = useLanguage();
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

  // Save mutation — ULL compliant
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('Not authenticated');

      const trimmedName = form.display_name.trim();
      const trimmedBio = form.bio.trim();

      // 1. Handle display_name meaning object
      let displayNameMeaningId = profile.display_name_meaning_object_id;
      if (displayNameMeaningId) {
        // Update existing meaning object
        await updateMeaningObject({
          meaningObjectId: displayNameMeaningId,
          meaningJson: buildMeaningFromText({
            type: 'MESSAGE',
            title: trimmedName,
            createdFrom: 'user',
          }),
        });
      } else {
        // Create new meaning object
        displayNameMeaningId = await createMeaningObject({
          workspaceId,
          createdBy: user.id,
          type: 'MESSAGE',
          sourceLang: currentLanguage.code,
          meaningJson: buildMeaningFromText({
            type: 'MESSAGE',
            title: trimmedName,
            createdFrom: 'user',
          }),
        });
        if (!displayNameMeaningId) throw new Error('Failed to create display name meaning');
      }

      // 2. Handle bio meaning object (optional)
      let bioMeaningId = profile.bio_meaning_object_id;
      if (trimmedBio) {
        if (bioMeaningId) {
          await updateMeaningObject({
            meaningObjectId: bioMeaningId,
            meaningJson: buildMeaningFromText({
              type: 'MESSAGE',
              title: trimmedBio,
              createdFrom: 'user',
            }),
          });
        } else {
          bioMeaningId = await createMeaningObject({
            workspaceId,
            createdBy: user.id,
            type: 'MESSAGE',
            sourceLang: currentLanguage.code,
            meaningJson: buildMeaningFromText({
              type: 'MESSAGE',
              title: trimmedBio,
              createdFrom: 'user',
            }),
          });
        }
      }

      // 3. Update profile with meaning IDs + fallback strings
      const updates: Record<string, unknown> = {
        display_name: trimmedName,
        display_name_meaning_object_id: displayNameMeaningId,
        bio: trimmedBio || null,
        bio_meaning_object_id: bioMeaningId || null,
        email: form.email.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        logo_url: form.logo_url || null,
        source_lang: currentLanguage.code,
      };

      // Validate meaning guard
      guardMeaningInsert('booking_vendor_profiles', updates);

      const { error } = await supabase
        .from('booking_vendor_profiles')
        .update(updates as any)
        .eq('vendor_id', vendorId);
      if (error) throw error;

      // 4. Audit + OIL
      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.vendor_profile_updated',
        event_type: 'booking.vendor_profile_updated',
        entity_type: 'booking_vendor_profile',
        entity_id: vendorId,
        meaning_object_id: displayNameMeaningId,
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('booking.vendor.businessProfile')}
          </CardTitle>
          <CardDescription>{t('booking.vendor.profileDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo Upload — standardized path */}
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
