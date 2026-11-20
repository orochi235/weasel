import type { MeasureRowText } from './body';
import { faceCapCenter } from './faceCapCenter';
import { estimatedWidth } from './rowMeasure';

/** The line height, in font sizes, a row is estimated at where nothing measures its text. */
const ESTIMATED_LINE = 1.4;

/**
 * `measure` asked in the face rows are drawn in: a row naming no family or size is measured at
 * `font`'s, as `rowTextStyle` draws it. With no `measure`, an estimate at that face.
 */
export function measureInFace(font: { fontFamily: string; fontSize: number }, measure?: MeasureRowText): MeasureRowText {
  return measure
    ? (text, s) => measure(text, { ...s, fontFamily: s.fontFamily ?? font.fontFamily, fontSize: s.fontSize ?? font.fontSize })
    : (text, s) => {
        const face = { ...s, fontSize: s.fontSize ?? font.fontSize, fontFamily: s.fontFamily ?? font.fontFamily };
        const capCenter = faceCapCenter(face);
        return {
          width: estimatedWidth(text, face), height: Math.ceil(ESTIMATED_LINE * face.fontSize),
          ...(capCenter !== undefined ? { capCenter } : {}),
        };
      };
}
