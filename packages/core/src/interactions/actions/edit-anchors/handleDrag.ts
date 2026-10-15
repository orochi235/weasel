/**
 * The constraints on a control-handle drag — the angle and length locks, and
 * angle snapping — and the guides that show which one is holding.
 */
import type { ModifierState, OngoingOverlay } from '@weasel-js/routing';
import { handleAlongItsAngle, handleAtItsLength, snapHandleAngle } from '@weasel-js/geom';
import type { HandleLock, HandleSnapParams } from './params';

type Point = { x: number; y: number };

/** What the handle drag read at press: where the anchor and both its handles sat. */
export interface HandlePress {
  anchor: Point;
  handle: Point;
  /** The anchor's other handle, when it has one. */
  opposite: Point | null;
}

/** Where the handle goes this move, and the guides to draw for it. */
export interface ConstrainedHandle {
  to: Point;
  /** Which locks held: Shift or a forced `'angle'` holds the angle, Mod
   *  (Cmd or Ctrl) or a forced `'length'` the length. */
  locks: { angle: boolean; length: boolean };
  guides: OngoingOverlay[];
}

const DEFAULT_STEP_DEG = 45;
const DEFAULT_TOLERANCE_DEG = 6;
const CIRCLE_SEGMENTS = 64;

/** Constrain a handle dragged to `pointer` by the locks and snapping in force. */
export function constrainHandle(
  press: HandlePress,
  pointer: Point,
  modifiers: ModifierState,
  lock: HandleLock | null | undefined,
  snap: HandleSnapParams | null | undefined,
): ConstrainedHandle {
  const locks = {
    angle: lock === 'angle' || modifiers.shift,
    length: lock === 'length' || modifiers.meta || modifiers.ctrl,
  };
  const { anchor, handle } = press;
  const guides: OngoingOverlay[] = [];
  const len = Math.hypot(handle.x - anchor.x, handle.y - anchor.y);

  if (locks.angle && locks.length) return { to: { ...handle }, locks, guides: [axisGuide(anchor, handle, len, 'lock')] };
  if (locks.angle) {
    const to = handleAlongItsAngle(anchor, handle, pointer);
    return { to, locks, guides: [axisGuide(anchor, handle, Math.max(len, dist(anchor, to)), 'lock')] };
  }

  let to = locks.length ? handleAtItsLength(anchor, handle, pointer) : pointer;
  if (locks.length) guides.push(circleGuide(anchor, len));
  if (snap) {
    const snapped = snapHandleAngle(anchor, to, {
      stepDeg: snap.stepDeg ?? DEFAULT_STEP_DEG,
      toleranceDeg: snap.toleranceDeg ?? DEFAULT_TOLERANCE_DEG,
      opposite: snap.opposite === false ? null : press.opposite,
    });
    to = snapped.point;
    if (snapped.snapped) {
      const reach = dist(anchor, to);
      guides.push(snapped.snapped.kind === 'opposite' && press.opposite
        ? { kind: 'polyline', points: [press.opposite, anchor, extend(anchor, to, reach * 0.25)], role: 'snap' }
        : axisGuide(anchor, to, reach, 'snap'));
    }
  }
  return { to, locks, guides };
}

/** The line through `anchor` toward `toward`, reaching past it on both sides. */
function axisGuide(anchor: Point, toward: Point, reach: number, role: 'snap' | 'lock'): OngoingOverlay {
  const d = dist(anchor, toward);
  if (d === 0) return { kind: 'polyline', points: [anchor, anchor], role };
  const ux = (toward.x - anchor.x) / d;
  const uy = (toward.y - anchor.y) / d;
  const span = reach * 1.25;
  return {
    kind: 'polyline',
    points: [{ x: anchor.x - ux * span, y: anchor.y - uy * span }, { x: anchor.x + ux * span, y: anchor.y + uy * span }],
    role,
  };
}

function circleGuide(center: Point, r: number): OngoingOverlay {
  const points: Point[] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    points.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
  }
  return { kind: 'polyline', points, role: 'lock' };
}

function extend(from: Point, through: Point, by: number): Point {
  const d = dist(from, through);
  if (d === 0) return through;
  return { x: through.x + ((through.x - from.x) / d) * by, y: through.y + ((through.y - from.y) / d) * by };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
