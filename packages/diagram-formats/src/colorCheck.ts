/** The one check every reader makes of a color a file names: whether a diagram can draw it. */
import { parseColor } from '@weasel-js/paint';

/** Whether a diagram can draw `css`: whether paint reads it as a color. */
export function drawableColor(css: string): boolean {
  try {
    parseColor(css);
    return true;
  } catch {
    return false;
  }
}

/** `css` where a diagram can draw it; else `undefined`, with `css` added to the `format` warning `list` keeps. */
export function checkedColor(
  css: string | undefined, format: string, list: (lead: string, item: string) => void,
): string | undefined {
  if (css === undefined || drawableColor(css)) return css;
  list(`${format} colors a diagram cannot draw were dropped`, css);
  return undefined;
}
