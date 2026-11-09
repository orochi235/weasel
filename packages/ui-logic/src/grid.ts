/**
 * Grids: a run of same-size items laid out `columns` across, in reading order,
 * with a short last row at its start, centered, at its end, or stretched across
 * the row. {@link tileGrid} says where each item sits and which of the grid's
 * outer corners it is on; {@link rovingGridTarget} walks it with the arrows,
 * so the two read one layout.
 */
import { rovingKey } from './list';

/** Where a last row shorter than the rest sits: at the start, centered, at the end, or with its items stretched
 *  across the whole row. */
export type LastRow = 'start' | 'center' | 'end' | 'fill';

/** How a run of items tiles. */
export interface Tiling {
  /** Items per row: a whole number, one for anything below one. */
  columns: number;
  /** Where a last row shorter than `columns` sits. Default `'start'`. */
  lastRow?: LastRow;
}

/** How far in, in columns, a row of `length` items sits in a grid `columns` across, aligned `align`. A
 *  stretched (`'fill'`) row starts at the start. */
export function rowOffset(length: number, columns: number, align: LastRow = 'start'): number {
  const gap = Math.max(0, columns - length);
  return align === 'center' ? gap / 2 : align === 'end' ? gap : 0;
}

/** Where a tiling's items sit on its tracks. */
export interface TileGrid {
  /** Tracks across: twice `columns`, so a short row can sit a half column in, or enough for both a full row and a
   *  stretched one to divide evenly. */
  tracks: number;
  /** Tracks a full row's item spans. */
  span: number;
  /** Tracks a stretched last row's item spans. */
  fillSpan: number;
  /** How far an offset last row sits from the start, in tracks; 0 for one at the start, stretched, or none. */
  lead: number;
  /** Index of the last row's first item. */
  lastStart: number;
  /** Whether item `i` is in a stretched last row. */
  stretched(i: number): boolean;
  /** The grid's outer corners item `i` sits on: `ss` top-left, `se` top-right, `es` bottom-left, `ee` bottom-right,
   *  in the inline direction. */
  corners(i: number): ('ss' | 'se' | 'es' | 'ee')[];
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A column count as a grid can lay out: its whole part, and one for anything below one or not a number. */
const wholeColumns = (columns: number): number => (columns >= 1 ? Math.floor(columns) : 1);

/** How `count` items tile under `spec`. */
export function tileGrid(count: number, spec: Tiling): TileGrid {
  const columns = wholeColumns(spec.columns);
  const lastRow = spec.lastRow ?? 'start';
  const short = count % columns;
  const lastStart = count - (short || columns);
  const filling = lastRow === 'fill' && short > 0;
  const tracks = filling ? (columns * short) / gcd(columns, short) : 2 * columns;
  const span = tracks / columns;
  const lead = short === 0 || lastRow === 'fill' ? 0 : span * rowOffset(short, columns, lastRow);
  // The last item reaches the end of its row when the row is full, stretched or end-aligned.
  const lastAtEnd = short === 0 || lastRow === 'fill' || lastRow === 'end';
  return {
    tracks,
    span,
    fillSpan: filling ? tracks / short : span,
    lead,
    lastStart,
    stretched: (i) => filling && i >= lastStart,
    corners: (i) => {
      const at: ('ss' | 'se' | 'es' | 'ee')[] = [];
      // A grid of one short row has that row's offset and end at its top as well.
      const single = count < columns;
      if (i === 0 && (lead === 0 || !single)) at.push('ss');
      if (i === Math.min(columns, count) - 1 && (lastAtEnd || !single)) at.push('se');
      if (i === lastStart && lead === 0) at.push('es');
      if (i === count - 1 && lastAtEnd) at.push('ee');
      return at;
    },
  };
}

/** How a grid's rows sit for {@link rovingGridTarget}. */
export interface GridLayout {
  dir?: 'ltr' | 'rtl';
  /** How many columns in each row's first item sits, by row: a short row centered in an even gap sits a half
   *  column in. Omitted rows start at column 0. */
  offsets?: readonly number[];
  /** How many columns wide each row's items are, by row: a stretched last row's are wider than one. Omitted
   *  rows' items are one column wide. */
  widths?: readonly number[];
}

/** The rows of `count` items `columns` across, as item indices in reading order. */
export function tileRows(count: number, across: number): number[][] {
  const columns = wholeColumns(across);
  return Array.from({ length: Math.ceil(count / columns) }, (_, r) =>
    Array.from({ length: Math.min(columns, count - r * columns) }, (_, j) => r * columns + j));
}

/** Where `key` takes focus from `current` among `count` items tiled by `spec`, by {@link rovingGridTarget}: null
 *  if it does not move it. Every item is enabled unless `enabled` says otherwise. */
export function tileKey(
  current: number,
  key: string,
  count: number,
  spec: Tiling,
  opts: { dir?: 'ltr' | 'rtl'; enabled?: readonly boolean[] } = {},
): number | null {
  const rows = tileRows(count, spec.columns);
  const enabled = opts.enabled ?? Array<boolean>(count).fill(true);
  return rovingGridTarget(current, key, enabled, rows, { dir: opts.dir, ...gridLayout(rows, spec.columns, spec.lastRow) });
}

/** The layout of `rows` in a grid `columns` across whose short rows sit as `lastRow` says. */
export function gridLayout(rows: readonly (readonly number[])[], across: number, lastRow: LastRow = 'start'): GridLayout {
  const columns = wholeColumns(across);
  const short = (row: readonly number[]): boolean => row.length < columns;
  return {
    offsets: rows.map((row) => (short(row) ? rowOffset(row.length, columns, lastRow) : 0)),
    widths: rows.map((row) => (short(row) && lastRow === 'fill' ? columns / row.length : 1)),
  };
}

/** Where one row sits: how far in its first item starts and how wide each item is, in columns. */
interface RowSpan { offset: number; width: number }

/** Which item of `row`, laid out as `at`, sits under the column span `lo`–`hi`: the one covering most of it,
 *  and of two covering it equally the later going down and the earlier going up, so Down then Up comes back.
 *  Under none, the nearest end. */
function itemUnder(row: readonly number[], at: RowSpan, lo: number, hi: number, down: boolean): number | undefined {
  let best = -1;
  let most = 0;
  for (let j = 0; j < row.length; j++) {
    const start = at.offset + j * at.width;
    const cover = Math.min(hi, start + at.width) - Math.max(lo, start);
    if (cover > most + 1e-9 || (down && cover > 0 && Math.abs(cover - most) <= 1e-9)) {
      best = j;
      most = cover;
    }
  }
  if (best >= 0) return row[best];
  const nearest = Math.round(((lo + hi) / 2 - at.offset) / at.width - 0.5);
  return row[Math.min(row.length - 1, Math.max(0, nearest))];
}

const isStop = (enabled: boolean): boolean => enabled;

/** Where `key` takes focus from `current` in a grid whose `rows` list item indices in reading order, or null if
 *  it does not move it. Left and Right step through the enabled items in reading order (swapped under `'rtl'`),
 *  wrapping, and Home and End go to the first and last. Up and Down move to the item under this one in the next
 *  row, by where each row sits, or to that row's nearest end when none is under it; they pass over rows where that
 *  item is disabled, and stop at the first and last rows. */
export function rovingGridTarget(
  current: number,
  key: string,
  enabled: readonly boolean[],
  rows: readonly (readonly number[])[],
  layout: GridLayout = {},
): number | null {
  const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  if (step === 0) {
    const moved = rovingKey(enabled, current, key, { canStop: isStop, orientation: 'horizontal', dir: layout.dir });
    return moved.handled ? moved.at : null;
  }
  const r = rows.findIndex((row) => row.includes(current));
  if (r < 0) return null;
  const at = (row: number): RowSpan => ({ offset: layout.offsets?.[row] ?? 0, width: layout.widths?.[row] ?? 1 });
  const here = at(r);
  const lo = here.offset + rows[r]!.indexOf(current) * here.width;
  for (let rr = r + step; rr >= 0 && rr < rows.length; rr += step) {
    const i = itemUnder(rows[rr]!, at(rr), lo, lo + here.width, step > 0);
    if (i !== undefined && enabled[i]) return i;
  }
  return null;
}
