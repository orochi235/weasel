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
/** Wide enough for a coordinate in the tens of thousands, sign included, at one decimal. */
const fixed = (n: Coord, digits = 1): string => serializedNumber(n).toFixed(digits).padStart(8, ' ');
const pair = (x: Coord, y: Coord, digits = 1): string => `${fixed(x, digits)} ${fixed(y, digits)}`;

export function CoordTable({ entries, now }: { entries: readonly Sequenced<CoordEntry>[]; now: number }): ReactElement {
  const rows = entries.slice(-DISPLAY_LIMIT).map(({ seq, record }) => ({ id: String(seq), entry: record })).reverse();
  const columns: readonly DataGridColumn<(typeof rows)[number]>[] = [
    { id: 'age', header: 'Age', sortable: false, className: s.age, render: ({ entry }) => formatAge(Math.max(0, now - entry.ts)) },
    { id: 'client', header: 'Client', sortable: false, className: s.count, render: ({ entry }) => pair(entry.clientX, entry.clientY) },
    {
      id: 'canvas',
      header: 'Canvas',
      sortable: false,
      className: s.count,
      render: ({ entry }) => (entry.rect ? pair(entry.rect.left, entry.rect.top) : ''),
    },
    { id: 'world', header: 'World', sortable: false, className: s.count, render: ({ entry }) => pair(entry.world.x, entry.world.y) },
    {
      id: 'scale',
      header: 'Scale',
      sortable: false,
      className: s.count,
      render: ({ entry }) => (entry.fallback || !entry.view ? 'fallback' : pair(entry.view.scaleX, entry.view.scaleY, 3)),
    },
    {
      id: 'offset',
      header: 'Offset',
      sortable: false,
      className: s.count,
      render: ({ entry }) => (entry.view ? pair(entry.view.x, entry.view.y) : ''),
    },
  ];
  return (
    <section aria-label="Coord records">
      <h3 className={s.heading}>Coords</h3>
      <DataGrid className={s.table} rows={rows} columns={columns} empty="No conversions recorded yet." />
    </section>
  );
}
