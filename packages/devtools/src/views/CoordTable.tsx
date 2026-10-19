/** `clientToWorld` conversions, newest first: where the pointer was, the camera it was read under, and the world point it became. */
import type { ReactElement } from 'react';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { formatAge } from './formatAge';
import s from './TraceTable.module.css';

/** One coord record, as the canvas writes it. */
export interface CoordEntry {
  ts: number;
  clientX: number;
  clientY: number;
  view: { x: number; y: number; scaleX: number; scaleY: number } | null;
  world: { x: number; y: number };
  fallback: boolean;
}

const DISPLAY_LIMIT = 100;
/** Wide enough for a coordinate in the tens of thousands, sign included, at one decimal. */
const fixed = (n: number, digits = 1): string => n.toFixed(digits).padStart(8, ' ');
const pair = (x: number, y: number): string => `${fixed(x)} ${fixed(y)}`;

export function CoordTable({ entries, now }: { entries: readonly CoordEntry[]; now: number }): ReactElement {
  const rows = entries.slice(-DISPLAY_LIMIT).map((entry, i) => ({ id: `${entry.ts}-${i}`, entry })).reverse();
  const columns: readonly DataGridColumn<(typeof rows)[number]>[] = [
    { id: 'age', header: 'Age', sortable: false, className: s.age, render: ({ entry }) => formatAge(Math.max(0, now - entry.ts)) },
    { id: 'client', header: 'Client', sortable: false, className: s.count, render: ({ entry }) => pair(entry.clientX, entry.clientY) },
    { id: 'world', header: 'World', sortable: false, className: s.count, render: ({ entry }) => pair(entry.world.x, entry.world.y) },
    {
      id: 'scale',
      header: 'Scale',
      sortable: false,
      className: s.count,
      render: ({ entry }) => (entry.view ? fixed(entry.view.scaleX, 3) : 'fallback'),
    },
  ];
  return (
    <section aria-label="Coord records">
      <h3 className={s.heading}>Coords</h3>
      <DataGrid className={s.table} rows={rows} columns={columns} empty="No conversions recorded yet." />
    </section>
  );
}
