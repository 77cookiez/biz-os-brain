import { useTranslation } from 'react-i18next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQSection() {
  const { t } = useTranslation();

  const faqs = [
    { q: t('bookivo.landing.faq.q1', 'Is there a free trial?'), a: t('bookivo.landing.faq.a1', 'Yes! The Free plan is free forever. Smart AI includes a 14-day free trial with full access.') },
    { q: t('bookivo.landing.faq.q2', 'What languages are supported?'), a: t('bookivo.landing.faq.a2', 'Bookivo supports English, Arabic, French, Spanish, German, and more via our Universal Language Layer.') },
    { q: t('bookivo.landing.faq.q3', 'Can I use my own domain?'), a: t('bookivo.landing.faq.a3', 'Yes, on the Business plan you can connect your custom domain for a fully branded experience.') },
    { q: t('bookivo.landing.faq.q4', 'How does AI help my business?'), a: t('bookivo.landing.faq.a4', 'AI provides pricing suggestions, vendor performance insights, growth recommendations, and automated workflows.') },
    { q: t('bookivo.landing.faq.q5', 'Is my data secure?'), a: t('bookivo.landing.faq.a5', 'Absolutely. We use enterprise-grade security with strict data isolation and Row Level Security policies.') },
    { q: t('bookivo.landing.faq.q6', 'Can I cancel anytime?'), a: t('bookivo.landing.faq.a6', 'Yes. You can cancel or downgrade your plan at any time with no hidden fees.') },
  ];

  return (
    <section id="faq" className="py-16 sm:py-20 border-y border-border/50" aria-labelledby="faq-heading">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="faq-heading" className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            {t('bookivo.landing.faq.title', 'Frequently Asked Questions')}
          </h2>
        </div>
        <Accordion type="single" collapsible className="space-y-0">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b border-border px-0">
              <AccordionTrigger className="text-start hover:no-underline py-5 text-sm font-semibold">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-5 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
