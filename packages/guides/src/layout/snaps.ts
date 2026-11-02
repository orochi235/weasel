import type { DropTarget, LayoutSnap } from '@weasel-js/core';
import { distance2, rectContainsPointHalfOpen } from '@weasel-js/geom';

function nearestOf<TPose>(
  targets: DropTarget<TPose>[],
  pointer: { x: number; y: number },
): DropTarget<TPose> | null {
  if (targets.length === 0) return null;
  let best = targets[0];
  let bestD = distance2(best.origin, pointer);
  for (let i = 1; i < targets.length; i++) {
    const d = distance2(targets[i].origin, pointer);
    if (d < bestD) {
      bestD = d;
      best = targets[i];
    }
  }
  return best;
}

/** Snap policy that never picks a target — every drop is rejected, which is
 *  what a free-form container wants. */
export function none<TPose>(): LayoutSnap<TPose> {
  return { pickTarget: () => null };
}

/** Snap policy that always picks the target closest to the pointer, however
 *  far away it is. */
export function nearest<TPose>(): LayoutSnap<TPose> {
  return { pickTarget: (targets, pointer) => nearestOf(targets, pointer) };
}

/** Snap policy that picks the closest target, but only within `tolerance`
 *  world units — beyond that the drop is rejected. */
export function nearestWithin<TPose>(opts: { tolerance: number }): LayoutSnap<TPose> {
  const tol2 = opts.tolerance * opts.tolerance;
  return {
    pickTarget(targets, pointer) {
      const got = nearestOf(targets, pointer);
      if (got === null) return null;
      return distance2(got.origin, pointer) <= tol2 ? got : null;
    },
  };
}

/**
 * Region-aware snap. If the pointer falls inside any target's `hitBounds`,
 * that target wins; otherwise falls back to nearest-origin. Useful for
 * strategies whose targets are area-shaped (gutters, drop-zones, gridded
 * cells) rather than point-shaped.
 *
 * Pointer-in-multiple-bounds order: first match in iteration order wins, so
 * strategies should emit narrower/more-specific targets before broader ones
 * (e.g. row-gutter before tray-corner).
 */
export function containedThenNearest<TPose>(): LayoutSnap<TPose> {
  return {
    pickTarget(targets, pointer) {
      for (const t of targets) {
        if (t.hitBounds && rectContainsPointHalfOpen(t.hitBounds, pointer.x, pointer.y)) return t;
      }
      return nearestOf(targets, pointer);
    },
  };
}

interface CellMeta {
  cellRect: { x: number; y: number; width: number; height: number };
}

function isCellMeta(m: unknown): m is CellMeta {
  return (
    typeof m === 'object' &&
    m !== null &&
    'cellRect' in m &&
    typeof (m as { cellRect: unknown }).cellRect === 'object'
  );
}

/**
 * Backwards-compatible cell snap. Prefer `containedThenNearest` for new
 * strategies; this variant remains for `tileGrid` and any caller that puts
 * its cell rect in `meta.cellRect` rather than `hitBounds`.
 */
export function cellAt<TPose>(): LayoutSnap<TPose> {
  return {
    pickTarget(targets, pointer) {
      for (const t of targets) {
        if (t.hitBounds && rectContainsPointHalfOpen(t.hitBounds, pointer.x, pointer.y)) return t;
        if (isCellMeta(t.meta) && rectContainsPointHalfOpen(t.meta.cellRect, pointer.x, pointer.y)) return t;
      }
      return nearestOf(targets, pointer);
    },
  };
}
