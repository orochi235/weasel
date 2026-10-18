import { stepLine, type Flat } from '@weasel-js/geom/nd';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { diagonal, edgeAxis, type ResizeSubject } from './resizeBox';
import { SNAP_AXIS_STEP } from './roles';

type Point = { x: number; y: number };

const PLANE: Flat = { at: [0, 0], dirs: [[1, 0], [0, 1]] };
const AXES = [[1, 0], [0, 1]] as const;

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
  if (c === 'axis') return stepLine([0, 0], [delta0.x, delta0.y], AXES, SNAP_AXIS_STEP);
  if (c === 'aspect') {
    if (!resize || !h) return PLANE;
    const d = diagonal(resize);
    return { at: [0, 0], dirs: [[d.x, d.y]] };
  }
  const origin = req.origin ?? req.press;
  return stepLine([origin.x - req.press.x, origin.y - req.press.y], [delta0.x, delta0.y], AXES, c.step);
}
