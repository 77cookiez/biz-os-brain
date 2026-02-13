import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Shield, ExternalLink, Store, Heart, FileText } from 'lucide-react';

interface PublicFooterProps {
  tenantSlug: string;
  workspaceName: string;
  contactEmail?: string | null;
  whatsappNumber?: string | null;
  privacyUrl?: string | null;
  primaryColor?: string;
}

export function PublicFooter({
  tenantSlug,
  workspaceName,
  contactEmail,
  whatsappNumber,
  privacyUrl,
  primaryColor,
}: PublicFooterProps) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const cleanWhatsapp = whatsappNumber?.replace(/\D/g, '');

  return (
    <footer className="border-t border-border bg-card mt-12 relative">
      {/* Gradient top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: primaryColor
            ? `linear-gradient(90deg, transparent, ${primaryColor}60, transparent)`
            : 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)',
        }}
      />

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: primaryColor ? `${primaryColor}18` : 'hsl(var(--primary) / 0.12)',
                  color: primaryColor || 'hsl(var(--primary))',
                }}
              >
                {workspaceName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{workspaceName}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('booking.public.footer.brandDesc', { name: workspaceName })}
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t('booking.public.footer.quickLinks')}
            </h4>
            <div className="space-y-2">
              <Link
                to={`/b/${tenantSlug}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('booking.public.browse')}
              </Link>
              <Link
                to={`/b/${tenantSlug}/request`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('booking.public.bookNow')}
              </Link>
              <Link
                to={`/b/${tenantSlug}/my`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('booking.public.myBookings')}
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t('booking.public.footer.contactTitle')}
            </h4>
            <div className="space-y-2">
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {contactEmail}
                </a>
              )}
              {cleanWhatsapp && (
                <a
                  href={`https://wa.me/${cleanWhatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  WhatsApp
                </a>
              )}
              {!contactEmail && !cleanWhatsapp && (
                <p className="text-xs text-muted-foreground italic">
                  {t('booking.public.footer.noContact')}
                </p>
              )}
            </div>
          </div>

          {/* Legal & Vendor */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t('booking.public.footer.legalTitle')}
            </h4>
            <div className="space-y-2">
              {privacyUrl && (
                <a
                  href={privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  {t('booking.public.footer.privacy')}
                </a>
              )}
              <Link
                to={`/v/${tenantSlug}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Store className="h-3.5 w-3.5 shrink-0" />
                {t('booking.public.footer.becomeVendor')}
              </Link>
              <Link
                to={`/v/${tenantSlug}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {t('booking.public.footer.vendorLogin')}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {year} {workspaceName}. {t('booking.public.footer.copyright')}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t('booking.public.footer.poweredBy')}</span>
            <Heart className="h-3 w-3 text-destructive" />
          </div>
        </div>
      </div>
    </footer>
  );
}
