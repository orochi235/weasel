/**
 * The locks on a control-handle drag — its angle, its length, or both — and
 * the guide that shows which one is holding.
 */
import type { ModifierState, OngoingOverlay } from '@weasel-js/routing';
import { handleAlongItsAngle, handleAtItsLength } from '@weasel-js/geom';
import type { HandleLocks } from './params';

type Point = { x: number; y: number };

/** Where a handle drag's anchor and handle sat at the press. */
export interface HandlePress {
  anchor: Point;
  handle: Point;
}

/** Where the handle goes this move, and the guide its lock draws. */
export interface LockedHandle {
  to: Point;
  /** The line or circle the handle is held to; null with no lock held. */
  guide: OngoingOverlay | null;
}

const CIRCLE_SEGMENTS = 64;
/** How far past the handle the angle guide reaches, as a share of its length. */
const LINE_OVERSHOOT = 1.25;

/** The locks in force: those `held` names, plus Shift for the angle and Mod
 *  (Cmd or Ctrl) for the length. */
export function locksInForce(held: HandleLocks, modifiers: ModifierState): HandleLocks {
  return {
    angle: held.angle || modifiers.shift,
    length: held.length || modifiers.meta || modifiers.ctrl,
  };
}

/** The handle dragged toward `pointer` under `locks`. */
export function lockHandle(press: HandlePress, pointer: Point, locks: HandleLocks): LockedHandle {
  const { anchor, handle } = press;
  const len = dist(anchor, handle);
  if (locks.angle && locks.length) return { to: { ...handle }, guide: lineGuide(anchor, handle, len) };
  if (locks.angle) {
    const to = handleAlongItsAngle(anchor, handle, pointer);
    return { to, guide: lineGuide(anchor, handle, Math.max(len, dist(anchor, to))) };
  }
  if (locks.length) return { to: handleAtItsLength(anchor, handle, pointer), guide: circleGuide(anchor, len) };
  return { to: pointer, guide: null };
}

/** The line through `anchor` toward `toward`, reaching past `reach` on both sides. */
function lineGuide(anchor: Point, toward: Point, reach: number): OngoingOverlay {
  const d = dist(anchor, toward);
  if (d === 0) return { kind: 'polyline', points: [anchor, anchor], role: 'lock' };
  const span = reach * LINE_OVERSHOOT;
  const ux = ((toward.x - anchor.x) / d) * span;
  const uy = ((toward.y - anchor.y) / d) * span;
  return {
    kind: 'polyline',
    points: [{ x: anchor.x - ux, y: anchor.y - uy }, { x: anchor.x + ux, y: anchor.y + uy }],
    role: 'lock',
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

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
