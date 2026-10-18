import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import { resolveParams } from '@weasel-js/routing';
import { snapMods } from 'features/snap/roles';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { InsertPoint } from '../../gestures/types';
import { computeBounds, effectiveOriginMode } from './geometry';
import { GESTURE_KEY, type InsertFrame, type InsertSession } from './session';

/**
 * Shape the raw pointer into the drag's endpoints: the snap session (with
 * the line kind's Shift step as its input subspace, about the snapped
 * start), then each behavior's `onMove`, each seeing the points the one
 * before it returned. A point a snap target holds is not moved by a
 * behavior.
 */
function shapeEndpoints(
  session: Pick<InsertSession, 'opts' | 'snap' | 'behaviors' | 'gestureCtx'>,
  readers: GestureReaders,
  raw: Pick<InsertFrame, 'pointer' | 'altHeld'>,
  moveCtx: Pick<InvocationCtx, 'modifiers' | 'screen' | 'roles'>,
): { start: InsertPoint; current: InsertPoint } {
  const gctx = session.gestureCtx;
  let start = gctx.origin.get(GESTURE_KEY) as InsertPoint;
  const end = session.snap.end(raw.pointer, snapMods(moveCtx));
  let current = end.point;

  if (session.behaviors.length > 0) {
    const resolved = resolveParams(session.opts?.params);
    const startHeld = session.snap.startHeld();
    gctx.modifiers = { ...moveCtx.modifiers };
    gctx.pointer = pointerStateOf(raw.pointer, moveCtx);
    gctx.view = readers.view();
    gctx.plane = readers.plane();
    gctx.current.set(GESTURE_KEY, current);
    const mode = effectiveOriginMode(resolved?.['originMode'], raw.altHeld);
    for (const b of session.behaviors) {
      const bounds = computeBounds(start.x, start.y, current.x, current.y, mode);
      const r = b.onMove?.(gctx, { start, current, bounds, pose: bounds });
      if (!r) continue;
      if (r.start && !startHeld) start = r.start;
      if (r.current && !end.held) current = r.current;
    }
    gctx.current.set(GESTURE_KEY, current);
  }
  return { start, current };
}

/** Move the drag's start point by the pointer's step from `from` to `to`, so
 *  the shape travels with the pointer instead of resizing. The start is
 *  carried unsnapped and snapped where it lands. */
export function carryStart(
  session: Pick<InsertSession, 'snap' | 'gestureCtx'>,
  from: InsertPoint,
  to: InsertPoint,
  moveCtx: Pick<InvocationCtx, 'modifiers' | 'roles'>,
): void {
  const landed = session.snap.carry(to.x - from.x, to.y - from.y, snapMods(moveCtx));
  session.gestureCtx.origin.set(GESTURE_KEY, landed.point);
}

/** One pump event's pointer, modifiers, and trail, and the endpoints they
 *  shape to. Each behavior's `onMove` runs once per call. */
export function nextFrame(
  session: InsertSession,
  readers: GestureReaders,
  prev: Pick<InsertFrame, 'points'>,
  moveCtx: InvocationCtx,
): InsertFrame {
  const raw = {
    pointer: { x: moveCtx.world.x, y: moveCtx.world.y },
    // Each pointermove carries fresh modifier state from the dispatcher;
    // releasing / pressing a key mid-drag takes effect on the next move tick
    // (true modifier-only events don't fire without a cursor change).
    altHeld: moveCtx.modifiers.alt,
  };
  return {
    ...raw,
    // The dispatcher mutates its own per-gesture trail in place but
    // attaches the array reference to each InvocationCtx.drag — keep
    // the latest reference in case the dispatcher swaps it.
    points: moveCtx.drag?.points ? moveCtx.drag.points : prev.points,
    shaped: shapeEndpoints(session, readers, raw, moveCtx),
  };
}
