import type { CategoricalRampDef } from './definition';
import { DEFAULT_CONSTRAINTS, generate, type Constraints } from './engine/color/generate';
import { resolveTheme, themeChain, type ResolvedTheme } from './resolveTheme';
import { weaselTheme, type Theme } from './theme';

/** The categorical generator the swatch ramp uses, asked for `count` colors. */
export interface GeneratedColors {
  readonly generate: { readonly count: number; readonly gates?: CategoricalRampDef['gates'] };
}

/** A ramp of the active theme, by name — `{ ramp: 'swatch' }` walks its steps in order. */
export interface RampColors {
  readonly ramp: string;
}

/** The forms a theme definition can hold: everything but a function. */
export type SerializableColorList = readonly string[] | GeneratedColors | RampColors;

/**
 * Several colors, read by index with `colorAt`, wrapping. Literals; the swatch
 * ramp's generator; a ramp of the active theme, which follows the mode; or a
 * function of the index.
 */
export type ColorList = SerializableColorList | ((i: number) => string);

/** What a `ColorList` resolves against. `useTheme()`'s value is one. */
export interface ColorContext {
  readonly theme: Theme;
  readonly resolved: ResolvedTheme;
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

/** A ramp's step names, from the nearest theme in the chain that declares it. */
export function rampSteps(theme: Theme, ramp: string): readonly string[] {
  for (const t of themeChain(theme).reverse()) {
    const steps = t.ramps?.[ramp];
    if (steps) return steps;
  }
  throw new Error(`Theme "${theme.name}" has no ramp "${ramp}"`);
}

/** The tone list a theme declares, from the nearest theme in its chain that has one. */
export function themeTones(theme: Theme): ColorList {
  for (const t of themeChain(theme).reverse()) if (t.tones) return t.tones;
  return { ramp: 'swatch' };
}

let fallback: ColorContext | undefined;
const defaultContext = () => (fallback ??= { theme: weaselTheme, resolved: resolveTheme(weaselTheme) });

function pickStep(list: RampColors, i: number, theme: Theme): string {
  const steps = rampSteps(theme, list.ramp);
  return steps[wrap(i, steps.length)];
}

/** The `i`th color of `list`, wrapping. A ramp list reads the resolved theme, so the answer follows its mode. */
export function colorAt(list: ColorList, i: number, ctx: ColorContext = defaultContext()): string {
  if (typeof list === 'function') return list(i);
  if ('ramp' in list) return ctx.resolved[`--wzl-${list.ramp}-${pickStep(list, i, ctx.theme)}` as keyof ResolvedTheme];
  const colors = 'generate' in list ? generatedColors(list) : list;
  if (colors.length === 0) throw new Error('colorAt: empty color list');
  return colors[wrap(i, colors.length)];
}

/**
 * As `colorAt`, but a ramp list answers with its custom property —
 * `var(--wzl-swatch-sky)` — so a color written into CSS follows a mode change
 * without re-rendering, provider or not.
 */
export function colorCssAt(list: ColorList, i: number, ctx: ColorContext = defaultContext()): string {
  if (typeof list !== 'function' && 'ramp' in list) return `var(--wzl-${list.ramp}-${pickStep(list, i, ctx.theme)})`;
  return colorAt(list, i, ctx);
}
