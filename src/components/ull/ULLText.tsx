import { useULL } from '@/hooks/useULL';

interface ULLTextProps {
  table: string;
  id: string;
  field: string;
  fallback: string;
  sourceLang?: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Renders translated content via ULL projection.
 * Shows original text immediately, replaces with translation when ready.
 * Invisible to the user — no loaders, no flicker.
 */
export function ULLText({
  table,
  id,
  field,
  fallback,
  sourceLang = 'en',
  className,
  as: Component = 'span',
}: ULLTextProps) {
  const { getText } = useULL();
  const text = getText(table, id, field, fallback, sourceLang);

  return <Component className={className}>{text}</Component>;
}
