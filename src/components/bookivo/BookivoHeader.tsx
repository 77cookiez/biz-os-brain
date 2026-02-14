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
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <span className="text-xl font-bold text-primary">Bookivo</span>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth?mode=login">
            <Button variant="ghost" size="sm">{t('auth.signIn')}</Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm">{t('bookivo.landing.hero.cta', 'Start Free')}</Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 pb-4 space-y-3">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-muted-foreground hover:text-foreground">
              {l.label}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
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
