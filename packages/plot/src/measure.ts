import { measureTextBounds } from '@weasel-js/text';
import type { PlotFont } from './theme';

/** How wide and tall one line of text is set in `font`. */
export type PlotMeasure = (text: string, font: PlotFont) => { width: number; height: number };

/** Measures as the kit's text renderer lays text out, from the registered face's metrics; a line is 1.2 sizes tall. */
export const textMeasure: PlotMeasure = (text, font) => {
  const { width } = measureTextBounds(text, { fontFamily: font.fontFamily, fontSize: font.fontSize });
  return { width: Math.ceil(width), height: Math.ceil(font.fontSize * 1.2) };
};
