import type { Flat } from '@weasel-js/geom/nd';
import { fixedCornerOf } from 'interactions/actions/resize/cornerHandles';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { movingPoint } from './probes2d';

type Point = { x: number; y: number };

const PLANE: Flat = { at: [0, 0], dirs: [[1, 0], [0, 1]] };
const AXIS_STEP = Math.PI / 4;

/** `H`: the subspace of δ = pointer − press that the gesture's result stays
 *  in. `box` is the subject's drawn box at press, which an aspect lock needs. */
export function inputFlat(req: SnapBegin, mods: SnapMods, delta0: Point, box?: Bounds | null): Flat {
  const h = req.handle;
  if (h && (h.x === 'free') !== (h.y === 'free')) {
    return { at: [0, 0], dirs: [h.y === 'free' ? [1, 0] : [0, 1]] };
  }
  const c = req.constrain;
  if (!mods.constrain || c === undefined) return PLANE;
  if (c === 'axis') return stepLine(req.press, req.press, delta0, AXIS_STEP);
  if (c === 'aspect') {
    if (!box || !h) return PLANE;
    const fixed = fixedCornerOf(box, h);
    const moving = movingPoint(box, h);
    return { at: [0, 0], dirs: [[moving.x - fixed.x, moving.y - fixed.y]] };
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
