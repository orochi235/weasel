import type { ReactNode } from 'react';
import s from './Code.module.css';
import { type StanceProps, useStance } from '../stance';

/** Status color of a {@link Code} span. `success` and `danger` double as the
 *  added and removed sides of a diff. */
export type CodeStatus = 'neutral' | 'muted' | 'accent' | 'success' | 'warn' | 'danger';
/** `subtle` sets the text on a tinted chip; `plain` is colored monospace text alone. */
export type CodeVariant = 'subtle' | 'plain';
/** Pins the type to a theme step. Left unset, the span sizes itself from the
 *  surrounding text. */
export type CodeSize = 'xs' | 'sm' | 'md';

/** Props for {@link Code}. */
export interface CodeProps extends StanceProps {
  children: ReactNode;
  /** The status the text reports. A peer `tone`, or a stance's accent, paints over it. */
  status?: CodeStatus;
  variant?: CodeVariant;
  size?: CodeSize;
  className?: string;
  title?: string;
}

/**
 * An inline run of literal text — an identifier, a type, a key path — set in
 * the monospace face inside a `<code>` element. Unlike {@link Badge}, which
 * labels, it quotes: the text keeps its case and wraps anywhere, so a long
 * type signature breaks across lines with the chip following each fragment.
 */
export function Code({
  children,
  status = 'neutral',
  stance,
  tone,
  variant = 'subtle',
  size,
  className,
  title,
}: CodeProps) {
  const stanced = useStance({ stance, tone });
  return (
    <code
      className={className ? `${s.code} ${className}` : s.code}
      {...stanced}
      data-status={status}
      data-variant={variant}
      data-size={size}
      title={title}
    >
      {children}
    </code>
  );
}
