import { atAlpha, withAlpha } from './dtcg/color.ts';

const NUMBER = String.raw`(\d*\.?\d+)(%?)`;
const RELATIVE = new RegExp(String.raw`^rgb\(\s*from\s+currentcolor\s+r\s+g\s+b\s*/\s*${NUMBER}\s*\)$`, 'i');
const MIX = new RegExp(String.raw`^color-mix\(\s*in\s+[\w-]+\s*,\s*currentcolor\s+${NUMBER}\s*,\s*transparent\s*\)$`, 'i');

const fraction = (n: string, pct: string) => Number(n) / (pct ? 100 : 1);

/**
 * A resolved token value with `currentColor` taken to be `current`, for a surface drawn without the
 * cascade — a canvas reading a resolved theme — where `currentColor` has nothing to resolve against.
 * Pass the color of the text the value is drawn beside, usually `--wzl-fg`. A value that never
 * mentions `currentColor` comes back unchanged.
 *
 * Flattens the forms the kit's themes write: bare `currentColor`, `rgb(from currentColor r g b / a)`
 * and `color-mix(in <space>, currentColor p%, transparent)`. Throws on any other use of it.
 */
export function resolveCurrentColor(value: string, current: string): string {
  const v = value.trim();
  if (!/currentcolor/i.test(v)) return value;
  if (/^currentcolor$/i.test(v)) return current;
  const rel = RELATIVE.exec(v);
  if (rel) return atAlpha(current, fraction(rel[1], rel[2]));
  const mix = MIX.exec(v);
  if (mix && mix[2] === '%') return withAlpha(current, fraction(mix[1], mix[2]));
  throw new Error(`resolveCurrentColor: cannot flatten "${value}"`);
}
