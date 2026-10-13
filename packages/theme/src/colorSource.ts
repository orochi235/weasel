import {
  colorLiteralToCss,
  cssColorLiteral,
  resolvePaletteColor,
  type ColorLiteral,
  type ColorRef,
  type ColorSource,
  type Palette,
} from '@weasel-js/paint';
import { colorAt, colorCssAt, defaultContext, findRampSteps, themeTones, type ColorContext, type ColorList } from './colorList.ts';
import { resolveCurrentColor } from './currentColor.ts';

/** The name the tone list answers to: `{ ref: 'tone', index: 2 }` is the third tone, wrapping. */
export const TONE_REF = 'tone';

/** What a `ColorSource` resolves against under a theme. `useTones()`'s value is one. */
export interface ColorSourceContext extends ColorContext {
  /** The list `{ ref: 'tone' }` indexes. Absent: the theme's own. */
  readonly tones?: ColorList;
  /** Names answered before the theme's. */
  readonly palette?: Palette;
}

const NO_PALETTE: Palette = { entries: [] };

const tonesOf = (ctx: ColorSourceContext): ColorList => ctx.tones ?? themeTones(ctx.theme);

function parsed(css: string): ColorLiteral | null {
  try {
    return cssColorLiteral(css);
  } catch {
    return null;
  }
}

/** The custom property a theme ref names: itself when spelled as one, a token by name, or a ramp step by index. */
function propertyOf(ref: ColorRef, ctx: ColorSourceContext): string | null {
  if (ref.ref.startsWith('--')) return ref.index === undefined ? ref.ref : null;
  if (ref.index === undefined) return `--wzl-${ref.ref}`;
  const step = findRampSteps(ctx.theme, ref.ref)?.[ref.index];
  return step === undefined ? null : `--wzl-${ref.ref}-${step}`;
}

function tokenLiteral(property: string, ctx: ColorSourceContext): ColorLiteral | null {
  const value = (ctx.resolved as Readonly<Record<string, string>>)[property];
  if (value === undefined) return null;
  try {
    return parsed(resolveCurrentColor(value, ctx.resolved['--wzl-fg']));
  } catch {
    return null;
  }
}

function themeLiteral(ref: ColorRef, ctx: ColorSourceContext): ColorLiteral | null {
  if (ref.ref === TONE_REF) return parsed(colorAt(tonesOf(ctx), ref.index ?? 0, ctx));
  const property = propertyOf(ref, ctx);
  return property === null ? null : tokenLiteral(property, ctx);
}

/**
 * Resolve `source` to a literal, for a surface drawn without the cascade. A ref
 * names an entry of the context's palette first, then the theme: `tone` with an
 * index into the tone list, a token by its name without the `--wzl-` prefix, a
 * ramp by its name with the index of a step, or a custom property spelled out.
 * `null` for a name nothing answers, a token that is not a color, and a custom
 * property the theme does not define.
 */
export function colorSourceLiteral(source: ColorSource, ctx: ColorSourceContext = defaultContext()): ColorLiteral | null {
  return resolvePaletteColor(ctx.palette ?? NO_PALETTE, source, (ref) => themeLiteral(ref, ctx));
}

/**
 * `source` as a CSS color, naming what `colorSourceLiteral` resolves. A ref the
 * theme answers is written as its custom property, so it follows the cascade
 * with no re-render and a property spelled out need not be the theme's;
 * everything else is written as the literal it resolves to.
 */
export function colorSourceCss(source: ColorSource, ctx: ColorSourceContext = defaultContext()): string | null {
  if (typeof source !== 'function' && 'ref' in source && !ctx.palette?.entries.some((e) => e.name === source.ref)) {
    if (source.ref === TONE_REF) return colorCssAt(tonesOf(ctx), source.index ?? 0, ctx);
    const property = propertyOf(source, ctx);
    if (property === null) return null;
    return source.ref.startsWith('--') || tokenLiteral(property, ctx) ? `var(${property})` : null;
  }
  const literal = colorSourceLiteral(source, ctx);
  return literal && colorLiteralToCss(literal);
}
