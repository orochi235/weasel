/** A packet diagram compiled to rows of bit fields. */
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { spanMark } from '../marks/boxes';
import { textMark } from '../marks/text';
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { bandScale, type BandScale } from '../scales/band';
import { seriesColor, type PlotTheme } from '../theme';
import type { PacketData, PacketField } from './types';

/** Where a packet's rows landed: a band per bit of a row across, and each row's box from `boxTop(row)` down. */
export interface PacketLayout {
  /** Over a row's bits, keyed `'0'` to one less than the bits per row. */
  bits: BandScale;
  bitsPerRow: number;
  rows: number;
  /** The top of row `row`'s field boxes, under its bit numbers. */
  boxTop(row: number): number;
  boxHeight: number;
}

/** One row's share of a field: its first and last bit there. */
export interface PacketPiece {
  row: number;
  lo: number;
  hi: number;
}

const BOX = 32;
const GAP = 6;
const INSET = 2;

/** The bits per row `data` lays out: its own, else 32. */
export const packetBitsPerRow = (data: PacketData): number => Math.max(1, Math.floor(data.bitsPerRow ?? 32));

/** A field cut where it wraps: one piece per row it covers. None for a field that runs backward. */
export function packetPieces(field: PacketField, bitsPerRow: number): PacketPiece[] {
  if (!(field.start >= 0 && field.end >= field.start)) return [];
  const pieces: PacketPiece[] = [];
  for (let row = Math.floor(field.start / bitsPerRow); row <= Math.floor(field.end / bitsPerRow); row++) {
    pieces.push({ row, lo: Math.max(field.start, row * bitsPerRow), hi: Math.min(field.end, (row + 1) * bitsPerRow - 1) });
  }
  return pieces;
}

/** Lays out `data`'s rows in `size` below `top`. */
export function packetLayout(data: PacketData, size: { width: number; height: number }, top: number, theme: PlotTheme, measure: PlotMeasure): PacketLayout {
  const bitsPerRow = packetBitsPerRow(data);
  const ends = data.fields.filter((f) => f.start >= 0 && f.end >= f.start).map((f) => f.end);
  const rows = ends.length === 0 ? 0 : Math.floor(Math.max(...ends) / bitsPerRow) + 1;
  const line = measure('0', theme.font).height;
  const bits = bandScale({
    domain: Array.from({ length: bitsPerRow }, (_, i) => String(i)),
    range: [PAD, Math.max(PAD + 1, size.width - PAD)], paddingInner: 0, paddingOuter: 0,
  });
  return { bits, bitsPerRow, rows, boxTop: (row) => top + row * (line + INSET + BOX + GAP) + line + INSET, boxHeight: BOX };
}

function fieldMarks(field: PacketField, i: number, layout: PacketLayout, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const { bits, bitsPerRow, boxHeight } = layout;
  const marks: PlotMark[] = [];
  const font = { font: theme.font, color: theme.text, measure };
  let widest: { x0: number; x1: number; y: number } | null = null;
  for (const { row, lo, hi } of packetPieces(field, bitsPerRow)) {
    const x0 = bits.start(String(lo % bitsPerRow));
    const x1 = bits.start(String(hi % bitsPerRow)) + bits.bandwidth;
    const y = layout.boxTop(row);
    const box = spanMark({ key: `field:${i}:${row}`, x0, x1, y, height: boxHeight, color: seriesColor(theme, i), opacity: 0.3, datum: { field: i } });
    box.data.stroke = { paint: { color: theme.axis }, width: 1 };
    marks.push(box);
    if (widest === null || x1 - x0 > widest.x1 - widest.x0) widest = { x0, x1, y };
    const numberAt = { y: y - INSET, baseline: 'bottom' } as const;
    if (hi === lo) {
      marks.push(textMark({ ...font, ...numberAt, key: `bit:${i}:${row}:start`, text: String(lo), x: (x0 + x1) / 2 }));
      continue;
    }
    marks.push(textMark({ ...font, ...numberAt, key: `bit:${i}:${row}:start`, text: String(lo), x: x0 + INSET, anchor: 'start' }));
    marks.push(textMark({ ...font, ...numberAt, key: `bit:${i}:${row}:end`, text: String(hi), x: x1 - INSET, anchor: 'end' }));
  }
  if (widest !== null) {
    marks.push(textMark({
      ...font, key: `field:label:${i}`, text: field.label, x: (widest.x0 + widest.x1) / 2, y: widest.y + boxHeight / 2,
      datum: { edit: 'label', field: i },
    }));
  }
  return marks;
}

/** Lays out a packet in a box of `size`: its title, then its fields along rows of bits, each a box per row it covers
 *  with its label in the widest, and the bit numbers at each piece's ends above it. */
export function compilePacket(
  data: PacketData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: PacketLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const layout = packetLayout(data, size, top, theme, measure);
  data.fields.forEach((field, i) => marks.push(...fieldMarks(field, i, layout, theme, measure)));
  return { marks, layout };
}
