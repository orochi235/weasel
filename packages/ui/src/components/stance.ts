import type { ColorSource } from '@weasel-js/paint';
import { TONE_REF, type Stance } from '@weasel-js/theme';
import { useColorCss } from '@weasel-js/theme/react';
import type { CSSProperties } from 'react';

export type { Stance } from '@weasel-js/theme';

/**
 * What a surface holds, and which of its peers it is. Every surface that takes
 * these takes both, and the theme decides how each looks.
 */
export interface StanceProps {
  /** The class of content the surface holds. Omitted, it draws as it always has. */
  stance?: Stance;
  /**
   * Which of its peers this is: an index into the theme's tone list, wrapping,
   * or a color: a literal, or a `ColorRef` naming one in the theme or the
   * provider's palette. Independent of `stance`, and allowed without one.
   */
  tone?: number | ColorSource;
}

/** The attributes a stanced surface renders, and the style carrying its resolved tone. */
export interface StanceAttrs {
  'data-stance'?: Stance;
  'data-tone'?: string;
  style?: CSSProperties;
}

/**
 * Resolves `stance` and `tone` for a surface's root element. The tone is
 * written inline as `--wzl-tone`, resolved by `useColorCss`; an index is the
 * `tone` ref at that index. A tone nothing answers is no tone.
 */
export function useStance({ stance, tone }: StanceProps): StanceAttrs {
  const css = useColorCss();
  if (stance === undefined && tone === undefined) return {};
  const color = css(typeof tone === 'number' ? { ref: TONE_REF, index: tone } : tone);
  return {
    'data-stance': stance,
    'data-tone': color === undefined ? undefined : typeof tone === 'number' ? String(tone) : color,
    style: color === undefined ? undefined : ({ '--wzl-tone': color } as CSSProperties),
  };
}
