/** `clientToWorld` conversions, newest first: where the pointer was, where the canvas sat, the camera it was read under, and the world point it became. */
import type { ReactElement } from 'react';
import { serializedNumber, type SerializedValue } from '../protocol';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { formatAge } from './formatAge';
import type { Sequenced } from './sequenced';
import s from './TraceTable.module.css';

/** A coordinate as it crosses: a number, or a tag for one that is not finite. */
type Coord = SerializedValue;

/** One coord record, as the canvas writes it and serialization delivers it. */
export interface CoordEntry {
  ts: number;
  clientX: Coord;
  clientY: Coord;
  /** The canvas's box in client space when the conversion ran; null on the fallback. */
  rect: { left: Coord; top: Coord; width: Coord; height: Coord } | null;
  view: { x: Coord; y: Coord; scaleX: Coord; scaleY: Coord } | null;
  world: { x: Coord; y: Coord };
  fallback: boolean;
}

const DISPLAY_LIMIT = 100;
/** A coordinate in the tens of thousands, sign included, at one decimal; wider values widen their column. */
const MIN_WIDTH = 8;

/** A cell's x and y at its decimals, or the text it shows in their place. */
type Pair = readonly [x: Coord, y: Coord, digits: number] | string;
type Row = { id: string; entry: CoordEntry };

const COLUMNS: readonly { id: string; header: string; pair(e: CoordEntry): Pair }[] = [
  { id: 'client', header: 'Client', pair: (e) => [e.clientX, e.clientY, 1] },
  { id: 'canvas', header: 'Canvas', pair: (e) => (e.rect ? [e.rect.left, e.rect.top, 1] : '') },
  { id: 'world', header: 'World', pair: (e) => [e.world.x, e.world.y, 1] },
  { id: 'scale', header: 'Scale', pair: (e) => (e.fallback || !e.view ? 'fallback' : [e.view.scaleX, e.view.scaleY, 3]) },
  { id: 'offset', header: 'Offset', pair: (e) => (e.view ? [e.view.x, e.view.y, 1] : '') },
];

const fixed = (n: Coord, digits: number): string => serializedNumber(n).toFixed(digits);

function widthOf(pairs: readonly Pair[]): number {
  let width = MIN_WIDTH;
  for (const p of pairs) if (typeof p !== 'string') width = Math.max(width, fixed(p[0], p[2]).length, fixed(p[1], p[2]).length);
  return width;
}

const show = (p: Pair, width: number): string =>
  typeof p === 'string' ? p : `${fixed(p[0], p[2]).padStart(width, ' ')} ${fixed(p[1], p[2]).padStart(width, ' ')}`;

export function CoordTable({ entries, now }: { entries: readonly Sequenced<CoordEntry>[]; now: number }): ReactElement {
  const rows: Row[] = entries.slice(-DISPLAY_LIMIT).map(({ seq, record }) => ({ id: String(seq), entry: record })).reverse();
  const columns: readonly DataGridColumn<Row>[] = [
    { id: 'age', header: 'Age', sortable: false, className: s.age, render: ({ entry }) => formatAge(Math.max(0, now - entry.ts)) },
    ...COLUMNS.map(({ id, header, pair }): DataGridColumn<Row> => {
      const width = widthOf(rows.map((r) => pair(r.entry)));
      return { id, header, sortable: false, className: s.count, render: ({ entry }) => show(pair(entry), width) };
    }),
  ];
  return (
    <section aria-label="Coord records">
      <h3 className={s.heading}>Coords</h3>
      <DataGrid className={s.table} rows={rows} columns={columns} empty="No conversions recorded yet." />
    </section>
  );
}
