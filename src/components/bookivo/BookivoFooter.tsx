import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function BookivoFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border/50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <span className="text-base font-bold text-primary">Bookivo</span>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
              {t('bookivo.landing.footer.desc', 'The Intelligent Booking OS for modern service businesses.')}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('bookivo.landing.footer.links', 'Quick Links')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{t('bookivo.landing.nav.pricing', 'Pricing')}</a></li>
              <li><Link to="/auth?mode=login" className="hover:text-foreground transition-colors">{t('auth.signIn')}</Link></li>
              <li><Link to="/auth?mode=signup" className="hover:text-foreground transition-colors">{t('auth.signUp')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('bookivo.landing.footer.legal', 'Legal')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="#" className="hover:text-foreground transition-colors">{t('bookivo.landing.footer.privacy', 'Privacy Policy')}</Link></li>
              <li><Link to="#" className="hover:text-foreground transition-colors">{t('bookivo.landing.footer.terms', 'Terms of Service')}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/50 pt-6">
          <span className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Bookivo. {t('bookivo.landing.footer.poweredBy', 'A Product by AiBizOS.')}
          </span>
        </div>
      </div>
    </footer>
  );
}
