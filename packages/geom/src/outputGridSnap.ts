import type { Rect } from './box';
import type { OutputGrid } from './outputGrid';

/**
 * Snapping marks to an {@link OutputGrid}, so a vector mark prints as a
 * whole number of dots with its edges on dot boundaries instead of going to
 * whichever dot an edge covers more than half of.
 *
 * Everything here works in the grid's own frame: document units, with dot
 * rows and columns along the axes. A rect under a quarter turn is still a
 * rect in that frame and snaps as one. An edge at any other angle, under a
 * skew, or under perspective is not parallel to a dot row, and no snap puts
 * it on a boundary. A 3D host can use these only on a mark it has already
 * projected to the output's plane, and only where the projection is still an
 * axis-aligned rect (an orthographic camera square to the mark, no roll).
 */

/** One axis of an {@link OutputGrid}: a dot's size and where dot 0 starts. */
export interface GridAxis {
  pitch: number;
  origin: number;
}

/** The `x` or `y` axis of `grid`. */
export function gridAxis(grid: OutputGrid, axis: 'x' | 'y'): GridAxis {
  return { pitch: grid.pitch, origin: grid.origin[axis] };
}

/** The dot boundary nearest `v`, as a dot index. */
const boundary = (v: number, a: GridAxis): number => Math.round((v - a.origin) / a.pitch);

/**
 * `[start, start + length]` with both ends moved to the nearest dot boundary.
 * A span with any extent keeps at least one dot: one that would round to
 * nothing (a hairline) takes the whole dot its middle falls in. A span of
 * exactly zero stays zero. A negative length is read as the span it covers,
 * so the answer's length is never negative.
 */
export function snapSpanToGrid(start: number, length: number, axis: GridAxis): { start: number; length: number } {
  const lo = Math.min(start, start + length);
  const hi = Math.max(start, start + length);
  let a = boundary(lo, axis);
  let b = boundary(hi, axis);
  if (b === a && hi > lo) {
    a = Math.floor(((lo + hi) / 2 - axis.origin) / axis.pitch);
    b = a + 1;
  }
  return { start: axis.origin + a * axis.pitch, length: (b - a) * axis.pitch };
}

/**
 * `rect` with each edge on the nearest dot boundary of `grid`, keeping at
 * least one dot on any axis it has extent on (see {@link snapSpanToGrid}).
 * Each edge rounds on its own, so two rects of equal width can come out a dot
 * apart; marks whose widths must agree are a run, for {@link snapModuleRun}.
 */
export function snapRectToGrid(rect: Rect, grid: OutputGrid): Rect {
  const x = snapSpanToGrid(rect.x, rect.width, gridAxis(grid, 'x'));
  const y = snapSpanToGrid(rect.y, rect.height, gridAxis(grid, 'y'));
  return { x: x.start, y: y.start, width: x.length, height: y.length };
}

/** A run of marks and gaps measured in modules, the way a barcode is specified. */
export interface ModuleRun {
  /** Where the run's first edge sits, in document units. */
  start: number;
  /** One module's width, in document units. */
  module: number;
  /** Each element's width in modules, in order: for a barcode, bar, space, bar, …. */
  widths: readonly number[];
}

/** A {@link ModuleRun} on whole dots. */
export interface SnappedRun {
  /** Dots per module. */
  dots: number;
  /** The run's edges in document units: `widths.length + 1` of them, `edges[i]`
   *  to `edges[i + 1]` holding element `i`. */
  edges: number[];
}

/**
 * Lay out `run` on whole dots: the module rounds once, to `dots` whole dots
 * (the nearest count, at least one), and every element is its width in
 * modules times that. Equal modules print equal widths wherever the run
 * falls against the grid, which rounding each edge alone does not give.
 *
 * The start goes to the nearest boundary and the run grows from there, so the
 * run's total is `sum(widths) * dots` dots and its far end moves by however
 * much the module changed. Pass `dots` to fix the module instead, for a
 * symbology whose spec names a dot count. A fractional width rounds where its
 * running total lands, so the total still holds but that element can be a dot
 * off.
 */
export function snapModuleRun(run: ModuleRun, axis: GridAxis, options: { dots?: number } = {}): SnappedRun {
  const dots = options.dots ?? Math.max(1, Math.round(run.module / axis.pitch));
  const start = axis.origin + boundary(run.start, axis) * axis.pitch;
  const edges = [start];
  let modules = 0;
  for (const w of run.widths) {
    modules += w;
    edges.push(start + Math.round(modules * dots) * axis.pitch);
  }
  return { dots, edges };
}
