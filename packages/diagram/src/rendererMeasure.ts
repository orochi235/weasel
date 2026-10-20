import { measureTextBounds } from '@weasel-js/core';
import type { MeasureRowText } from './body';

const FALLBACK_SIZE = 16;

/**
 * Measures a row's text as the kit's text renderer lays it out, from the
 * registered font's metrics, so a body sized by it holds the text it draws.
 * The line height is 1.2 sizes, as `canvasMeasure`'s is. Needs the family
 * registered; an unregistered one measures as the fallback glyph.
 */
export const rendererMeasure: MeasureRowText = (text, style) => {
  const fontSize = style.fontSize ?? FALLBACK_SIZE;
  const { width } = measureTextBounds(text, {
    fontSize, ...(style.fontFamily !== undefined ? { fontFamily: style.fontFamily } : {}), ...(style.bold === true ? { fontWeight: 700 } : {}),
  });
  return { width: Math.ceil(width), height: Math.ceil(fontSize * 1.2) };
};
