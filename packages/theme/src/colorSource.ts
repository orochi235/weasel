import {
  colorLiteralToCss,
  cssColorLiteral,
  resolvePaletteColor,
  type ColorFnContext,
  type ColorLiteral,
  type ColorRef,
  type ColorSource,
  type Palette,
} from '@weasel-js/paint';
import {
  colorItemAt,
  defaultContext,
  findRampSteps,
  isRamp,
  rampProperty,
  themeTones,
  type ColorList,
  type ColorSourceContext,
} from './colorListItems.ts';
import { resolveCurrentColor } from './currentColor.ts';

/** The name the tone list answers to: `{ ref: 'tone', index: 2 }` is the third tone, wrapping. */
export const TONE_REF = 'tone';

export type { ColorSourceContext };

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

const isRef = (source: ColorSource): source is ColorRef => typeof source !== 'function' && 'ref' in source;

function toneSource(index: number, ctx: ColorSourceContext): ColorSource | null {
  const tones = tonesOf(ctx);
  if (isRamp(tones)) return tokenLiteral(rampProperty(tones, index, ctx.theme), ctx);
  const item = colorItemAt(tones, index);
  return typeof item === 'string' ? parsed(item) : item;
}

function themeSource(ref: ColorRef, ctx: ColorSourceContext): ColorSource | null {
  if (ref.ref === TONE_REF) return toneSource(ref.index ?? 0, ctx);
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
  return resolvePaletteColor(ctx.palette ?? NO_PALETTE, source, (ref) => themeSource(ref, ctx));
}

function literalCss(source: ColorSource, ctx: ColorSourceContext): string | null {
  const literal = colorSourceLiteral(source, ctx);
  return literal && colorLiteralToCss(literal);
}

function toneCss(source: ColorRef, ctx: ColorSourceContext): string | null {
  const tones = tonesOf(ctx);
  const index = source.index ?? 0;
  if (isRamp(tones)) return `var(${rampProperty(tones, index, ctx.theme)})`;
  const item = colorItemAt(tones, index);
  if (typeof item === 'string') return item;
  return isRef(item) && item.ref !== TONE_REF ? colorSourceCss(item, ctx) : literalCss(source, ctx);
}

function themeRefCss(ref: ColorRef, ctx: ColorSourceContext): string | null {
  if (ref.ref === TONE_REF) return toneCss(ref, ctx);
  const property = propertyOf(ref, ctx);
  if (property === null) return null;
  return ref.ref.startsWith('--') || tokenLiteral(property, ctx) ? `var(${property})` : null;
}

function nth<T>(items: Iterable<T>, n: number): T | undefined {
  let i = 0;
  for (const item of items) if (i++ === n) return item;
  return undefined;
}

/**
 * The theme ref `source` comes down to when followed by name alone, through
 * palette entries and functions that only name another color. `null` when it
 * ends anywhere else, or when a function read a color to compute its own.
 */
function namedThemeRef(source: ColorSource, ctx: ColorSourceContext): ColorRef | null {
  const entries = ctx.palette?.entries ?? [];
  const seen = new Set<string>();
  let read = false;
  const fnCtx: ColorFnContext = {
    resolve: (s) => {
      read = true;
      return colorSourceLiteral(s, ctx);
    },
  };
  let at: ColorSource | null | undefined = source;
  while (at != null && !read) {
    if (typeof at === 'function') {
      at = at(fnCtx);
      continue;
    }
    if (!isRef(at)) return null;
    const { ref, index = 0 } = at;
    const entry = entries.find((e) => e.name === ref);
    if (!entry) return at;
    const key = `${index}:${ref}`;
    if (seen.has(key)) return null;
    seen.add(key);
    if ('color' in entry) at = index === 0 ? entry.color : null;
    else at = nth(entry.colors(fnCtx), index);
  }
  return null;
}

/**
 * `source` as a CSS color, naming what `colorSourceLiteral` resolves. A source
 * that comes down to a ref the theme answers, directly or through palette
 * entries and functions that only name another color, is written as that
 * ref's custom property: it follows the cascade with no re-render, and a
 * property spelled out need not be the theme's. Everything else is written as
 * the literal it resolves to in `ctx`, which includes a function that reads a
 * color through `resolve` to compute its own.
 */
export function colorSourceCss(source: ColorSource, ctx: ColorSourceContext = defaultContext()): string | null {
  const named = namedThemeRef(source, ctx);
  return named ? themeRefCss(named, ctx) : literalCss(source, ctx);
}
