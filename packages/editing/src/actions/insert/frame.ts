import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '@weasel-js/core';
import { resolveParams } from '@weasel-js/routing';
import { snapMods } from '@weasel-js/core/engine';
import type { GestureReaders } from '@weasel-js/core';
import type { InsertPoint } from '@weasel-js/core/engine';
import { insertRectFor, effectiveOriginMode } from './geometry';
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
    let shapedEnd = false;
    for (const b of session.behaviors) {
      const bounds = insertRectFor(start.x, start.y, current.x, current.y, mode);
      const r = b.onMove?.(gctx, { start, current, bounds, pose: bounds });
      if (!r) continue;
      if (r.start && !startHeld) start = r.start;
      if (r.current && !end.held) { current = r.current; shapedEnd = true; }
    }
    // The end the snap placed turns about the start as drawn, the behaviors' included.
    if (!shapedEnd && session.snap.anchor(start)) current = session.snap.end(raw.pointer, snapMods(moveCtx)).point;
    gctx.current.set(GESTURE_KEY, current);
  }
  return { start, current };
}

/** Move the drag's start point by the pointer's step from `from` to `to`, so
 *  the shape travels with the pointer instead of resizing. The start is
 *  carried unsnapped and snapped where it lands, in the container its site
 *  is carried into. */
export function carryStart(
  session: Pick<InsertSession, 'snap' | 'gestureCtx' | 'place' | 'startShift'>,
  from: InsertPoint,
  to: InsertPoint,
  moveCtx: Pick<InvocationCtx, 'modifiers' | 'roles'>,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // The site travels with the shape, and the container under it is the one the start snaps in.
  const { place } = session;
  place.site = { x: place.site.x + dx, y: place.site.y + dy };
  place.parent = place.parentAt(place.site);
  const landed = session.snap.carry(dx, dy, snapMods(moveCtx));
  // A snap target holds the start where it put it; otherwise the start keeps the behaviors' shaping.
  const shift = landed.held ? { x: 0, y: 0 } : session.startShift;
  const origin = { x: landed.point.x + shift.x, y: landed.point.y + shift.y };
  session.gestureCtx.origin.set(GESTURE_KEY, origin);
  session.snap.anchor(origin);
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
