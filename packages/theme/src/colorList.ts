import { colorLiteralToCss } from '@weasel-js/paint';
import { colorItemAt, defaultContext, isRamp, rampProperty, type ColorList, type ColorSourceContext } from './colorListItems.ts';
import { colorSourceCss, colorSourceLiteral } from './colorSource.ts';
import type { ResolvedTheme } from './resolveTheme.ts';

export {
  colorCount,
  findRampSteps,
  rampSteps,
  themeTints,
  type ColorContext,
  type ColorList,
  type ColorListItem,
  type GeneratedColors,
  type RampColors,
  type SerializableColorList,
} from './colorListItems.ts';

function answered(css: string | null, i: number): string {
  if (css === null) throw new Error(`colorAt: nothing answers item ${i} of the color list`);
  return css;
}

/**
 * The `i`th color of `list`, wrapping. A ramp list reads the resolved theme, so
 * the answer follows its mode; a `ColorSource` item resolves against the
 * context's palette, then its theme. Throws on an item nothing answers.
 */
export function colorAt(list: ColorList, i: number, ctx: ColorSourceContext = defaultContext()): string {
  if (isRamp(list)) return ctx.resolved[rampProperty(list, i, ctx.theme) as keyof ResolvedTheme];
  const item = colorItemAt(list, i);
  if (typeof item === 'string') return item;
  const literal = colorSourceLiteral(item, ctx);
  return answered(literal && colorLiteralToCss(literal), i);
}

/**
 * As `colorAt`, but a ramp list, and an item that names the theme, answers
 * with its custom property (`var(--wzl-swatch-sky)`), so a color written into
 * CSS follows a mode change without re-rendering, provider or not.
 */
export function colorCssAt(list: ColorList, i: number, ctx: ColorSourceContext = defaultContext()): string {
  if (isRamp(list)) return `var(${rampProperty(list, i, ctx.theme)})`;
  const item = colorItemAt(list, i);
  return typeof item === 'string' ? item : answered(colorSourceCss(item, ctx), i);
}
