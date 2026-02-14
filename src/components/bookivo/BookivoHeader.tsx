import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function BookivoHeader() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: t('bookivo.landing.nav.features', 'Features'), href: '#features' },
    { label: t('bookivo.landing.nav.pricing', 'Pricing'), href: '#pricing' },
    { label: t('bookivo.landing.nav.faq', 'FAQ'), href: '#faq' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-2xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight text-foreground">Bookivo</span>

        <nav className="hidden md:flex items-center gap-10">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth?mode=login">
            <Button variant="ghost" size="sm" className="text-muted-foreground">{t('auth.signIn')}</Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm">{t('bookivo.landing.hero.cta', 'Start Free')}</Button>
          </Link>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl px-4 pb-4 space-y-2">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-muted-foreground hover:text-foreground">
              {l.label}
            </a>
          ))}
          <div className="flex gap-3 pt-3">
            <Link to="/auth?mode=login" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full">{t('auth.signIn')}</Button>
            </Link>
            <Link to="/auth?mode=signup" className="flex-1">
              <Button size="sm" className="w-full">{t('bookivo.landing.hero.cta', 'Start Free')}</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
