import type { ColorSource } from '@weasel-js/paint';
import { EMPHASIS_FG, type Emphasis, GRADE_TOKENS, type Grade, type Stance, TINT_REF } from '@weasel-js/theme';
import { useColorCss } from '@weasel-js/theme/react';
import type { CSSProperties } from 'react';

export type { Emphasis, Grade, Stance } from '@weasel-js/theme';

/**
 * How a component looks, as hints: each component decides what it draws from
 * each one. Color resolves as tint, then grade, then stance; emphasis sets how
 * loudly that color shows.
 */
export interface AppearanceProps {
  /** The angle it comes from: for advanced users, debug output, the confirming action. */
  stance?: Stance;
  /** How serious, or how good. */
  grade?: Grade;
  /** How loudly it reads. Passes to everything inside it as `--wzl-emphasis-fg`. */
  emphasis?: Emphasis;
  /**
   * An exact color: an index into the theme's tint list, wrapping, or a color
   * source. Belongs to this element alone.
   */
  tint?: number | ColorSource;
}

export interface AppearanceAttrs {
  'data-stance'?: Stance;
  'data-grade'?: Grade;
  'data-emphasis'?: Emphasis;
  'data-tint'?: string;
  style?: CSSProperties;
}

/** A tint as a color source: a number is an index into the theme's tint list. */
export function tintSource(tint: number | ColorSource | undefined): ColorSource | undefined {
  return typeof tint === 'number' ? { ref: TINT_REF, index: tint } : tint;
}

export function useAppearance({ stance, grade, emphasis, tint }: AppearanceProps): AppearanceAttrs {
  const css = useColorCss();
  if (stance === undefined && grade === undefined && emphasis === undefined && tint === undefined) return {};
  const color = css(tintSource(tint));
  const style: Record<string, string> = {};
  if (color !== undefined) style['--wzl-tint'] = color;
  if (grade !== undefined) style['--wzl-grade'] = `var(${GRADE_TOKENS[grade]})`;
  if (emphasis !== undefined) style['--wzl-emphasis-fg'] = EMPHASIS_FG[emphasis];
  return {
    'data-stance': stance,
    'data-grade': grade,
    'data-emphasis': emphasis,
    'data-tint': color === undefined ? undefined : typeof tint === 'number' ? String(tint) : color,
    style: Object.keys(style).length === 0 ? undefined : (style as CSSProperties),
  };
}
