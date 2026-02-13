import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Globe, Languages, Banknote, Bot, Building2, Shield, Calendar, Lock } from 'lucide-react';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export default function BookivoPage() {
  const { t } = useTranslation();

  useDocumentMeta({
    title: 'Bookivo — The Intelligent Booking OS',
    description: 'Bookivo is an AI-powered Booking Operating System built for modern service businesses worldwide.',
  });

  const features = [
    {
      icon: Globe,
      title: t('booking.brand.globalReady', 'Global-ready architecture'),
      description: 'Built to work anywhere in the world with localized formatting and compliance.'
    },
    {
      icon: Languages,
      title: t('booking.brand.multiLanguage', 'Multi-language by design'),
      description: 'Speak your customers\' language automatically with our ULL projection engine.'
    },
    {
      icon: Banknote,
      title: 'Multi-currency support',
      description: 'Accept payments in USD, EUR, GBP, AED, and more with dynamic currency handling.'
    },
    {
      icon: Bot,
      title: t('booking.brand.aiPowered', 'AI-driven workflows'),
      description: 'Automate scheduling, quotes, and customer communication with intelligent agents.'
    },
    {
      icon: Building2,
      title: t('booking.brand.whiteLabel', 'White-label marketplace capability'),
      description: 'Your brand, your domain, your rules. Fully customizable tenant experience.'
    },
    {
      icon: Shield,
      title: 'Secure multi-tenant infrastructure',
      description: 'Enterprise-grade security with strict data isolation and access controls.'
    },
    {
      icon: Calendar,
      title: '14-day free trial',
      description: 'Start with a full-featured trial. No credit card required to get started.'
    },
    {
      icon: Lock,
      title: 'Privacy-first',
      description: 'Your data belongs to you. We never resell or share your business intelligence.'
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">Bookivo</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth?mode=signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 sm:py-32 bg-gradient-to-b from-background to-primary/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
              {t('booking.brand.tagline', 'The Intelligent Booking OS for Service Businesses')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
              {t('booking.brand.positioning', 'Bookivo is an AI-powered Booking Operating System built for modern service businesses worldwide.')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="h-12 px-8 text-lg">
                  Start Free Trial
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground mt-4 sm:mt-0">
                14-day free trial • No credit card required
              </p>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="p-6 rounded-2xl border border-border bg-card hover:shadow-lg transition-shadow">
                  <feature.icon className="h-10 w-10 text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to modernize your booking business?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of service businesses running on Bookivo.
            </p>
            <Link to="/auth?mode=signup">
              <Button size="lg" variant="default">
                Get Started for Free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Bookivo. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="#" className="hover:text-foreground">Privacy</Link>
            <Link to="#" className="hover:text-foreground">Terms</Link>
            <Link to="#" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
