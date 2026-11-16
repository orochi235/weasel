import type { Paint } from '@weasel-js/paint';
import type { PathFillRule } from '@weasel-js/geom';

/** The style params an insert reads, each a shape tool's option of the same name. */
export const STYLE_OPTION_KEYS = ['fill', 'stroke', 'strokeWidth', 'fillRule'] as const;
/** One of {@link STYLE_OPTION_KEYS}. */
export type StyleOptionKey = (typeof STYLE_OPTION_KEYS)[number];

/** The stroke width a new shape is drawn with, in world units, when nothing names one. */
export const DEFAULT_STROKE_WIDTH = 2;

/** The style an insert is drawn with, as `extras.style` hands it to the `insert` dep. A key left out is the dep's
 *  own choice; `null` paints none of it. */
export interface InsertStyle {
  fill?: Paint | null;
  stroke?: Paint | null;
  strokeWidth?: number;
  fillRule?: PathFillRule;
}

/** The style `params` carry, or `undefined` when they carry none. */
export function insertStyleOf(params: Readonly<Record<string, unknown>> | undefined): InsertStyle | undefined {
  if (!params) return undefined;
  let style: InsertStyle | undefined;
  for (const key of STYLE_OPTION_KEYS) {
    if (!Object.hasOwn(params, key) || params[key] === undefined) continue;
    (style ??= {})[key] = params[key] as never;
  }
  return style;
}
