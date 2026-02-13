/**
 * Vendor Services Management Page
 *
 * Full CRUD for vendor services with:
 * - ULL meaning objects for title/description
 * - Image upload via booking-assets bucket
 * - Audit logs + OIL org_events for every write
 * - Draft/published (is_active toggle)
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createMeaningObject, buildMeaningFromText } from '@/lib/meaningObject';
import { guardMeaningInsert } from '@/lib/meaningGuard';
import { auditAndEmit } from '@/lib/booking/auditHelper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { ULLText } from '@/components/ull/ULLText';
import { ImageUpload } from '@/components/booking/ImageUpload';
import { Package, Plus, Edit3, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceForm {
  title: string;
  description: string;
  price_type: 'fixed' | 'custom_quote';
  price_amount: string;
  currency: string;
  duration_minutes: string;
  min_guests: string;
  max_guests: string;
  is_active: boolean;
  cover_url: string;
}

const DEFAULT_FORM: ServiceForm = {
  title: '',
  description: '',
  price_type: 'fixed',
  price_amount: '',
  currency: 'AED',
  duration_minutes: '',
  min_guests: '',
  max_guests: '',
  is_active: true,
  cover_url: '',
};

export default function VendorServicesPage() {
  const { t } = useTranslation();
  const { workspaceId, vendorId, tenantSlug } = useOutletContext<{
    workspaceId: string;
    vendorId: string;
    tenantSlug: string;
  }>();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(DEFAULT_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch services
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['vendor-services', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

  // Create service
  const createService = useMutation({
    mutationFn: async () => {
      if (!user || !workspaceId) throw new Error('Not authenticated');

      const titleMeaningId = await createMeaningObject({
        workspaceId,
        createdBy: user.id,
        type: 'TASK',
        sourceLang: currentLanguage.code,
        meaningJson: buildMeaningFromText({
          type: 'TASK',
          title: form.title,
          createdFrom: 'user',
        }),
      });
      if (!titleMeaningId) throw new Error('Failed to create title meaning');

      let descMeaningId: string | null = null;
      if (form.description.trim()) {
        descMeaningId = await createMeaningObject({
          workspaceId,
          createdBy: user.id,
          type: 'TASK',
          sourceLang: currentLanguage.code,
          meaningJson: buildMeaningFromText({
            type: 'TASK',
            title: form.description,
            createdFrom: 'user',
          }),
        });
      }

      const payload = {
        workspace_id: workspaceId,
        vendor_id: vendorId,
        title: form.title,
        description: form.description || null,
        price_type: form.price_type,
        price_amount: form.price_amount ? Number(form.price_amount) : null,
        currency: form.currency,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        min_guests: form.min_guests ? Number(form.min_guests) : null,
        max_guests: form.max_guests ? Number(form.max_guests) : null,
        is_active: form.is_active,
        title_meaning_object_id: titleMeaningId,
        description_meaning_object_id: descMeaningId,
        source_lang: currentLanguage.code,
        sort_order: services.length,
      };
      guardMeaningInsert('booking_services', payload);

      const { data, error } = await supabase
        .from('booking_services')
        .insert(payload as any)
        .select('id')
        .single();
      if (error) throw error;

      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.service_created',
        event_type: 'booking.service_published',
        entity_type: 'booking_service',
        entity_id: data.id,
        meaning_object_id: titleMeaningId,
      });

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-services'] });
      toast.success(t('booking.services.serviceCreated'));
      closeDialog();
    },
    onError: () => toast.error(t('booking.services.serviceCreateFailed')),
  });

  // Update service
  const updateService = useMutation({
    mutationFn: async () => {
      if (!editingId || !user) throw new Error('No service selected');

      const updates: any = {
        title: form.title,
        description: form.description || null,
        price_type: form.price_type,
        price_amount: form.price_amount ? Number(form.price_amount) : null,
        currency: form.currency,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        min_guests: form.min_guests ? Number(form.min_guests) : null,
        max_guests: form.max_guests ? Number(form.max_guests) : null,
        is_active: form.is_active,
      };

      const { error } = await supabase
        .from('booking_services')
        .update(updates)
        .eq('id', editingId);
      if (error) throw error;

      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.service_updated',
        event_type: form.is_active ? 'booking.service_published' : 'booking.service_unpublished',
        entity_type: 'booking_service',
        entity_id: editingId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-services'] });
      toast.success(t('booking.services.serviceUpdated'));
      closeDialog();
    },
    onError: () => toast.error(t('booking.services.serviceUpdateFailed')),
  });

  // Delete service (soft — set is_active=false + audit)
  const deleteService = useMutation({
    mutationFn: async (serviceId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('booking_services')
        .update({ is_active: false } as any)
        .eq('id', serviceId);
      if (error) throw error;

      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: 'booking.service_deactivated',
        event_type: 'booking.service_unpublished',
        entity_type: 'booking_service',
        entity_id: serviceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-services'] });
      toast.success('Service deactivated');
      setDeleteConfirm(null);
    },
  });

  // Toggle active
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('booking_services')
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;

      await auditAndEmit({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        action: is_active ? 'booking.service_published' : 'booking.service_unpublished',
        event_type: is_active ? 'booking.service_published' : 'booking.service_unpublished',
        entity_type: 'booking_service',
        entity_id: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-services'] });
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (service: any) => {
    setEditingId(service.id);
    setForm({
      title: service.title || '',
      description: service.description || '',
      price_type: service.price_type || 'fixed',
      price_amount: service.price_amount?.toString() || '',
      currency: service.currency || 'AED',
      duration_minutes: service.duration_minutes?.toString() || '',
      min_guests: service.min_guests?.toString() || '',
      max_guests: service.max_guests?.toString() || '',
      is_active: service.is_active ?? true,
      cover_url: '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (editingId) {
      updateService.mutate();
    } else {
      createService.mutate();
    }
  };

  const saving = createService.isPending || updateService.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('booking.services.title')}</h1>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('booking.services.addService')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : services.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={Package}
            title={t('booking.services.emptyTitle')}
            description={t('booking.services.emptyDesc')}
          />
          <div className="flex justify-center">
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t('booking.services.addService')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s: any) => (
            <Card key={s.id} className={!s.is_active ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        <ULLText meaningId={s.title_meaning_object_id} fallback={s.title} />
                      </h3>
                      <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {s.is_active ? (
                          <><Eye className="h-2.5 w-2.5 mr-0.5" /> Published</>
                        ) : (
                          <><EyeOff className="h-2.5 w-2.5 mr-0.5" /> Draft</>
                        )}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                        <ULLText meaningId={s.description_meaning_object_id} fallback={s.description} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {s.price_type === 'fixed' && s.price_amount && (
                        <span className="font-medium text-foreground">{s.currency} {s.price_amount}</span>
                      )}
                      {s.price_type === 'custom_quote' && <span>Custom Quote</span>}
                      {s.duration_minutes && <span>{s.duration_minutes} min</span>}
                      {s.min_guests && s.max_guests && <span>{s.min_guests}–{s.max_guests} guests</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={checked => toggleActive.mutate({ id: s.id, is_active: checked })}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteConfirm(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('booking.services.editService') : t('booking.services.addService')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('booking.services.serviceTitle')} *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder={t('booking.services.titlePlaceholder')}
              />
            </div>
            <div>
              <Label>{t('booking.services.serviceDescription')}</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Image Upload */}
            <ImageUpload
              currentUrl={form.cover_url || null}
              workspaceId={workspaceId}
              category="service-cover"
              entityId={editingId || undefined}
              onUploaded={url => setForm(p => ({ ...p, cover_url: url }))}
              onRemoved={() => setForm(p => ({ ...p, cover_url: '' }))}
              aspectRatio="wide"
              label={t('booking.services.coverImage')}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('booking.services.priceType')}</Label>
                <Select value={form.price_type} onValueChange={v => setForm(p => ({ ...p, price_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t('booking.services.fixedPrice')}</SelectItem>
                    <SelectItem value="custom_quote">{t('booking.services.customQuote')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.price_type === 'fixed' && (
                <div>
                  <Label>{t('booking.services.price')}</Label>
                  <Input
                    type="number"
                    value={form.price_amount}
                    onChange={e => setForm(p => ({ ...p, price_amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t('booking.services.duration')}</Label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))}
                  placeholder="60"
                />
              </div>
              <div>
                <Label>{t('booking.services.minGuests')}</Label>
                <Input
                  type="number"
                  value={form.min_guests}
                  onChange={e => setForm(p => ({ ...p, min_guests: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t('booking.services.maxGuests')}</Label>
                <Input
                  type="number"
                  value={form.max_guests}
                  onChange={e => setForm(p => ({ ...p, max_guests: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={checked => setForm(p => ({ ...p, is_active: checked }))}
              />
              <Label>{form.is_active ? 'Published (visible to customers)' : 'Draft (hidden)'}</Label>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {editingId ? t('common.save') : t('booking.services.addService')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('booking.services.deleteConfirm')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('booking.services.deleteConfirmDesc')}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteService.mutate(deleteConfirm)}
              disabled={deleteService.isPending}
            >
              {t('booking.services.deactivate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
