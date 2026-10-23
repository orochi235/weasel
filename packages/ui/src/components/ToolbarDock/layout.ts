import type { ReactNode } from 'react';
import type { Corner } from 'windease';
import type { BarOrientation } from '../Bar';

/** Which edge of a ToolbarDock's container a dock runs along; a left or right dock lays its bars vertically. */
export type DockEdge = 'top' | 'bottom' | 'left' | 'right';

/** A place the host lets toolbars sit. */
export interface DockSpec {
  id: string;
  edge: DockEdge;
  /** A class for the dock's own element, holding its rows: the host's hook for styling one dock. */
  className?: string;
}

/** A toolbar the host offers, and the docks it may sit in. */
export interface DockBar {
  id: string;
  label: string;
  /** Ids of the docks this bar may sit in; the first is its default. */
  docks: readonly string[];
  /** Whether the bar may float free of every dock. */
  float?: boolean;
  /** Whether the bar may be turned vertical. */
  vertical?: boolean;
  render: (orientation: BarOrientation) => ReactNode;
}

/** Where a floating bar sits, and which corner of its container `x` and `y` measure from. */
export interface FloatPlace {
  x: number;
  y: number;
  anchor: Corner | null;
  orientation: BarOrientation;
}

/** Bars by dock id, as rows of bar ids, plus the bars that float. */
export interface ToolbarLayout {
  docks: Record<string, string[][]>;
  floating: Record<string, FloatPlace>;
}

/** Where a bar goes: a slot in a dock's row, a new row of its own at `row` with `newRow`, or a floating place. */
export type BarTarget = { dock: string; row: number; index: number; newRow?: boolean } | { float: FloatPlace };

/**
 * Reconciles a stored layout with the docks and bars the app has now. Every bar ends up
 * placed once; unknown ids are dropped, empty rows removed, and a bar that has nowhere
 * valid to sit goes to the end of the last row of its first allowed dock.
 */
export function resolveLayout(
  docks: readonly DockSpec[],
  bars: readonly DockBar[],
  layout: ToolbarLayout | undefined,
): ToolbarLayout {
  const byId = new Map(bars.map((b) => [b.id, b]));
  const out: ToolbarLayout = { docks: {}, floating: {} };
  for (const d of docks) out.docks[d.id] = [];
  const placed = new Set<string>();

  for (const d of docks) {
    for (const row of layout?.docks[d.id] ?? []) {
      const kept = row.filter((id) => {
        const bar = byId.get(id);
        if (!bar || placed.has(id) || !bar.docks.includes(d.id)) return false;
        placed.add(id);
        return true;
      });
      if (kept.length) out.docks[d.id].push(kept);
    }
  }

  for (const [id, at] of Object.entries(layout?.floating ?? {})) {
    if (placed.has(id) || !byId.get(id)?.float) continue;
    placed.add(id);
    out.floating[id] = { ...at };
  }

  for (const bar of bars) {
    if (placed.has(bar.id)) continue;
    const home = docks.find((d) => bar.docks.includes(d.id));
    if (home) {
      const rows = out.docks[home.id];
      if (rows.length) rows[rows.length - 1].push(bar.id);
      else rows.push([bar.id]);
    } else if (bar.float) {
      out.floating[bar.id] = { x: 0, y: 0, anchor: null, orientation: 'horizontal' };
    }
  }
  return out;
}

/** Takes a bar out of wherever it sits and places it at `to`. Does not check permissions. */
export function moveBar(layout: ToolbarLayout, barId: string, to: BarTarget): ToolbarLayout {
  const rowsOf = (rows: string[][]) => rows.map((r) => r.filter((id) => id !== barId));
  const out: ToolbarLayout = { docks: {}, floating: {} };
  for (const [dock, rows] of Object.entries(layout.docks)) out.docks[dock] = rowsOf(rows);
  for (const [id, at] of Object.entries(layout.floating)) if (id !== barId) out.floating[id] = at;

  if ('float' in to) {
    out.floating[barId] = { ...to.float };
  } else {
    const rows = (out.docks[to.dock] ??= []);
    if (to.newRow) rows.splice(Math.max(0, to.row), 0, [barId]);
    else if (to.row >= rows.length) rows.push([barId]);
    else rows[Math.max(0, to.row)].splice(Math.max(0, to.index), 0, barId);
  }
  for (const [dock, rows] of Object.entries(out.docks)) out.docks[dock] = rows.filter((r) => r.length);
  return out;
}
