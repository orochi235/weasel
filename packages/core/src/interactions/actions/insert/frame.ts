import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import { resolveParams } from '@weasel-js/routing';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { InsertPoint } from '../../gestures/types';
import { computeBounds, effectiveOriginMode, snapTo15Degrees } from './geometry';
import { GESTURE_KEY, type InsertFrame, type InsertSession } from './session';

/**
 * Shape the raw pointer into the drag's endpoints, in order: the line tool's
 * Shift-constrain (on the raw pointer, around the shaped start, so the locked
 * angle survives), the `snap` dep, then each behavior's `onMove`, each seeing
 * the points the one before it returned.
 */
function shapeEndpoints(
  session: Pick<InsertSession, 'opts' | 'snap' | 'behaviors' | 'gestureCtx'>,
  readers: GestureReaders,
  raw: Pick<InsertFrame, 'pointer' | 'altHeld' | 'shiftHeld'>,
  moveCtx: Pick<InvocationCtx, 'modifiers' | 'screen'>,
): { start: InsertPoint; current: InsertPoint } {
  const resolved = resolveParams(session.opts?.params);
  const kind = (resolved?.['kind'] as string | undefined) ?? 'rect';
  const gctx = session.gestureCtx;
  let start = gctx.origin.get(GESTURE_KEY) as InsertPoint;
  let current = { x: raw.pointer.x, y: raw.pointer.y };
  if (kind === 'line' && raw.shiftHeld) {
    current = snapTo15Degrees(start, current);
  }
  current = session.snap(current);

  if (session.behaviors.length > 0) {
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
      if (r.start) start = r.start;
      if (r.current) current = r.current;
    }
    gctx.current.set(GESTURE_KEY, current);
  }
  return { start, current };
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
    shiftHeld: moveCtx.modifiers.shift,
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
