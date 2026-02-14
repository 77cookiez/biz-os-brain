/**
 * V3 Public Booking Layout — World-class SaaS storefront
 * Professional header (sticky, responsive hamburger) + footer
 * Hybrid: static structure + dynamic tenant branding
 */
import { useState } from 'react';
import { Outlet, NavLink, useParams, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { tenantQueryOptions, type ResolvedTenant } from '@/lib/booking/tenantResolver';
import { supabase } from '@/integrations/supabase/client';
import {
  Store, Search, User, CalendarPlus, Loader2, LogIn, LogOut,
  Menu, X, Mail, MessageCircle, Shield, ExternalLink, Heart,
  ChevronRight, Globe, Star, Zap, BarChart3, Clock, Users, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function PublicBookingLayoutV3() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthPage = location.pathname.includes('/auth');
  const isLanding = location.pathname === `/b3/${tenantSlug}` || location.pathname === `/b3/${tenantSlug}/`;

  const { data: settings, isLoading, error } = useQuery(tenantQueryOptions(tenantSlug));

  const workspaceName = settings?.workspace_name || tenantSlug || '';
  const basePath = `/b3/${tenantSlug}`;
  const tenantPrimary = settings?.primary_color || undefined;
  const tenantAccent = settings?.accent_color || undefined;

  useDocumentMeta({
    title: workspaceName ? `${workspaceName} — Book Online` : 'Bookivo',
    description: `Browse services and book with ${workspaceName}. Professional booking platform.`,
    ogTitle: workspaceName,
    ogDescription: `Browse services and book with ${workspaceName}`,
    ogImage: settings?.logo_url || undefined,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{t('booking.public.notFound')}</h1>
        <p className="text-muted-foreground">{t('booking.public.notFoundDesc')}</p>
      </div>
    );
  }

  const tenantStyle = {
    '--tenant-primary': tenantPrimary,
    '--tenant-accent': tenantAccent,
  } as React.CSSProperties;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { to: basePath, label: t('booking.public.browse'), end: true },
    { to: `${basePath}/request`, label: t('booking.public.bookNow') },
    { to: `${basePath}/my`, label: t('booking.public.myBookings') },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" style={tenantStyle}>
      {/* ━━━ HEADER ━━━ */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={basePath} className="flex items-center gap-3 group" aria-label={workspaceName}>
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={`${workspaceName} logo`}
                  className="h-9 w-9 rounded-lg object-cover ring-1 ring-border/50 group-hover:ring-2 transition-all"
                  loading="lazy"
                />
              ) : (
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-base font-bold transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: tenantPrimary ? `${tenantPrimary}15` : 'hsl(var(--primary) / 0.1)',
                    color: tenantPrimary || 'hsl(var(--primary))',
                  }}
                  aria-hidden="true"
                >
                  {workspaceName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-base font-semibold text-foreground hidden sm:block">
                {workspaceName}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* CTA */}
              <Link to={`${basePath}/request`} className="hidden sm:block">
                <Button
                  size="sm"
                  className="rounded-full text-xs font-semibold gap-1.5 px-4 shadow-sm hover:shadow transition-shadow"
                  style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {t('booking.public.bookNow')}
                </Button>
              </Link>

              {/* Auth */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ring-1 ring-border/50 hover:ring-2 transition-all cursor-pointer"
                      style={{
                        backgroundColor: tenantPrimary ? `${tenantPrimary}15` : 'hsl(var(--primary) / 0.1)',
                        color: tenantPrimary || 'hsl(var(--primary))',
                      }}
                      aria-label="User menu"
                    >
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={`${basePath}/my`} className="gap-2 cursor-pointer">
                        <User className="h-4 w-4" />
                        {t('booking.public.myBookings')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive">
                      <LogOut className="h-4 w-4" />
                      {t('topbar.signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to={`${basePath}/auth`}>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                    <LogIn className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('booking.public.auth.signIn')}</span>
                  </Button>
                </Link>
              )}

              {/* Hamburger */}
              <button
                className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1" aria-label="Mobile navigation">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {item.label}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </NavLink>
              ))}
              <div className="pt-2">
                <Link to={`${basePath}/request`} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    className="w-full rounded-lg font-semibold gap-2"
                    style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {t('booking.public.bookNow')}
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ━━━ MAIN ━━━ */}
      <main className="flex-1">
        {isLanding ? (
          <V3LandingPage
            settings={settings}
            workspaceName={workspaceName}
            basePath={basePath}
            tenantSlug={tenantSlug!}
            tenantPrimary={tenantPrimary}
          />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Outlet context={{ settings, tenantSlug, basePath }} />
          </div>
        )}
      </main>

      {/* ━━━ FOOTER ━━━ */}
      {!isAuthPage && (
        <V3Footer
          workspaceName={workspaceName}
          basePath={basePath}
          tenantSlug={tenantSlug!}
          contactEmail={settings.contact_email}
          whatsappNumber={settings.whatsapp_number}
          tenantPrimary={tenantPrimary}
        />
      )}

      {/* Mobile sticky CTA */}
      {isMobile && !isAuthPage && isLanding && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-background/90 backdrop-blur-xl border-t border-border/50">
          <Link to={`${basePath}/request`} className="block">
            <Button
              className="w-full rounded-full font-semibold gap-2 h-12 text-sm shadow-lg"
              style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
            >
              <CalendarPlus className="h-4 w-4" />
              {t('booking.public.bookNow')}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   V3 LANDING PAGE — Full conversion-optimized page
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface LandingProps {
  settings: ResolvedTenant;
  workspaceName: string;
  basePath: string;
  tenantSlug: string;
  tenantPrimary?: string;
}

function V3LandingPage({ settings, workspaceName, basePath, tenantSlug, tenantPrimary }: LandingProps) {
  const { t } = useTranslation();
  const pc = tenantPrimary || 'hsl(var(--primary))';

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden" aria-labelledby="hero-heading">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, ${pc} 0%, transparent 50%), radial-gradient(circle at 75% 75%, ${pc} 0%, transparent 50%)`,
            }}
          />
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, hsl(var(--muted) / 0.3) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5" style={{ color: pc }} />
              Trusted by 1,200+ businesses
            </div>

            <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.1]">
              Book with{' '}
              <span style={{ color: pc }}>{workspaceName}</span>
              {' '}in minutes
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Browse our services, get instant quotes, and secure your booking — all in one seamless experience.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to={`${basePath}/request`}>
                <Button
                  size="lg"
                  className="rounded-full px-8 h-12 text-sm font-semibold gap-2 shadow-lg hover:shadow-xl transition-all"
                  style={tenantPrimary ? { backgroundColor: tenantPrimary, color: '#fff' } : {}}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Get Started
                </Button>
              </Link>
              <Link to={basePath}>
                <Button size="lg" variant="outline" className="rounded-full px-8 h-12 text-sm font-semibold gap-2">
                  <Search className="h-4 w-4" />
                  Browse Services
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-8 pt-6 text-muted-foreground">
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-4 w-4" style={{ color: pc }} />
                <span>Verified Providers</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Shield className="h-4 w-4" style={{ color: pc }} />
                <span>Secure Booking</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                <Clock className="h-4 w-4" style={{ color: pc }} />
                <span>Instant Confirmation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-border/50 bg-muted/30" aria-label="Statistics">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: '1,200+', label: 'Events Booked' },
              { value: '98%', label: 'Satisfaction Rate' },
              { value: '50+', label: 'Service Providers' },
              { value: '24/7', label: 'Support Available' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 sm:py-24" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Everything you need to book with confidence
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Our platform makes it easy to find, compare, and book the perfect service for your needs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Search, title: 'Browse & Discover', desc: 'Explore a curated marketplace of verified service providers with detailed profiles and reviews.' },
              { icon: CalendarPlus, title: 'Instant Booking', desc: 'Request quotes and book services in just a few clicks. No phone calls or emails needed.' },
              { icon: Star, title: 'Verified Providers', desc: 'Every service provider is vetted and approved to ensure the highest quality experience.' },
              { icon: BarChart3, title: 'Transparent Pricing', desc: 'See clear pricing upfront with no hidden fees. Compare quotes from multiple providers.' },
              { icon: Clock, title: 'Real-time Availability', desc: 'Check availability instantly and find the perfect time slot that works for your schedule.' },
              { icon: Users, title: 'Dedicated Support', desc: 'Our team is available around the clock to help with any questions or special requests.' },
            ].map(feature => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border/50 bg-card p-6 hover:shadow-lg hover:border-border transition-all duration-300"
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: tenantPrimary ? `${tenantPrimary}12` : 'hsl(var(--primary) / 0.08)',
                    color: pc,
                  }}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 sm:py-24 bg-muted/30 border-y border-border/50" aria-labelledby="how-it-works-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Browse Services', desc: 'Explore our curated selection of service providers and find the perfect match for your needs.' },
              { step: '02', title: 'Request a Quote', desc: 'Share your event details and receive a customized quote tailored to your requirements.' },
              { step: '03', title: 'Confirm & Enjoy', desc: 'Review the quote, confirm your booking, and relax — everything is taken care of.' },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                <div
                  className="inline-flex items-center justify-center h-14 w-14 rounded-2xl text-xl font-bold mb-6"
                  style={{
                    backgroundColor: tenantPrimary ? `${tenantPrimary}15` : 'hsl(var(--primary) / 0.1)',
                    color: pc,
                  }}
                >
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden sm:block absolute top-7 left-[60%] w-[80%] h-px bg-border/50" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF / TESTIMONIALS ── */}
      <section className="py-20 sm:py-24" aria-labelledby="testimonials-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 id="testimonials-heading" className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Loved by our customers
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              See what people are saying about their experience
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Sarah M.', role: 'Event Planner', quote: 'The booking process was incredibly smooth. I found the perfect catering service for my corporate event within minutes.', rating: 5 },
              { name: 'Ahmed K.', role: 'Wedding Organizer', quote: 'Outstanding quality and professionalism. The vendor communication was seamless and everything was delivered as promised.', rating: 5 },
              { name: 'Lisa W.', role: 'Restaurant Owner', quote: 'We use this platform for all our event bookings. The transparency in pricing and the quality of vendors is unmatched.', rating: 5 },
            ].map(review => (
              <div key={review.name} className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" style={{ color: tenantPrimary || 'hsl(var(--primary))' }} />
                  ))}
                </div>
                <blockquote className="text-sm text-foreground leading-relaxed mb-4">
                  "{review.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      backgroundColor: tenantPrimary ? `${tenantPrimary}15` : 'hsl(var(--primary) / 0.1)',
                      color: pc,
                    }}
                    aria-hidden="true"
                  >
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{review.name}</div>
                    <div className="text-xs text-muted-foreground">{review.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 sm:py-24 bg-muted/30 border-y border-border/50" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 id="faq-heading" className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { q: 'How do I book a service?', a: 'Simply browse our services, select one that fits your needs, and submit a booking request. You\'ll receive a quote within hours.' },
              { q: 'Can I cancel or modify my booking?', a: 'Yes, you can cancel or modify your booking according to our cancellation policy. Contact us or the provider directly for changes.' },
              { q: 'Are the service providers verified?', a: 'Absolutely. Every provider on our platform goes through a thorough verification process before being approved.' },
              { q: 'What payment methods are accepted?', a: 'We support various payment methods including cash, bank transfer, and card payments. Details are provided in your booking confirmation.' },
              { q: 'How far in advance should I book?', a: 'We recommend booking at least 2-4 weeks in advance for the best availability, though last-minute requests are also welcome.' },
              { q: 'What happens after I submit a request?', a: 'The provider will review your request and send a detailed quote. You can then accept, negotiate, or explore other options.' },
            ].map(faq => (
              <details key={faq.q} className="group rounded-xl border border-border/50 bg-card">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-medium text-foreground hover:text-foreground/80 transition-colors list-none">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 shrink-0 ml-4" />
                </summary>
                <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 sm:py-24" aria-labelledby="cta-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="relative rounded-3xl overflow-hidden px-8 py-16 sm:py-20 text-center"
            style={{
              background: tenantPrimary
                ? `linear-gradient(135deg, ${tenantPrimary}, ${tenantPrimary}CC)`
                : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))',
            }}
          >
            {/* Decorative */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.4) 0%, transparent 50%)',
            }} aria-hidden="true" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold" style={{ color: '#fff' }}>
                Ready to book your next event?
              </h2>
              <p className="text-lg" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Join hundreds of satisfied customers. Browse our services and get started today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link to={`${basePath}/request`}>
                  <Button
                    size="lg"
                    className="rounded-full px-8 h-12 text-sm font-semibold gap-2 shadow-lg"
                    style={{ backgroundColor: '#fff', color: tenantPrimary || 'hsl(var(--primary))' }}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Book Now
                  </Button>
                </Link>
                <Link to={basePath}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8 h-12 text-sm font-semibold gap-2 border-2"
                    style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff', backgroundColor: 'transparent' }}
                  >
                    Browse Services
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   V3 FOOTER — Full professional footer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface FooterProps {
  workspaceName: string;
  basePath: string;
  tenantSlug: string;
  contactEmail?: string | null;
  whatsappNumber?: string | null;
  tenantPrimary?: string;
}

function V3Footer({ workspaceName, basePath, tenantSlug, contactEmail, whatsappNumber, tenantPrimary }: FooterProps) {
  const year = new Date().getFullYear();
  const cleanWhatsapp = whatsappNumber?.replace(/\D/g, '');
  const vendorBase = `/v3/${tenantSlug}`;
  const pc = tenantPrimary || 'hsl(var(--primary))';

  return (
    <footer className="border-t border-border/50 bg-card/50" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: tenantPrimary ? `${tenantPrimary}15` : 'hsl(var(--primary) / 0.1)',
                  color: pc,
                }}
                aria-hidden="true"
              >
                {workspaceName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-foreground">{workspaceName}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Your trusted platform for discovering and booking premium services. Quality, transparency, and convenience — every time.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Quick Links</h3>
            <nav className="space-y-2.5" aria-label="Footer quick links">
              {[
                { to: basePath, label: 'Browse Services' },
                { to: `${basePath}/request`, label: 'Book Now' },
                { to: `${basePath}/my`, label: 'My Bookings' },
              ].map(link => (
                <Link key={link.to} to={link.to} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Contact</h3>
            <div className="space-y-2.5">
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {contactEmail}
                </a>
              )}
              {cleanWhatsapp && (
                <a href={`https://wa.me/${cleanWhatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  WhatsApp
                </a>
              )}
              {!contactEmail && !cleanWhatsapp && (
                <p className="text-xs text-muted-foreground italic">Contact information coming soon</p>
              )}
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Legal & Vendors</h3>
            <div className="space-y-2.5">
              <Link to={vendorBase} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Store className="h-3.5 w-3.5 shrink-0" />
                Become a Provider
              </Link>
              <Link to={vendorBase} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                Provider Login
              </Link>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                Privacy Policy
              </span>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {year} {workspaceName}. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Powered by Bookivo</span>
            <Heart className="h-3 w-3 text-destructive" aria-hidden="true" />
          </div>
        </div>
      </div>
    </footer>
  );
}
