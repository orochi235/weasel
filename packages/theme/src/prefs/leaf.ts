// A token as a pref leaf: which kind edits it, and its CSS text to the leaf's value and back.

import { rgbaToHex, tryParseColor } from '@weasel-js/paint';
import type { PrefLeaf, PrefLinearUnit, PrefNumber } from '@weasel-js/prefs';
import { readCssNumber } from '../cssNumber.ts';
import type { TokenRow } from './tokens.ts';

const NUMERIC_TYPES: ReadonlySet<string> = new Set(['dimension', 'number', 'duration', 'fontWeight']);

function hexOf(css: string): string | undefined {
  const rgba = tryParseColor(css);
  return rgba ? rgbaToHex(rgba) : undefined;
}

/**
 * The leaf that edits `row`, less its default: a `color` where every value it
 * resolves to is a color this kit can parse, a `number` in the unit they share
 * where every one is a number, and otherwise a `string` holding the CSS text,
 * which is what a `var()`, a `calc()`, a font stack, or a shadow is edited as.
 */
export function tokenLeafKind(row: TokenRow): Pick<PrefNumber, 'kind' | 'unit'> | { kind: 'color'; alpha: true } | { kind: 'string' } {
  const values = Object.values(row.css);
  if (row.type === 'color' && values.every((css) => hexOf(css) !== undefined)) return { kind: 'color', alpha: true };
  if (NUMERIC_TYPES.has(row.type)) {
    const read = values.map(readCssNumber);
    // A length may drop its unit only at 0, so a bare 0 takes the unit of the rest, px where there is none.
    const unit = row.type === 'dimension' ? (read.find((r) => r && !isBareZero(r))?.unit || 'px') : read[0]?.unit;
    if (read.every((r) => r !== undefined && (r.unit === unit || (unit !== '' && isBareZero(r))))) {
      return unit ? { kind: 'number', unit: { scale: 1, suffix: unit } } : { kind: 'number' };
    }
  }
  return { kind: 'string' };
}

const isBareZero = (read: { value: number; unit: string }): boolean => read.value === 0 && read.unit === '';

const suffixOf = (leaf: PrefLeaf): string => ((leaf as PrefNumber).unit as PrefLinearUnit | undefined)?.suffix ?? '';

/** What `css` reads as on `leaf`, or `undefined` for text its kind cannot hold. */
export function prefOfCss(leaf: PrefLeaf, css: string | undefined): unknown {
  if (css === undefined) return undefined;
  if (leaf.kind === 'color') return hexOf(css);
  if (leaf.kind !== 'number') return css;
  const read = readCssNumber(css);
  return read && (read.unit === suffixOf(leaf) || isBareZero(read)) ? read.value : undefined;
}

/** The CSS text of a value `leaf` holds. */
export function cssOfPref(leaf: PrefLeaf, value: unknown): string {
  return leaf.kind === 'number' ? `${value as number}${suffixOf(leaf)}` : String(value);
}
