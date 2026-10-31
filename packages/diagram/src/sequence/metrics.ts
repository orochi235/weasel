/** The sizes a sequence is laid out with, and how its text is measured. */
import type { MeasureRowText, RowTextStyle } from '../body';
import { DEFAULT_FONT, GLYPH } from '../edgeLabel';
import { boxForContent, type Outline } from '../outline';
import type { SeqParticipant } from './types';

/** The spacing a sequence keeps, in world units. */
export const SEQ = {
  /** Around the whole diagram. */
  margin: 12,
  /** Between a head's outline and its text. */
  headPad: 10,
  headMinWidth: 80,
  headMinHeight: 36,
  /** The least room between two heads. */
  columnGap: 32,
  /** Either side of a message's text along its line. */
  textPad: 10,
  /** Above every row. */
  rowGap: 14,
  /** Between a message's text and its line. */
  textGap: 3,
  /** A self-message's loop: how far it reaches right, and how tall it is. */
  loopWidth: 32,
  loopHeight: 20,
  /** An activation bar's width, and how far each nested one steps right. */
  barWidth: 10,
  barStep: 5,
  notePad: 6,
  noteMinWidth: 60,
  /** Between a lifeline and a note beside it. */
  noteGap: 10,
  /** How far a note over two lifelines reaches past them. */
  noteOverhang: 16,
  /** Between a fragment's box and the lifelines it holds, and between nested boxes. */
  fragmentPad: 14,
  fragmentNest: 8,
  /** Around a fragment's type label in its tab. */
  tabPad: 6,
  /** Between a box's border and the heads it holds. */
  boxPad: 10,
  /** Below the last row. */
  footer: 16,
  /** The X at a destroyed lifeline's end. */
  cross: 12,
} as const;

/** A box in world units. */
export interface SeqRect { x: number; y: number; width: number; height: number }

/** Measures text as the layout and the specs both read it. */
export interface SeqMeasure {
  font: { fontFamily: string; fontSize: number };
  /** The size of `text` at `size` (default the font's), each `\n` a line. */
  text(text: string, style?: RowTextStyle): { width: number; height: number };
}

/** A measure from `measure` (default an estimate from character count) in `font`. */
export function seqMeasure(measure: MeasureRowText | undefined, font = DEFAULT_FONT): SeqMeasure {
  const line: MeasureRowText = measure ?? ((text, s) => {
    const size = s.fontSize ?? font.fontSize;
    return { width: text.length * GLYPH * size, height: Math.ceil(1.4 * size) };
  });
  return {
    font,
    text: (text, style = {}) => {
      const s = { ...style, fontFamily: style.fontFamily ?? font.fontFamily, fontSize: style.fontSize ?? font.fontSize };
      const sizes = text.split('\n').map((l) => line(l, s));
      return { width: Math.max(0, ...sizes.map((z) => z.width)), height: sizes.reduce((h, z) => h + z.height, 0) };
    },
  };
}

/** A participant's head size: its text and padding, grown to the box its outline holds them in. */
export function headSize(p: SeqParticipant, m: SeqMeasure): { width: number; height: number } {
  const t = m.text(p.label ?? p.id);
  const outline: Outline = p.outline ?? 'rect';
  const box = boxForContent(outline, { width: t.width + SEQ.headPad * 2, height: t.height + SEQ.headPad * 2 });
  return { width: Math.max(SEQ.headMinWidth, Math.ceil(box.width)), height: Math.max(SEQ.headMinHeight, Math.ceil(box.height)) };
}
