import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookingSettings } from '@/hooks/useBookingSettings';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LogoUpload } from '@/components/booking/LogoUpload';
import { Textarea } from '@/components/ui/textarea';
import {
  LayoutGrid, Palette, Banknote, ShieldCheck, Rocket, Smartphone as SmartphoneIcon,
  ArrowLeft, ArrowRight, Check, Globe, Smartphone, Building2,
  CheckCircle2, XCircle, Loader2, Upload, Camera, AlertCircle,
  Sparkles, Eye,
} from 'lucide-react';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR'] as const;
const THEMES = ['marketplace', 'rentals', 'eventServices', 'generic'] as const;
const TONES = ['professional', 'friendly', 'luxury', 'casual'] as const;
const CANCELLATION_POLICIES = ['flexible', 'standard', 'strict'] as const;

const COLOR_PRESETS = [
  // Row 1: Core presets
  { id: 'modernBlue', name: 'Modern Blue', primary: '#3B82F6', accent: '#F59E0B' },
  { id: 'warmCoral', name: 'Warm Coral', primary: '#F43F5E', accent: '#A78BFA' },
  { id: 'elegantGold', name: 'Elegant Gold', primary: '#D97706', accent: '#1E293B' },
  { id: 'freshGreen', name: 'Fresh Green', primary: '#10B981', accent: '#6366F1' },
  { id: 'luxuryDark', name: 'Luxury Dark', primary: '#1E293B', accent: '#F59E0B' },
  { id: 'royalPurple', name: 'Royal Purple', primary: '#7C3AED', accent: '#F97316' },
  // Row 2: Industry-standard global palettes
  { id: 'oceanTeal', name: 'Ocean Teal', primary: '#0891B2', accent: '#F43F5E' },
  { id: 'sunsetOrange', name: 'Sunset Orange', primary: '#EA580C', accent: '#0284C7' },
  { id: 'rosePink', name: 'Rose Pink', primary: '#E11D48', accent: '#7C3AED' },
  { id: 'slatePro', name: 'Slate Professional', primary: '#475569', accent: '#3B82F6' },
  { id: 'emeraldFinance', name: 'Emerald Finance', primary: '#059669', accent: '#F59E0B' },
  { id: 'midnightPremium', name: 'Midnight Premium', primary: '#0F172A', accent: '#A78BFA' },
] as const;

const THEME_PREVIEWS: Record<string, { color: string; icon: string }> = {
  marketplace: { color: '#3B82F6', icon: '🏪' },
  rentals: { color: '#10B981', icon: '🏠' },
  eventServices: { color: '#F43F5E', icon: '🎉' },
  generic: { color: '#6366F1', icon: '⚡' },
};

interface WizardData {
  theme_template: string;
  primary_color: string;
  accent_color: string;
  tone: string;
  logo_url: string | null;
  currency: string;
  commission_mode: string;
  commission_rate: number;
  deposit_enabled: boolean;
  deposit_type: string;
  deposit_value: number;
  cancellation_policy: string;
  whatsapp_number: string;
  contact_email: string;
  tenant_slug: string;
  app_name: string;
  app_icon_url: string | null;
  app_splash_url: string | null;
  app_description: string;
  app_keywords: string;
  app_support_email: string;
  app_privacy_url: string;
}

const STEP_ICONS = [LayoutGrid, Palette, Banknote, ShieldCheck, SmartphoneIcon, Rocket];

export default function BookingSetupWizard({ onComplete }: { onComplete?: () => void }) {
  const { t } = useTranslation();
  const { settings, upsertSettings } = useBookingSettings();
  const { currentWorkspace } = useWorkspace();
  const [step, setStep] = useState(0);
  const totalSteps = 6;
  const [appIconUploading, setAppIconUploading] = useState(false);

  const [data, setData] = useState<WizardData>({
    theme_template: settings?.theme_template ?? 'marketplace',
    primary_color: settings?.primary_color ?? '#6366f1',
    accent_color: settings?.accent_color ?? '#f59e0b',
    tone: settings?.tone ?? 'professional',
    logo_url: settings?.logo_url ?? null,
    currency: settings?.currency ?? 'USD',
    commission_mode: settings?.commission_mode ?? 'subscription',
    commission_rate: settings?.commission_rate ?? 0,
    deposit_enabled: settings?.deposit_enabled ?? true,
    deposit_type: settings?.deposit_type ?? 'percentage',
    deposit_value: settings?.deposit_value ?? 25,
    cancellation_policy: settings?.cancellation_policy ?? 'standard',
    whatsapp_number: settings?.whatsapp_number ?? '',
    contact_email: settings?.contact_email ?? '',
    tenant_slug: settings?.tenant_slug ?? '',
    app_name: settings?.app_name ?? '',
    app_icon_url: settings?.app_icon_url ?? null,
    app_splash_url: settings?.app_splash_url ?? null,
    app_description: settings?.app_description ?? '',
    app_keywords: settings?.app_keywords ?? '',
    app_support_email: settings?.app_support_email ?? '',
    app_privacy_url: settings?.app_privacy_url ?? '',
  });

  const [debouncedSlug, setDebouncedSlug] = useState(data.tenant_slug);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(data.tenant_slug), 500);
    return () => clearTimeout(timer);
  }, [data.tenant_slug]);

  const RESERVED_SLUGS = ['admin', 'apps', 'api', 'v', 'b', 'login', 'signup', 'settings', 'auth', 'public', 'dashboard'];
  const isReservedSlug = RESERVED_SLUGS.includes(debouncedSlug);

  const { data: slugTaken, isLoading: slugChecking } = useQuery({
    queryKey: ['slug-check', debouncedSlug],
    queryFn: async () => {
      if (!debouncedSlug || debouncedSlug.length < 3 || isReservedSlug) return false;
      const { data: existing } = await supabase
        .from('booking_settings')
        .select('id')
        .eq('tenant_slug', debouncedSlug)
        .neq('workspace_id', currentWorkspace?.id ?? '')
        .maybeSingle();
      return !!existing;
    },
    enabled: !!debouncedSlug && debouncedSlug.length >= 3 && !isReservedSlug,
  });

  const slugUnavailable = slugTaken || isReservedSlug;

  const update = (key: keyof WizardData, value: any) =>
    setData(prev => ({ ...prev, [key]: value }));

  const handleSave = async (goLive = false) => {
    const saveData: Record<string, unknown> = {
      ...data,
      is_live: goLive,
      app_bundle_id: data.tenant_slug ? `com.bookivo.${data.tenant_slug}` : null,
    };
    upsertSettings.mutate(
      saveData as any,
      {
        onSuccess: async () => {
          if (goLive) {
            if (currentWorkspace) {
              await supabase
                .from('booking_subscriptions')
                .upsert(
                  {
                    workspace_id: currentWorkspace.id,
                    status: 'trial',
                    plan: 'monthly',
                    started_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                  },
                  { onConflict: 'workspace_id' }
                );
            }
            toast.success(t('booking.wizard.launched'));
          }
          onComplete?.();
        },
      }
    );
  };

  const handleAppIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error(t('booking.wizard.app.iconInvalidType', 'Only PNG, JPG, or WebP images are allowed'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('booking.wizard.app.iconTooLarge', 'Icon must be under 5MB'));
      return;
    }
    setAppIconUploading(true);
    try {
      const filePath = `${currentWorkspace.id}/app-icon-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('booking-assets')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('booking-assets')
        .getPublicUrl(filePath);
      update('app_icon_url', `${publicUrl}?t=${Date.now()}`);
      toast.success(t('booking.wizard.app.iconUploaded', 'App icon uploaded'));
    } catch {
      toast.error(t('booking.wizard.app.iconUploadFailed', 'Failed to upload app icon'));
    } finally {
      setAppIconUploading(false);
    }
  };

  const canProceed = () => {
    if (step === 4) return data.app_name.length >= 3 && data.app_description.length >= 10;
    if (step === 5) return !!data.tenant_slug && data.tenant_slug.length >= 3 && !slugUnavailable;
    return true;
  };

  // Pre-launch checklist items
  const checklistItems = [
    { label: t('booking.wizard.checklist.theme', 'Theme selected'), done: !!data.theme_template, value: t(`booking.wizard.theme.${data.theme_template}`) },
    { label: t('booking.wizard.checklist.colors', 'Brand colors'), done: !!data.primary_color, value: data.primary_color },
    { label: t('booking.wizard.checklist.currency', 'Currency'), done: !!data.currency, value: data.currency },
    { label: t('booking.wizard.checklist.policy', 'Cancellation policy'), done: !!data.cancellation_policy, value: t(`booking.wizard.policies.${data.cancellation_policy}`) },
    { label: t('booking.wizard.checklist.appName', 'App name'), done: data.app_name.length >= 3, value: data.app_name || '—' },
    { label: t('booking.wizard.checklist.slug', 'Public URL'), done: data.tenant_slug.length >= 3 && !slugUnavailable, value: data.tenant_slug ? `/b/${data.tenant_slug}` : '—' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('booking.wizard.step', { current: step + 1, total: totalSteps })}</span>
          <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
        </div>
        <Progress value={((step + 1) / totalSteps) * 100} className="h-2" />
      </div>

      {/* Step 0: Theme */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <LayoutGrid className="h-5 w-5" />
              {t('booking.wizard.theme.title')}
            </CardTitle>
            <CardDescription>{t('booking.wizard.theme.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={data.theme_template}
              onValueChange={(v) => update('theme_template', v)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {THEMES.map(theme => {
                const preview = THEME_PREVIEWS[theme];
                return (
                  <Label
                    key={theme}
                    htmlFor={`theme-${theme}`}
                    className={`flex flex-col gap-2 rounded-lg border p-4 cursor-pointer transition-colors ${
                      data.theme_template === theme ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {/* Visual Preview */}
                    <div className="rounded-md overflow-hidden border border-border bg-muted/50 p-3 mb-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: preview.color }} />
                        <div className="h-2 w-16 rounded bg-muted" />
                      </div>
                      <div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex-1 h-8 rounded-sm bg-muted" />
                        ))}
                      </div>
                      <div className="text-center mt-1 text-lg">{preview.icon}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={theme} id={`theme-${theme}`} />
                      <span className="font-medium text-foreground">{t(`booking.wizard.theme.${theme}`)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ps-6">
                      {t(`booking.wizard.theme.${theme}Desc`)}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Brand */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Palette className="h-5 w-5" />
              {t('booking.wizard.brand.title')}
            </CardTitle>
            <CardDescription>{t('booking.wizard.brand.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Logo Upload */}
            {currentWorkspace && (
              <LogoUpload
                currentLogoUrl={data.logo_url}
                workspaceId={currentWorkspace.id}
                onUploadComplete={(url) => update('logo_url', url)}
              />
            )}

            {/* Color Presets */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('booking.wizard.brand.colorPresets', 'Color Presets')}
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-[200px] overflow-y-auto">
                {COLOR_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      update('primary_color', preset.primary);
                      update('accent_color', preset.accent);
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-center ${
                      data.primary_color === preset.primary && data.accent_color === preset.accent
                        ? 'border-primary ring-1 ring-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex gap-1">
                      <div className="h-5 w-5 rounded-full ring-1 ring-border" style={{ backgroundColor: preset.primary }} />
                      <div className="h-5 w-5 rounded-full ring-1 ring-border" style={{ backgroundColor: preset.accent }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {t(`booking.wizard.brand.preset.${preset.id}`, preset.name)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('booking.wizard.brand.primaryColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.primary_color}
                    onChange={(e) => update('primary_color', e.target.value)}
                    className="h-10 w-10 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={data.primary_color}
                    onChange={(e) => update('primary_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('booking.wizard.brand.accentColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.accent_color}
                    onChange={(e) => update('accent_color', e.target.value)}
                    className="h-10 w-10 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={data.accent_color}
                    onChange={(e) => update('accent_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Live Brand Preview */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                {t('booking.wizard.brand.livePreview', 'Live Preview')}
              </Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="h-12 flex items-center px-4 gap-3" style={{ backgroundColor: data.primary_color }}>
                  {data.logo_url ? (
                    <img src={data.logo_url} alt="Logo" className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <div className="h-7 w-7 rounded bg-background/20" />
                  )}
                  <div className="h-2.5 w-24 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.4)' }} />
                  <div className="ms-auto h-7 px-3 rounded-md flex items-center text-xs font-medium" style={{ backgroundColor: data.accent_color, color: '#fff' }}>
                    {t('booking.wizard.brand.previewBtn', 'Book Now')}
                  </div>
                </div>
                <div className="p-4 bg-card">
                  <div className="flex gap-2">
                    <div className="h-2 w-16 rounded" style={{ backgroundColor: data.primary_color + '30' }} />
                    <div className="h-2 w-12 rounded bg-muted" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('booking.wizard.brand.tone')}</Label>
              <Select value={data.tone} onValueChange={(v) => update('tone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map(tone => (
                    <SelectItem key={tone} value={tone}>
                      {t(`booking.wizard.brand.${tone}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Money */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Banknote className="h-5 w-5" />
              {t('booking.wizard.money.title')}
            </CardTitle>
            <CardDescription>{t('booking.wizard.money.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('booking.wizard.money.currency')}</Label>
              <Select value={data.currency} onValueChange={(v) => update('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('booking.wizard.money.commissionMode')}</Label>
              <RadioGroup
                value={data.commission_mode}
                onValueChange={(v) => update('commission_mode', v)}
                className="flex flex-col gap-2"
              >
                <Label htmlFor="cm-sub" className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="subscription" id="cm-sub" />
                  {t('booking.wizard.money.subscription')}
                </Label>
                <Label htmlFor="cm-com" className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="commission" id="cm-com" />
                  {t('booking.wizard.money.commission')}
                </Label>
              </RadioGroup>
            </div>
            {data.commission_mode === 'commission' && (
              <div className="space-y-2">
                <Label>{t('booking.wizard.money.commissionRate')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={data.commission_rate}
                  onChange={(e) => update('commission_rate', Number(e.target.value))}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>{t('booking.wizard.money.depositEnabled')}</Label>
              <Switch
                checked={data.deposit_enabled}
                onCheckedChange={(v) => update('deposit_enabled', v)}
              />
            </div>
            {data.deposit_enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('booking.wizard.money.depositType')}</Label>
                  <Select value={data.deposit_type} onValueChange={(v) => update('deposit_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t('booking.wizard.money.percentage')}</SelectItem>
                      <SelectItem value="fixed">{t('booking.wizard.money.fixed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('booking.wizard.money.depositValue')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={data.deposit_value}
                    onChange={(e) => update('deposit_value', Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Policies */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-5 w-5" />
              {t('booking.wizard.policies.title')}
            </CardTitle>
            <CardDescription>{t('booking.wizard.policies.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('booking.wizard.policies.cancellation')}</Label>
              <RadioGroup
                value={data.cancellation_policy}
                onValueChange={(v) => update('cancellation_policy', v)}
                className="flex flex-col gap-3"
              >
                {CANCELLATION_POLICIES.map(p => (
                  <Label
                    key={p}
                    htmlFor={`pol-${p}`}
                    className={`flex flex-col gap-1 rounded-lg border p-3 cursor-pointer transition-colors ${
                      data.cancellation_policy === p ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={p} id={`pol-${p}`} />
                      <span className="font-medium text-foreground">{t(`booking.wizard.policies.${p}`)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ps-6">
                      {t(`booking.wizard.policies.${p}Desc`)}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>{t('booking.wizard.policies.whatsapp')}</Label>
              <Input
                value={data.whatsapp_number}
                onChange={(e) => update('whatsapp_number', e.target.value)}
                placeholder="+971501234567"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">{t('booking.wizard.policies.whatsappHint')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('booking.wizard.policies.contactEmail')}</Label>
              <Input
                type="email"
                value={data.contact_email}
                onChange={(e) => update('contact_email', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Your App */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <SmartphoneIcon className="h-5 w-5" />
              {t('booking.wizard.app.title', 'Your App')}
            </CardTitle>
            <CardDescription>{t('booking.wizard.app.subtitle', 'Set up your app identity for app stores')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* App Name */}
            <div className="space-y-2">
              <Label>{t('booking.wizard.app.nameLabel', 'App Name')}</Label>
              <Input
                value={data.app_name}
                onChange={(e) => update('app_name', e.target.value.slice(0, 30))}
                placeholder={t('booking.wizard.app.namePlaceholder', "e.g., Ali's Wedding Services")}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                {data.app_name.length}/30 — {t('booking.wizard.app.nameHint', 'This appears on the phone home screen')}
              </p>
            </div>

            {/* App Icon */}
            <div className="space-y-2">
              <Label>{t('booking.wizard.app.iconLabel', 'App Icon')}</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {data.app_icon_url ? (
                    <img
                      src={data.app_icon_url}
                      alt="App Icon"
                      className="h-20 w-20 rounded-[22%] object-cover ring-1 ring-border shadow-md"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-[22%] bg-muted flex items-center justify-center ring-1 ring-border">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {appIconUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-[22%]">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAppIconUpload}
                    className="hidden"
                    id="app-icon-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('app-icon-input')?.click()}
                    disabled={appIconUploading}
                  >
                    <Upload className="h-4 w-4 me-1" />
                    {data.app_icon_url
                      ? t('booking.wizard.app.changeIcon', 'Change')
                      : t('booking.wizard.app.uploadIcon', 'Upload Icon')}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t('booking.wizard.app.iconHint', '1024×1024 PNG recommended. No transparency.')}
                  </p>
                </div>
              </div>

              {/* Phone previews (iOS + Android style) */}
              {data.app_name && (
                <div className="mt-3 flex gap-6 justify-center p-4 bg-muted/50 rounded-lg">
                  {/* iOS style */}
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] text-muted-foreground mb-1">iOS</p>
                    {data.app_icon_url ? (
                      <img src={data.app_icon_url} alt="iOS" className="h-14 w-14 rounded-[22%] shadow-md" />
                    ) : (
                      <div className="h-14 w-14 rounded-[22%] shadow-md flex items-center justify-center" style={{ backgroundColor: data.primary_color }}>
                        <span className="text-xl font-bold" style={{ color: '#fff' }}>{data.app_name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-[10px] font-medium text-foreground mt-0.5 truncate max-w-[72px]">
                      {data.app_name}
                    </span>
                  </div>
                  {/* Android style */}
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] text-muted-foreground mb-1">Android</p>
                    {data.app_icon_url ? (
                      <img src={data.app_icon_url} alt="Android" className="h-14 w-14 rounded-full shadow-md" />
                    ) : (
                      <div className="h-14 w-14 rounded-full shadow-md flex items-center justify-center" style={{ backgroundColor: data.primary_color }}>
                        <span className="text-xl font-bold" style={{ color: '#fff' }}>{data.app_name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-[10px] font-medium text-foreground mt-0.5 truncate max-w-[72px]">
                      {data.app_name}
                    </span>
                  </div>
                </div>
              )}

              {/* Apple tip */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {t('booking.wizard.app.appleTip', 'Apple requires no transparency in icons. Rounded corners are added automatically by the OS.')}
                </p>
              </div>
            </div>

            {/* App Description */}
            <div className="space-y-2">
              <Label>{t('booking.wizard.app.descriptionLabel', 'App Store Description')}</Label>
              <Textarea
                value={data.app_description}
                onChange={(e) => update('app_description', e.target.value.slice(0, 170))}
                placeholder={t('booking.wizard.app.descriptionPlaceholder', 'A short description of your app for the App Store')}
                maxLength={170}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {data.app_description.length}/170
              </p>
            </div>

            {/* Auto-generated Bundle ID */}
            {data.tenant_slug && (
              <div className="space-y-2">
                <Label>{t('booking.wizard.app.bundleId', 'Bundle ID')}</Label>
                <Input
                  value={`com.bookivo.${data.tenant_slug}`}
                  readOnly
                  className="font-mono text-sm bg-muted"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  {t('booking.wizard.app.bundleIdHint', 'Auto-generated from your URL slug')}
                </p>
              </div>
            )}
            {/* App Keywords */}
            <div className="space-y-2">
              <Label>{t('booking.wizard.app.keywordsLabel', 'Keywords')}</Label>
              <Input
                value={data.app_keywords}
                onChange={(e) => update('app_keywords', e.target.value)}
                placeholder={t('booking.wizard.app.keywordsPlaceholder', 'wedding, events, booking (comma-separated)')}
              />
              <p className="text-xs text-muted-foreground">
                {t('booking.wizard.app.keywordsHint', 'Comma-separated keywords for App Store optimization')}
              </p>
            </div>

            {/* Support Email */}
            <div className="space-y-2">
              <Label>{t('booking.wizard.app.supportEmailLabel', 'Support Email')}</Label>
              <Input
                type="email"
                value={data.app_support_email}
                onChange={(e) => update('app_support_email', e.target.value)}
                placeholder="support@yourbusiness.com"
              />
            </div>

            {/* Privacy Policy URL */}
            <div className="space-y-2">
              <Label>{t('booking.wizard.app.privacyUrlLabel', 'Privacy Policy URL')}</Label>
              <Input
                type="url"
                value={data.app_privacy_url}
                onChange={(e) => update('app_privacy_url', e.target.value)}
                placeholder="https://yourbusiness.com/privacy"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {t('booking.wizard.app.privacyUrlHint', 'Required by both Apple and Google for store submission')}
              </p>
            </div>

            {/* Version Info (read-only) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('booking.wizard.app.versionLabel', 'Version')}</Label>
                <Input value={settings?.app_version ?? '1.0.0'} readOnly className="bg-muted font-mono text-sm" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t('booking.wizard.app.buildLabel', 'Build')}</Label>
                <Input value={String(settings?.app_build_number ?? 1)} readOnly className="bg-muted font-mono text-sm" dir="ltr" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Go Live */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Rocket className="h-5 w-5" />
              {t('booking.wizard.goLive.title')}
            </CardTitle>
            <CardDescription>{t('booking.wizard.goLive.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t('booking.wizard.goLive.tenantSlug')}</Label>
              <div className="relative">
                <Input
                  value={data.tenant_slug}
                  onChange={(e) => update('tenant_slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-marketplace"
                  dir="ltr"
                  className="pe-10"
                />
                {data.tenant_slug && data.tenant_slug.length >= 3 && (
                  <div className="absolute end-3 top-1/2 -translate-y-1/2">
                    {slugChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : slugUnavailable ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              {data.tenant_slug && data.tenant_slug.length >= 3 && isReservedSlug && (
                <p className="text-xs text-destructive">{t('booking.wizard.goLive.slugReserved', 'This slug is reserved')}</p>
              )}
              {data.tenant_slug && data.tenant_slug.length >= 3 && slugTaken && !isReservedSlug && (
                <p className="text-xs text-destructive">{t('booking.wizard.goLive.slugTaken', 'This slug is already taken')}</p>
              )}
              {data.tenant_slug && data.tenant_slug.length >= 3 && !slugUnavailable && !slugChecking && (
                <p className="text-xs text-muted-foreground">{t('booking.wizard.goLive.slugHint', { slug: data.tenant_slug })}</p>
              )}
              {data.tenant_slug && data.tenant_slug.length < 3 && (
                <p className="text-xs text-muted-foreground">{t('booking.wizard.goLive.slugMinLength', 'Slug must be at least 3 characters')}</p>
              )}
            </div>

            {/* Pre-launch Checklist */}
            <div className="space-y-3">
              <Label className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t('booking.wizard.checklist.title', 'Pre-launch Checklist')}
              </Label>
              <div className="space-y-2 rounded-lg border border-border p-4">
                {checklistItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                    </div>
                    <Badge variant={item.done ? 'default' : 'secondary'} className="text-xs">
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-medium">{t('booking.wizard.goLive.distribution')}</Label>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{t('booking.wizard.goLive.pwaDefault')}</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{t('booking.wizard.goLive.containerApp')}</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{t('booking.wizard.goLive.enterpriseApp')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('common.back')}
        </Button>

        <div className="flex items-center gap-2">
          {step === totalSteps - 1 ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={upsertSettings.isPending}
              >
                {t('booking.wizard.goLive.saveDraft')}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={!canProceed() || upsertSettings.isPending}
              >
                <Check className="h-4 w-4 me-2" />
                {t('booking.wizard.goLive.launch')}
              </Button>
            </>
          ) : (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
              {t('common.next')}
              <ArrowRight className="h-4 w-4 ms-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
