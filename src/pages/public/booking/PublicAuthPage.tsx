import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';

export default function PublicAuthPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Detect basePath from current URL (v2 vs v1)
  const currentPath = window.location.pathname;
  const basePath = currentPath.startsWith('/b2/') ? `/b2/${tenantSlug}` : `/b/${tenantSlug}`;
  const redirect = searchParams.get('redirect') || basePath;

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['public-auth-tenant', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      const { data, error } = await supabase.rpc('get_live_booking_tenant_by_slug', {
        p_slug: tenantSlug,
      });
      if (error) throw error;
      return data as {
        workspace_name: string;
        primary_color: string | null;
        logo_url: string | null;
      } | null;
    },
    enabled: !!tenantSlug,
  });

  if (user) return <Navigate to={redirect} replace />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{t('booking.public.notFound')}</h1>
      </div>
    );
  }

  const pc = settings.primary_color || undefined;
  const workspaceName = settings.workspace_name || tenantSlug;

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(t('booking.public.auth.signInError'));
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${redirect}`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(t('booking.public.auth.signUpError'));
    } else {
      toast.success(t('booking.public.auth.signUpSuccess'));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Tenant branding */}
        <div className="text-center space-y-3">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover mx-auto" />
          ) : (
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl font-bold mx-auto"
              style={{
                backgroundColor: pc ? `${pc}20` : 'hsl(var(--primary) / 0.15)',
                color: pc || 'hsl(var(--primary))',
              }}
            >
              {workspaceName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-semibold text-foreground">{workspaceName}</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t('booking.public.auth.signIn')}</TabsTrigger>
                <TabsTrigger value="signup">{t('booking.public.auth.signUp')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-4">
            {tab === 'signup' && (
              <div>
                <Label>{t('booking.public.auth.fullName')}</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <Label>{t('booking.public.auth.email')}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>{t('booking.public.auth.password')}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={loading || !email || !password}
              onClick={tab === 'signin' ? handleSignIn : handleSignUp}
              style={pc ? { backgroundColor: pc, color: '#fff' } : {}}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tab === 'signin' ? (
                t('booking.public.auth.signIn')
              ) : (
                t('booking.public.auth.signUp')
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {tab === 'signin' ? (
                <button onClick={() => setTab('signup')} className="underline hover:text-foreground">
                  {t('booking.public.auth.orSignUp')}
                </button>
              ) : (
                <button onClick={() => setTab('signin')} className="underline hover:text-foreground">
                  {t('booking.public.auth.orSignIn')}
                </button>
              )}
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {t('booking.public.footer.poweredBy')}
        </p>
      </div>
    </div>
  );
}
