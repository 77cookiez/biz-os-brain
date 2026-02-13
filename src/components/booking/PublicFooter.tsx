import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Shield, ExternalLink } from 'lucide-react';

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
    <footer
      className="border-t border-border bg-card mt-12"
      style={primaryColor ? { borderTopColor: `${primaryColor}25` } : {}}
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Brand */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{workspaceName}</h3>
            <p className="text-xs text-muted-foreground">
              {t('booking.public.footer.poweredBy')}
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            {(contactEmail || cleanWhatsapp) && (
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('booking.wizard.policies.contactEmail').replace('Contact Email', 'Contact')}
              </h4>
            )}
            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-sm text-foreground hover:underline">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {contactEmail}
              </a>
            )}
            {cleanWhatsapp && (
              <a
                href={`https://wa.me/${cleanWhatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-foreground hover:underline"
              >
                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                WhatsApp
              </a>
            )}
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Link
              to={`/v/${tenantSlug}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('booking.public.footer.vendorLogin')}
            </Link>
            {privacyUrl && (
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                {t('booking.public.footer.privacy')}
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {year} {workspaceName}. {t('booking.public.footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
