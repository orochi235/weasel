import type { Flat } from '@weasel-js/geom/nd';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { diagonal, edgeAxis, type ResizeSubject } from './resizeBox';

type Point = { x: number; y: number };

const PLANE: Flat = { at: [0, 0], dirs: [[1, 0], [0, 1]] };
const AXIS_STEP = Math.PI / 4;

/** `H`: the subspace of δ = pointer − press that the gesture's result stays
 *  in. `resize` is the box a resize drags, which an edge handle's axis and an
 *  aspect lock are read from; without it they run along the ctx axes. */
export function inputFlat(req: SnapBegin, mods: SnapMods, delta0: Point, resize?: ResizeSubject | null): Flat {
  const h = req.handle;
  if (h && (h.x === 'free') !== (h.y === 'free')) {
    const axis = resize ? edgeAxis(resize)! : h.y === 'free' ? { x: 1, y: 0 } : { x: 0, y: 1 };
    return { at: [0, 0], dirs: [[axis.x, axis.y]] };
  }
  const c = req.constrain;
  if (!mods.constrain || c === undefined) return PLANE;
  if (c === 'axis') return stepLine(req.press, req.press, delta0, AXIS_STEP);
  if (c === 'aspect') {
    if (!resize || !h) return PLANE;
    const d = diagonal(resize);
    return { at: [0, 0], dirs: [[d.x, d.y]] };
  }
  return stepLine(req.press, req.origin ?? req.press, delta0, c.step);
}

/** The line through `origin` at the multiple of `step` nearest the
 *  direction from `origin` to the unsnapped point, in δ-space. */
function stepLine(press: Point, origin: Point, delta0: Point, step: number): Flat {
  const vx = press.x + delta0.x - origin.x;
  const vy = press.y + delta0.y - origin.y;
  const theta = vx === 0 && vy === 0 ? 0 : Math.round(Math.atan2(vy, vx) / step) * step;
  return { at: [origin.x - press.x, origin.y - press.y], dirs: [[Math.cos(theta), Math.sin(theta)]] };
}
