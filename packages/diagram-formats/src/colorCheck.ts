/** The one check every reader makes of a color a file names: whether a diagram can draw it. */
import { tryParseColor } from '@weasel-js/paint';

/** Whether a diagram can draw `css`: whether paint reads it as a color. */
export function drawableColor(css: string): boolean {
  return tryParseColor(css) !== null;
}

/** `css` where a diagram can draw it; else `undefined`, with `css` added to the `format` warning `list` keeps. */
export function checkedColor(
  css: string | undefined, format: string, list: (lead: string, item: string) => void,
): string | undefined {
  if (css === undefined || drawableColor(css)) return css;
  list(`${format} colors a diagram cannot draw were dropped`, css);
  return undefined;
}
