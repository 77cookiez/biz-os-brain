import { useULL } from '@/hooks/useULL';

interface ULLTextProps {
  /** Phase 1: primary identifier — meaning object ID */
  meaningId?: string | null;
  /** Phase 0 legacy props */
  table?: string;
  id?: string;
  field?: string;
  /** Always required: text to show while loading / as fallback */
  fallback: string;
  sourceLang?: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Renders translated content via ULL projection.
 * Phase 1: Uses meaningId as primary key.
 * Phase 0 fallback: Uses table/id/field.
 * Shows original text immediately, replaces with translation when ready.
 */
export function ULLText({
  meaningId,
  table,
  id,
  field,
  fallback,
  sourceLang = 'en',
  className,
  as: Component = 'span',
}: ULLTextProps) {
  const { getText, getTextByMeaning } = useULL();

  // Phase 1: meaning-based projection (preferred)
  if (meaningId) {
    const text = getTextByMeaning(meaningId, fallback);
    return <Component className={className}>{text}</Component>;
  }

  // Phase 0: legacy text-based projection
  if (table && id && field) {
    const text = getText(table, id, field, fallback, sourceLang);
    return <Component className={className}>{text}</Component>;
  }

  // No projection available — show fallback
  return <Component className={className}>{fallback}</Component>;
}
