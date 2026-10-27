import type { ResizeAnchor } from '@weasel-js/routing';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { fixedCornerOf, movedEdges, movingPoint } from 'interactions/actions/resize/cornerHandles';
import type { SnapResizeBox } from 'interactions/actions/snapDep';
import type { SnapEdge, SnapEdges, SnapProbeAt } from './types';
import type { Point } from '@weasel-js/geom';

export const EPS = 1e-9;

/** A resize's box with its frame read out, in ctx coordinates. */
export interface ResizeSubject {
  /** In the box's own frame. */
  bounds: Bounds;
  handle: ResizeAnchor;
  at(p: Point): Point;
  /** Where the frame's unit axes point. */
  ex: Point;
  ey: Point;
}

export function resizeSubject(box: SnapResizeBox, handle: ResizeAnchor): ResizeSubject {
  const at = box.toWorld ?? ((p: Point) => p);
  const o = at({ x: 0, y: 0 });
  const ax = at({ x: 1, y: 0 });
  const ay = at({ x: 0, y: 1 });
  return { bounds: box.bounds, handle, at, ex: { x: ax.x - o.x, y: ax.y - o.y }, ey: { x: ay.x - o.x, y: ay.y - o.y } };
}

/** The dragged corner or edge midpoint as `pointer`, and as `box` the dragged
 *  corner or both ends of the dragged edge: the points a drag δ moves by δ. */
export function resizeProbes(s: ResizeSubject): SnapProbeAt[] {
  const { bounds: b, handle } = s;
  const out: SnapProbeAt[] = [{ id: 'pointer', at: s.at(movingPoint(b, handle)), role: 'pointer' }];
  const sides = (pin: ResizeAnchor['x'], lo: number, size: number): number[] =>
    pin === 'min' ? [lo + size] : pin === 'max' ? [lo] : [lo, lo + size];
  const xs = sides(handle.x, b.x, b.width);
  const ys = sides(handle.y, b.y, b.height);
  if (xs.length === 2 && ys.length === 2) return out;
  for (const x of xs) for (const y of ys) out.push({ id: `box.${out.length - 1}`, at: s.at({ x, y }), role: 'box' });
  return out;
}

/** The direction an edge handle's edge moves along; null for a corner. */
export function edgeAxis(s: ResizeSubject): Point | null {
  const { x, y } = s.handle;
  if ((x === 'free') === (y === 'free')) return null;
  return y === 'free' ? s.ex : s.ey;
}

/** From the fixed corner to the dragged one. */
export function diagonal(s: ResizeSubject): Point {
  const f = s.at(fixedCornerOf(s.bounds, s.handle));
  const m = s.at(movingPoint(s.bounds, s.handle));
  return { x: m.x - f.x, y: m.y - f.y };
}

/** The box in its own frame once the handle has moved by `delta`. */
function movedBox(s: ResizeSubject, delta: Point): Bounds {
  const det = s.ex.x * s.ey.y - s.ey.x * s.ex.y;
  const local = Math.abs(det) < EPS
    ? { x: 0, y: 0 }
    : { x: (s.ey.y * delta.x - s.ey.x * delta.y) / det, y: (s.ex.x * delta.y - s.ex.y * delta.x) / det };
  return movedEdges(s.bounds, s.handle, local.x, local.y);
}

/** The box's axis-aligned extent once the handle has moved by `delta`. */
export function resizedBox(s: ResizeSubject, delta: Point): Bounds {
  const b = movedBox(s, delta);
  const corners = [
    s.at({ x: b.x, y: b.y }), s.at({ x: b.x + b.width, y: b.y }),
    s.at({ x: b.x, y: b.y + b.height }), s.at({ x: b.x + b.width, y: b.y + b.height }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** The sides of {@link resizedBox} a drag of `delta` moves: the side across
 *  from the pinned one, or the pinned side's once the drag has flipped the
 *  box past it. A frame that turns or flips the box moves no side of its
 *  extent alone. */
export function resizeEdges(s: ResizeSubject, delta: Point): SnapEdges {
  const square = Math.abs(s.ex.y) < EPS && Math.abs(s.ey.x) < EPS && s.ex.x > 0 && s.ey.y > 0;
  if (!square) return { x: null, y: null };
  const b = movedBox(s, delta);
  const moved = (pin: ResizeAnchor['x'], size: number): SnapEdge => {
    if (pin === 'free') return null;
    const far = pin === 'min' ? 'max' : 'min';
    return size >= 0 ? far : pin;
  };
  return { x: moved(s.handle.x, b.width), y: moved(s.handle.y, b.height) };
}
