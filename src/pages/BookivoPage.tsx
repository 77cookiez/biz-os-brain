import { useTranslation } from 'react-i18next';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import BookivoHeader from '@/components/bookivo/BookivoHeader';
import HeroSection from '@/components/bookivo/HeroSection';
import SocialProofStrip from '@/components/bookivo/SocialProofStrip';
import ProblemSection from '@/components/bookivo/ProblemSection';
import SolutionSection from '@/components/bookivo/SolutionSection';
import AISmartSection from '@/components/bookivo/AISmartSection';
import AiBizOSSection from '@/components/bookivo/AiBizOSSection';
import FeatureGrid from '@/components/bookivo/FeatureGrid';
import UseCasesSection from '@/components/bookivo/UseCasesSection';
import PricingPreview from '@/components/bookivo/PricingPreview';
import FAQSection from '@/components/bookivo/FAQSection';
import FinalCTA from '@/components/bookivo/FinalCTA';
import BookivoFooter from '@/components/bookivo/BookivoFooter';

export default function BookivoPage() {
  const { t } = useTranslation();

  useDocumentMeta({
    title: t('bookivo.landing.meta.title', 'Bookivo — The Intelligent Booking OS'),
    description: t('bookivo.landing.meta.description', 'AI-powered booking platform for modern service businesses. Launch booking pages, manage vendors, and grow with AI.'),
    ogTitle: t('bookivo.landing.meta.title', 'Bookivo — The Intelligent Booking OS'),
    ogDescription: t('bookivo.landing.meta.description', 'AI-powered booking platform for modern service businesses. Launch booking pages, manage vendors, and grow with AI.'),
    ogUrl: 'https://biz-os-brain.lovable.app/bookivo',
    canonical: 'https://biz-os-brain.lovable.app/bookivo',
    twitterCard: 'summary_large_image',
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BookivoHeader />
      <main>
        <HeroSection />
        <SocialProofStrip />
        <ProblemSection />
        <SolutionSection />
        <AISmartSection />
        <AiBizOSSection />
        <FeatureGrid />
        <UseCasesSection />
        <PricingPreview />
        <FAQSection />
        <FinalCTA />
      </main>
      <BookivoFooter />
    </div>
  );
}
