import type { ColorLiteral, ColorRef, ColorSource, Palette } from '@weasel-js/paint';
import type { CategoricalRampDef } from './definition.ts';
import { DEFAULT_CONSTRAINTS, generate, type Constraints } from './engine/color/generate.ts';
import { resolveTheme, themeChain, type ResolvedTheme } from './resolveTheme.ts';
import { weaselTheme, type Theme } from './theme.ts';

/** The categorical generator the swatch ramp uses, asked for `count` colors. */
export interface GeneratedColors {
  readonly generate: { readonly count: number; readonly gates?: CategoricalRampDef['gates'] };
}

/** A ramp of the active theme, by name — `{ ramp: 'swatch' }` walks its steps in order. */
export interface RampColors {
  readonly ramp: string;
}

/** One color of a list: a CSS color string, or a `ColorSource` resolved when it is read. */
export type ColorListItem = string | ColorSource;

/** The forms a theme definition can hold: everything but a function. */
export type SerializableColorList = readonly (string | ColorLiteral | ColorRef)[] | GeneratedColors | RampColors;

/**
 * Several colors, read by index with `colorAt`, wrapping. Items, each a CSS
 * string or a `ColorSource`; the swatch ramp's generator; a ramp of the active
 * theme, which follows the mode; or a function of the index.
 */
export type ColorList = readonly ColorListItem[] | GeneratedColors | RampColors | ((i: number) => ColorListItem);

/** What a `ColorList` resolves against. `useTheme()`'s value is one. */
export interface ColorContext {
  readonly theme: Theme;
  readonly resolved: ResolvedTheme;
}

/** What a `ColorSource` resolves against under a theme. `useTints()`'s value is one. */
export interface ColorSourceContext extends ColorContext {
  /** The list `{ ref: 'tint' }` indexes. Absent: the theme's own. */
  readonly tints?: ColorList;
  /** Names answered before the theme's. */
  readonly palette?: Palette;
}

const wrap = (i: number, n: number) => ((Math.trunc(i) % n) + n) % n;

const generated = new Map<string, readonly string[]>();

function generatedColors({ generate: g }: GeneratedColors): readonly string[] {
  const key = JSON.stringify([g.count, g.gates ?? {}]);
  let colors = generated.get(key);
  if (!colors) {
    const palette = generate({ ...DEFAULT_CONSTRAINTS, ...(g.gates as Partial<Constraints>), count: g.count, anchors: [] });
    colors = palette.swatches.map((s) => s.hex.toLowerCase());
    generated.set(key, colors);
  }
  return colors;
}

/** `rampSteps`, answering `undefined` for a ramp the chain lacks. */
export function findRampSteps(theme: Theme, ramp: string): readonly string[] | undefined {
  for (const t of themeChain(theme).reverse()) {
    const steps = t.ramps?.[ramp];
    if (steps) return steps;
  }
  return undefined;
}

/** A ramp's step names, from the nearest theme in the chain that declares it. */
export function rampSteps(theme: Theme, ramp: string): readonly string[] {
  const steps = findRampSteps(theme, ramp);
  if (!steps) throw new Error(`Theme "${theme.name}" has no ramp "${ramp}"`);
  return steps;
}

/** The tint list a theme declares, from the nearest theme in its chain that has one. */
export function themeTints(theme: Theme): ColorList {
  for (const t of themeChain(theme).reverse()) if (t.tints) return t.tints;
  return { ramp: 'swatch' };
}

let fallback: ColorContext | undefined;
export const defaultContext = () => (fallback ??= { theme: weaselTheme, resolved: resolveTheme(weaselTheme) });

const pickStep = (list: RampColors, i: number, theme: Theme): string => {
  const steps = rampSteps(theme, list.ramp);
  return steps[wrap(i, steps.length)];
};

/** The custom property behind the `i`th step of a ramp list, wrapping. */
export const rampProperty = (list: RampColors, i: number, theme: Theme): string =>
  `--wzl-${list.ramp}-${pickStep(list, i, theme)}`;

export const isRamp = (list: ColorList): list is RampColors => typeof list !== 'function' && 'ramp' in list;

/** The `i`th item of a list that is not a ramp, wrapping, as it was written. */
export function colorItemAt(list: Exclude<ColorList, RampColors>, i: number): ColorListItem {
  if (typeof list === 'function') return list(i);
  const colors = 'generate' in list ? generatedColors(list) : list;
  if (colors.length === 0) throw new Error('colorAt: empty color list');
  return colors[wrap(i, colors.length)];
}

/** How many distinct colors `list` holds before it wraps; `undefined` for a function, which never does. */
export function colorCount(list: ColorList, ctx: ColorContext = defaultContext()): number | undefined {
  if (typeof list === 'function') return undefined;
  if ('ramp' in list) return rampSteps(ctx.theme, list.ramp).length;
  return 'generate' in list ? list.generate.count : list.length;
}
