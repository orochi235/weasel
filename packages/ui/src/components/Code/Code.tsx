import type { ReactNode } from 'react';
import s from './Code.module.css';
import { type AppearanceProps, useAppearance } from '../appearance';

/** `subtle` sets the text on a tinted chip; `plain` is colored monospace text alone. */
export type CodeVariant = 'subtle' | 'plain';
/** Pins the type to a theme step. Left unset, the span sizes itself from the
 *  surrounding text. */
export type CodeSize = 'xs' | 'sm' | 'md';

/** Props for {@link Code}. */
export interface CodeProps extends AppearanceProps {
  children: ReactNode;
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
  stance,
  grade,
  emphasis,
  tint,
  variant = 'subtle',
  size,
  className,
  title,
}: CodeProps) {
  const appearance = useAppearance({ stance, grade, emphasis, tint });
  return (
    <code
      className={className ? `${s.code} ${className}` : s.code}
      {...appearance}
      data-variant={variant}
      data-size={size}
      title={title}
    >
      {children}
    </code>
  );
}
