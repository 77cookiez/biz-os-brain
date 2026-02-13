import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import {
  Globe, Languages, Banknote, Bot, Building2, Shield, Calendar, Lock,
  Smartphone, ArrowRight, Check, Star, Zap, Palette,
} from 'lucide-react';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

const COLOR_PRESETS = [
  { name: 'Modern Blue', primary: '#3B82F6', accent: '#F59E0B' },
  { name: 'Warm Coral', primary: '#F43F5E', accent: '#A78BFA' },
  { name: 'Elegant Gold', primary: '#D97706', accent: '#1E293B' },
  { name: 'Fresh Green', primary: '#10B981', accent: '#6366F1' },
  { name: 'Luxury Dark', primary: '#1E293B', accent: '#F59E0B' },
];

export default function BookivoPage() {
  const { t } = useTranslation();

  useDocumentMeta({
    title: 'Bookivo — The Intelligent Booking OS',
    description: 'Bookivo is an AI-powered Booking Operating System built for modern service businesses worldwide.',
  });

  const features = [
    { icon: Globe, title: t('booking.brand.globalReady', 'Global-ready architecture'), description: t('bookivo.landing.feature1Desc', 'Built to work anywhere in the world with localized formatting and compliance.') },
    { icon: Languages, title: t('booking.brand.multiLanguage', 'Multi-language by design'), description: t('bookivo.landing.feature2Desc', "Speak your customers' language automatically with our ULL projection engine.") },
    { icon: Banknote, title: t('bookivo.landing.multiCurrency', 'Multi-currency support'), description: t('bookivo.landing.feature3Desc', 'Accept payments in USD, EUR, GBP, AED, and more with dynamic currency handling.') },
    { icon: Bot, title: t('booking.brand.aiPowered', 'AI-driven workflows'), description: t('bookivo.landing.feature4Desc', 'Automate scheduling, quotes, and customer communication with intelligent agents.') },
    { icon: Building2, title: t('booking.brand.whiteLabel', 'White-label marketplace capability'), description: t('bookivo.landing.feature5Desc', 'Your brand, your domain, your rules. Fully customizable tenant experience.') },
    { icon: Shield, title: t('bookivo.landing.secureTenant', 'Secure multi-tenant infrastructure'), description: t('bookivo.landing.feature6Desc', 'Enterprise-grade security with strict data isolation and access controls.') },
    { icon: Calendar, title: t('bookivo.landing.freeTrial', '14-day free trial'), description: t('bookivo.landing.feature7Desc', 'Start with a full-featured trial. No credit card required to get started.') },
    { icon: Lock, title: t('bookivo.landing.privacyFirst', 'Privacy-first'), description: t('bookivo.landing.feature8Desc', 'Your data belongs to you. We never resell or share your business intelligence.') },
  ];

  const steps = [
    { num: '01', title: t('bookivo.landing.step1', 'Set Up'), desc: t('bookivo.landing.step1Desc', 'Choose your theme, upload your logo, and configure your brand in minutes.') },
    { num: '02', title: t('bookivo.landing.step2', 'Customize'), desc: t('bookivo.landing.step2Desc', 'Set pricing, policies, currencies, and invite your vendors.') },
    { num: '03', title: t('bookivo.landing.step3', 'Launch'), desc: t('bookivo.landing.step3Desc', 'Go live with one click. Get your own native app pack for iOS & Android.') },
  ];

  const pricing = [
    { name: t('bookivo.landing.priceFree', 'Free Trial'), price: '$0', period: t('bookivo.landing.price14Days', '14 days'), features: [t('bookivo.landing.priceFeature1', 'Full platform access'), t('bookivo.landing.priceFeature2', 'Up to 3 vendors'), t('bookivo.landing.priceFeature3', 'PWA included'), t('bookivo.landing.priceFeature4', 'Multi-language')] },
    { name: t('bookivo.landing.pricePro', 'Pro'), price: '$49', period: t('bookivo.landing.pricePerMonth', '/month'), features: [t('bookivo.landing.priceProF1', 'Unlimited vendors'), t('bookivo.landing.priceProF2', 'Native App Pack'), t('bookivo.landing.priceProF3', 'AI Booking Assistant'), t('bookivo.landing.priceProF4', 'Priority support')], popular: true },
    { name: t('bookivo.landing.priceEnterprise', 'Enterprise'), price: t('bookivo.landing.priceCustom', 'Custom'), period: '', features: [t('bookivo.landing.priceEntF1', 'Dedicated app in stores'), t('bookivo.landing.priceEntF2', 'Custom domain'), t('bookivo.landing.priceEntF3', 'SLA & onboarding'), t('bookivo.landing.priceEntF4', 'White-label branding')] },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">Bookivo</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth?mode=signin">
              <Button variant="ghost">{t('auth.signIn')}</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button>{t('bookivo.landing.startTrial', 'Start Free Trial')}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-24 sm:py-36 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
          <div className="absolute top-1/4 start-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-1/4 end-1/4 w-72 h-72 rounded-full bg-primary/8 blur-3xl" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card/50 backdrop-blur text-sm text-muted-foreground mb-8">
              <Zap className="h-4 w-4 text-primary" />
              {t('bookivo.landing.badge', 'AI-Powered Booking OS')}
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
              {t('booking.brand.tagline', 'The Intelligent Booking OS for Service Businesses')}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
              {t('booking.brand.positioning', 'Bookivo is an AI-powered Booking Operating System built for modern service businesses worldwide.')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="h-14 px-10 text-lg gap-2">
                  {t('bookivo.landing.startTrial', 'Start Free Trial')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              {t('bookivo.landing.trialNote', '14-day free trial • No credit card required')}
            </p>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-8 border-y border-border bg-card/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium text-primary">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span>{t('bookivo.landing.socialProof', 'Trusted by growing service businesses worldwide')}</span>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-primary text-primary" />
              ))}
              <span className="ms-1">5.0</span>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {t('bookivo.landing.howTitle', 'Go Live in 3 Simple Steps')}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('bookivo.landing.howSubtitle', 'From setup to launch in under 10 minutes. No coding required.')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step, idx) => (
                <div key={idx} className="relative group">
                  <div className="p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all">
                    <div className="text-5xl font-bold text-primary/20 mb-4">{step.num}</div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.desc}</p>
                  </div>
                  {idx < 2 && (
                    <div className="hidden md:block absolute top-1/2 -end-4 text-muted-foreground/30">
                      <ArrowRight className="h-6 w-6" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-card/30 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {t('bookivo.landing.featuresTitle', 'Everything You Need to Run Your Booking Business')}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="border-border hover:border-primary/30 transition-all group">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* App Builder Showcase */}
        <section className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-6">
                  <Smartphone className="h-4 w-4" />
                  {t('bookivo.landing.appBuilderBadge', 'Native App Builder')}
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  {t('bookivo.landing.appBuilderTitle', 'Your Brand, Your App')}
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  {t('bookivo.landing.appBuilderDesc', 'Configure your brand identity, upload your logo, and download a ready-to-publish app pack for Apple App Store and Google Play.')}
                </p>
                <ul className="space-y-3">
                  {[
                    t('bookivo.landing.appF1', 'Custom app icon & splash screen'),
                    t('bookivo.landing.appF2', 'Pre-configured Capacitor project'),
                    t('bookivo.landing.appF3', 'Step-by-step publishing guides'),
                    t('bookivo.landing.appF4', 'Works on iOS & Android'),
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-muted-foreground">
                      <Check className="h-5 w-5 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                {/* Phone Mockup */}
                <div className="relative">
                  <div className="w-64 h-[480px] rounded-[2.5rem] border-4 border-border bg-card shadow-2xl overflow-hidden">
                    <div className="h-8 bg-muted flex items-center justify-center">
                      <div className="w-20 h-4 rounded-full bg-border" />
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="h-3 w-24 rounded bg-primary/20" />
                      <div className="grid grid-cols-3 gap-3">
                        {COLOR_PRESETS.slice(0, 6).map((preset, i) => (
                          <div key={i} className="aspect-square rounded-xl flex items-center justify-center" style={{ backgroundColor: preset.primary + '20' }}>
                            <div className="h-6 w-6 rounded-lg" style={{ backgroundColor: preset.primary }} />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-full rounded bg-muted" />
                        <div className="h-2 w-3/4 rounded bg-muted" />
                        <div className="h-2 w-1/2 rounded bg-muted" />
                      </div>
                      <div className="h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Palette className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-8 rounded-lg bg-muted" />
                        <div className="h-8 rounded-lg bg-muted" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-Currency + Multi-Language */}
        <section className="py-20 bg-card/30 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('bookivo.landing.globalTitle', 'Built for Global Businesses')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
              {t('bookivo.landing.globalDesc', 'Support customers in any language and currency from day one.')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <Card className="border-border">
                <CardContent className="p-8 text-center">
                  <Languages className="h-10 w-10 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-3">{t('bookivo.landing.langTitle', '5+ Languages')}</h3>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {['English', 'العربية', 'Français', 'Deutsch', 'Español'].map(lang => (
                      <span key={lang} className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary">{lang}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-8 text-center">
                  <Banknote className="h-10 w-10 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-3">{t('bookivo.landing.currTitle', '11+ Currencies')}</h3>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {['USD', 'EUR', 'GBP', 'AED', 'SAR', 'AUD'].map(cur => (
                      <span key={cur} className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary">{cur}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                {t('bookivo.landing.pricingTitle', 'Simple, Transparent Pricing')}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t('bookivo.landing.pricingSubtitle', 'Start free, upgrade when you grow.')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {pricing.map((tier, idx) => (
                <Card key={idx} className={`relative border-border ${tier.popular ? 'border-primary ring-1 ring-primary' : ''}`}>
                  {tier.popular && (
                    <div className="absolute -top-3 start-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {t('bookivo.landing.popular', 'Most Popular')}
                    </div>
                  )}
                  <CardContent className="p-8">
                    <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{tier.price}</span>
                      <span className="text-muted-foreground">{tier.period}</span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {tier.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link to="/auth?mode=signup">
                      <Button variant={tier.popular ? 'default' : 'outline'} className="w-full">
                        {t('bookivo.landing.startTrial', 'Start Free Trial')}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 sm:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              {t('bookivo.landing.ctaTitle', 'Ready to modernize your booking business?')}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {t('bookivo.landing.ctaDesc', 'Join service businesses worldwide running on Bookivo.')}
            </p>
            <Link to="/auth?mode=signup">
              <Button size="lg" className="h-14 px-10 text-lg gap-2">
                {t('bookivo.landing.startTrial', 'Start Free Trial')}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">Bookivo</span>
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="#" className="hover:text-foreground transition-colors">{t('bookivo.landing.privacy', 'Privacy')}</Link>
            <Link to="#" className="hover:text-foreground transition-colors">{t('bookivo.landing.terms', 'Terms')}</Link>
            <Link to="#" className="hover:text-foreground transition-colors">{t('bookivo.landing.contact', 'Contact')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
