import { colorCssAt, type PanelStance } from '@weasel-js/theme';
import { useTones } from '@weasel-js/theme/react';
import type { CSSProperties } from 'react';

export type { PanelStance } from '@weasel-js/theme';

/**
 * What a surface holds, and which of its peers it is. Every surface that takes
 * these takes both, and the theme decides how each looks.
 */
export interface StanceProps {
  /** The class of content the surface holds. Omitted, it draws as it always has. */
  stance?: PanelStance;
  /**
   * Which of its peers this is: an index into the theme's tone list, wrapping,
   * or a color given directly. Independent of `stance`, and allowed without one.
   */
  tone?: number | string;
}

/** The attributes a stanced surface renders, and the style carrying its resolved tone. */
export interface StanceAttrs {
  'data-stance'?: PanelStance;
  'data-tone'?: string;
  style?: CSSProperties;
}

/**
 * Resolves `stance` and `tone` for a surface's root element. The tone is
 * written to `toneVar` inline; a tone-list index resolves through the nearest
 * `<ThemeProvider>`'s tones, as a custom-property reference where the list is
 * a theme ramp, so it follows the mode without a re-render.
 */
export function useStance({ stance, tone }: StanceProps, toneVar: `--wzl-${string}`): StanceAttrs {
  const ctx = useTones();
  if (stance === undefined && tone === undefined) return {};
  const color = tone === undefined ? undefined : typeof tone === 'number' ? colorCssAt(ctx.tones, tone, ctx) : tone;
  return {
    'data-stance': stance,
    'data-tone': tone === undefined ? undefined : String(tone),
    style: color === undefined ? undefined : ({ [toneVar]: color } as CSSProperties),
  };
}
