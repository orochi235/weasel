/** Marks drawn as text: titles, tick labels, values. */
import type { PlotMeasure } from '../measure';
import type { PlotFont } from '../theme';
import type { PlotDatum, PlotMark } from './types';

/** Options for {@link textMark}. */
export interface TextMarkOptions {
  key: string;
  text: string;
  /** The anchor point. */
  x: number;
  y: number;
  /** Which part of the text stands on `x`. Default `'middle'`. */
  anchor?: 'start' | 'middle' | 'end';
  /** Which part of the text stands on `y`. Default `'middle'`. */
  baseline?: 'top' | 'middle' | 'bottom';
  font: PlotFont;
  color: string;
  measure: PlotMeasure;
  /** Turns the text a quarter turn counterclockwise about the anchor, as a vertical axis's title reads. */
  vertical?: boolean;
  bold?: boolean;
  datum?: PlotDatum;
}

const ALIGN = { start: 'left', middle: 'center', end: 'right' } as const;

/** One line of text, its box measured with `measure` and placed by its anchor. */
export function textMark(opts: TextMarkOptions): PlotMark {
  const { width, height } = opts.measure(opts.text, opts.font);
  const anchor = opts.anchor ?? 'middle';
  const baseline = opts.baseline ?? 'middle';
  // Along and across the line, which a quarter turn swaps on screen.
  const along = anchor === 'start' ? 0 : anchor === 'middle' ? -width / 2 : -width;
  const across = baseline === 'top' ? 0 : baseline === 'middle' ? -height / 2 : -height;
  const center = opts.vertical
    ? { x: opts.x + across + height / 2, y: opts.y - along - width / 2 }
    : { x: opts.x + along + width / 2, y: opts.y + across + height / 2 };
  return {
    key: opts.key,
    pose: {
      x: center.x - width / 2, y: center.y - height / 2, width, height, ...(opts.vertical ? { rotation: -Math.PI / 2 } : {}),
    },
    data: {
      plotMark: { kind: 'text', ...(opts.datum ? { datum: opts.datum } : {}) },
      text: opts.text,
      style: { fontFamily: opts.font.fontFamily, fontSize: opts.font.fontSize, align: ALIGN[anchor], ...(opts.bold ? { fontWeight: 700 } : {}) },
      fill: { paint: { color: opts.color } },
      verticalAlign: 'center',
    },
  };
}
