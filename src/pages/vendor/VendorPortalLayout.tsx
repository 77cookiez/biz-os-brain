import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, MessageSquare, Calendar, Package, Loader2,
  ExternalLink, Sparkles, X, Send, CheckCircle2, Trash2, Edit3,
  Store, Mail, Phone, User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiagnosticsPanel } from '@/components/booking/DiagnosticsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// ── AI Chat types ──
interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: AiSuggestion[];
}
interface AiSuggestion {
  type: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  suggestedPrice: number;
  currency: string;
  duration: number;
  addons: { name_en: string; name_ar: string; price: number }[];
  terms: string;
}

// ── Vendor Registration Form ──
function VendorRegistrationForm({
  workspaceId,
  tenantSlug,
  tenantPrimary,
  logoUrl,
}: {
  workspaceId: string;
  tenantSlug: string;
  tenantPrimary?: string;
  logoUrl?: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!displayName.trim()) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('register-vendor', {
        body: {
          tenant_slug: tenantSlug,
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          email: email.trim() || null,
          whatsapp: whatsapp.trim() || null,
          source_lang: 'en',
        },
      });

      if (res.error) throw res.error;
      const data = res.data;
      if (data?.error === 'already_registered') {
        toast.info(t('booking.vendor.alreadyRegistered'));
      } else if (data?.success) {
        toast.success(t('booking.vendor.registrationSuccess'));
        queryClient.invalidateQueries({ queryKey: ['vendor-portal', tenantSlug] });
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(t('booking.vendor.registrationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover mx-auto" />
          ) : (
            <div
              className="h-14 w-14 rounded-xl mx-auto flex items-center justify-center text-xl font-bold"
              style={{
                backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                color: tenantPrimary || 'hsl(var(--primary))',
              }}
            >
              <Store className="h-7 w-7" />
            </div>
          )}
          <CardTitle className="text-xl">{t('booking.vendor.joinAsVendor')}</CardTitle>
          <CardDescription>{t('booking.vendor.joinAsVendorDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('booking.vendor.businessName')} *</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('booking.vendor.businessNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('booking.vendor.bioLabel')}</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('booking.vendor.bioPlaceholder')}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('booking.public.auth.email')}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+971501234567"
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!displayName.trim() || submitting}
            style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Store className="h-4 w-4 mr-2" />}
            {t('booking.vendor.submitRegistration')}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {t('booking.vendor.pendingApprovalNote')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Pending Approval Screen ──
function PendingApprovalScreen({ tenantPrimary }: { tenantPrimary?: string }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-6 space-y-4">
          <div
            className="h-16 w-16 rounded-full mx-auto flex items-center justify-center"
            style={{
              backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
              color: tenantPrimary || 'hsl(var(--primary))',
            }}
          >
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('booking.vendor.pendingTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('booking.vendor.pendingDesc')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── AI Assist Modal ──
function AiAssistModal({
  open,
  onOpenChange,
  tenantPrimary,
  vendorName,
  tenantSlug,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantPrimary?: string;
  vendorName: string | null;
  tenantSlug: string;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('vendor-ai-assist', {
        body: {
          prompt: userMsg,
          tenant_slug: tenantSlug,
          context: {
            vendorName: vendorName || 'Vendor',
            existingServices: [],
            locale: 'en',
          },
        },
      });

      if (res.error) throw res.error;
      const data = res.data;

      if (data?.suggestions) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: t('booking.vendor.aiSuggestionsReady'),
            suggestions: data.suggestions,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data?.message || 'No response' },
        ]);
      }
    } catch (err) {
      console.error('AI error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('booking.vendor.aiError') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={tenantPrimary ? { color: tenantPrimary } : {}} />
            {t('booking.vendor.aiAssistTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('booking.vendor.aiAssistWorkflow')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('booking.vendor.aiEmptyHint')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  t('booking.vendor.aiSuggestion1'),
                  t('booking.vendor.aiSuggestion2'),
                  t('booking.vendor.aiSuggestion3'),
                ].map((s) => (
                  <button
                    key={s}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    onClick={() => { setInput(s); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                  style={msg.role === 'user' && tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.suggestions?.map((s, si) => (
                    <Card key={si} className="mt-3 border-border">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{s.type}</Badge>
                          <span className="text-sm font-semibold">{s.currency} {s.suggestedPrice}</span>
                        </div>
                        <h4 className="font-medium text-sm">{s.title_en}</h4>
                        <p className="text-xs text-muted-foreground">{s.title_ar}</p>
                        <p className="text-xs">{s.description_en}</p>
                        {s.duration > 0 && (
                          <p className="text-xs text-muted-foreground">{s.duration} min</p>
                        )}
                        {s.addons?.length > 0 && (
                          <div className="text-xs space-y-1">
                            <p className="font-medium">Add-ons:</p>
                            {s.addons.map((a, ai) => (
                              <p key={ai}>• {a.name_en} ({a.name_ar}) — {s.currency} {a.price}</p>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="default" className="text-xs gap-1" disabled>
                            <CheckCircle2 className="h-3 w-3" />
                            {t('booking.vendor.aiApply')}
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs gap-1" disabled>
                            <Edit3 className="h-3 w-3" />
                            {t('common.edit')}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs gap-1" disabled>
                            <Trash2 className="h-3 w-3" />
                            {t('booking.vendor.aiDiscard')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('brainPage.thinking')}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 pb-4 pt-2 border-t border-border flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('booking.vendor.aiInputPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Layout ──
export default function VendorPortalLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-portal', tenantSlug, user?.id],
    queryFn: async () => {
      if (!tenantSlug || !user) return null;
      const { data: settings } = await supabase
        .from('booking_settings')
        .select('workspace_id, primary_color, accent_color, logo_url')
        .eq('tenant_slug', tenantSlug)
        .eq('is_live', true)
        .maybeSingle();
      if (!settings) return null;

      const { data: vendor } = await supabase
        .from('booking_vendors')
        .select('id, status, booking_vendor_profiles(display_name)')
        .eq('workspace_id', settings.workspace_id)
        .eq('owner_user_id', user.id)
        .maybeSingle();

      const vendorProfile = vendor
        ? Array.isArray((vendor as any).booking_vendor_profiles)
          ? (vendor as any).booking_vendor_profiles[0]
          : (vendor as any).booking_vendor_profiles
        : null;

      return {
        workspaceId: settings.workspace_id,
        vendor: vendor ? { id: vendor.id, status: vendor.status } : null,
        vendorName: vendorProfile?.display_name || null,
        primaryColor: settings.primary_color,
        accentColor: settings.accent_color,
        logoUrl: settings.logo_url,
      };
    },
    enabled: !!tenantSlug && !!user,
  });

  // Not logged in → redirect to tenant-scoped auth
  if (!user) {
    return <Navigate to={`/b/${tenantSlug}/auth?redirect=/v/${tenantSlug}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tenantPrimary = data?.primaryColor || undefined;

  // No vendor record → show registration form
  if (!data?.vendor) {
    return (
      <VendorRegistrationForm
        workspaceId={data?.workspaceId || ''}
        tenantSlug={tenantSlug || ''}
        tenantPrimary={tenantPrimary}
        logoUrl={data?.logoUrl}
      />
    );
  }

  // Vendor pending → show pending screen
  if (data.vendor.status === 'pending') {
    return <PendingApprovalScreen tenantPrimary={tenantPrimary} />;
  }

  // Vendor suspended
  if (data.vendor.status === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-xl font-semibold text-foreground">{t('booking.vendor.suspended')}</h1>
        <p className="text-muted-foreground">{t('booking.vendor.suspendedDesc')}</p>
      </div>
    );
  }

  const basePath = `/v/${tenantSlug}`;
  const tabs = [
    { labelKey: 'booking.vendor.dashboard', icon: LayoutDashboard, path: basePath },
    { labelKey: 'booking.services.title', icon: Package, path: `${basePath}/services` },
    { labelKey: 'booking.vendor.quotes', icon: MessageSquare, path: `${basePath}/quotes` },
    { labelKey: 'booking.vendor.calendar', icon: Calendar, path: `${basePath}/calendar` },
  ];

  return (
    <div className="min-h-screen bg-background" style={tenantPrimary ? { '--tenant-primary': tenantPrimary } as React.CSSProperties : {}}>
      <header className="border-b border-border bg-card px-4 py-3" style={tenantPrimary ? { borderBottomColor: `${tenantPrimary}30` } : {}}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: tenantPrimary ? `${tenantPrimary}18` : 'hsl(var(--primary) / 0.12)',
                  color: tenantPrimary || 'hsl(var(--primary))',
                }}
              >
                V
              </div>
            )}
            <div className="min-w-0">
              <span className="text-lg font-semibold text-foreground block truncate">{t('booking.vendor.portalTitle')}</span>
              {data.vendorName && (
                <span className="text-xs text-muted-foreground truncate block">{data.vendorName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setAiModalOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('booking.vendor.aiAssist')}</span>
            </Button>
            <Link to={`/b/${tenantSlug}`} target="_blank">
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('booking.vendor.viewStore')}</span>
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-destructive hover:text-destructive"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = `/b/${tenantSlug}/auth`;
              }}
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('booking.vendor.signOut')}</span>
            </Button>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-card px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === basePath}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
              style={({ isActive }) => isActive && tenantPrimary ? { color: tenantPrimary, borderBottomColor: tenantPrimary } : {}}
            >
              <tab.icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet context={{ workspaceId: data.workspaceId, vendorId: data.vendor.id, tenantSlug }} />
      </main>

      <AiAssistModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        tenantPrimary={tenantPrimary}
        vendorName={data.vendorName}
        tenantSlug={tenantSlug || ''}
      />

      <DiagnosticsPanel tenantSlug={tenantSlug || ''} workspaceId={data.workspaceId} />
    </div>
  );
}
