import { useSyncExternalStore } from 'react';
import {
  faceGeneration,
  listCanvasFonts,
  listFontWeights,
  listFonts,
  resolveFontVariant,
  subscribeGlyphReady,
} from '@weasel-js/font';
import type { ListOption } from '../listOption';

/** Arguments to {@link fontFamilyOptions}. */
export interface FontFamilyOptionsArgs {
  /** The current family, kept as its own entry when the registry can't offer it. Leave it out while mixed. */
  value?: string;
  /** The weight and style the text renders at, so a family that isn't loaded names the variant that paints. */
  weight?: number;
  fontStyle?: 'normal' | 'italic';
}

/** Arguments to {@link fontWeightOptions}. */
export interface FontWeightOptionsArgs {
  /** The family whose weights to offer. Absent offers the CSS weights. */
  family?: string;
  /** The current weight, kept as its own entry when the family has no face for it. Leave it out while mixed. */
  value?: number;
}

/** Label for a value that isn't in the registry: name the substitute when the
 *  fallback chain found one, otherwise say only what is known. */
function unregisteredLabel(family: string, weight: number, style: 'normal' | 'italic'): string {
  const { substituted } = resolveFontVariant(family, weight, style);
  return substituted
    ? `${family} — not loaded, showing ${substituted.resolved}`
    : `${family} — not loaded`;
}

/**
 * `Select` options for a font family, read from the font registry now.
 *
 * It offers both tiers that can paint: `listFonts()` for families with a baked atlas, and `listCanvasFonts()`
 * for the families the canvas-SDF tier serves. A `value` the registry can't back stays on offer as its own
 * entry, naming what paints instead: dropping it would rewrite the document on the next edit, and showing it
 * bare would claim a font is in use that isn't.
 */
export function fontFamilyOptions(args: FontFamilyOptionsArgs = {}): ListOption<string>[] {
  const { value, weight = 400, fontStyle = 'normal' } = args;
  const baked = listFonts();
  const canvas = listCanvasFonts().filter((c) => !baked.some((f) => f.family === c.family));
  const available = [...baked.map((f) => f.family), ...canvas.map((c) => c.family)];
  const options: ListOption<string>[] = available.map((family) => ({ value: family, label: family }));
  if (value !== undefined && !available.includes(value)) {
    options.push({ value, label: unregisteredLabel(value, weight, fontStyle) });
  }
  return options;
}

const CSS_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const NAMES: Readonly<Record<number, string>> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
};

/** A weight as the options list it: the number, then its common name. */
export function fontWeightLabel(weight: number): string {
  const name = NAMES[weight];
  return name ? `${weight} ${name}` : String(weight);
}

/**
 * `Select` options for a font weight, keyed by the weight as a string (`Number(key)` reads one back).
 *
 * It offers the weights `listFontWeights` reports for `family`, the faces that paint rather than be faked. A
 * family with none on file (the canvas tier, which rasterizes any weight, or no family because the selection
 * spans several) gets the nine CSS weights. A `value` outside the list is kept as its own entry, as
 * {@link fontFamilyOptions} keeps an unregistered family.
 */
export function fontWeightOptions(args: FontWeightOptionsArgs = {}): ListOption<string>[] {
  const { family, value } = args;
  const registered = family === undefined ? [] : listFontWeights(family);
  const weights = new Set<number>(registered.length > 0 ? registered : CSS_WEIGHTS);
  if (value !== undefined) weights.add(value);
  return [...weights].sort((a, b) => a - b).map((w) => ({ value: String(w), label: fontWeightLabel(w) }));
}

/** Rerenders the caller whenever a face is registered, lands, or fails to load. */
function useFaceGeneration(): number {
  return useSyncExternalStore(subscribeGlyphReady, faceGeneration, faceGeneration);
}

/** {@link fontFamilyOptions}, built again whenever the registry's faces change. */
export function useFontFamilyOptions(args: FontFamilyOptionsArgs = {}): ListOption<string>[] {
  useFaceGeneration();
  return fontFamilyOptions(args);
}

/** {@link fontWeightOptions}, built again whenever the registry's faces change. */
export function useFontWeightOptions(args: FontWeightOptionsArgs = {}): ListOption<string>[] {
  useFaceGeneration();
  return fontWeightOptions(args);
}
