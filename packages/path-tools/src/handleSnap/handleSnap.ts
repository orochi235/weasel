/**
 * Handle snapping: a control handle dragged in path edit snaps its angle to
 * steps and to the line through the anchor's other handle, keeping its
 * length, and draws the line it snapped to.
 */
import type { OngoingOverlay } from '@weasel-js/routing';
import { anchorAt, snapHandleAngle } from '@weasel-js/geom';
import type { PathEditExtension } from '@weasel-js/core';

/** Angle snapping for a control-handle drag. */
export interface HandleSnapOptions {
  /** Snap to every multiple of this many degrees. Default 45; 0 turns the
   *  steps off and leaves only the opposite handle. */
  stepDeg?: number;
  /** How near, in degrees, the handle must come to an angle to snap. Default 6. */
  toleranceDeg?: number;
  /** Also snap onto the line through the anchor's other handle. Default true. */
  opposite?: boolean;
}

type Point = { x: number; y: number };

const DEFAULT_STEP_DEG = 45;
const DEFAULT_TOLERANCE_DEG = 6;
/** How far the step guide reaches past the handle on both sides, as a share of its length. */
const LINE_OVERSHOOT = 1.25;

/**
 * Handle snapping as a path-edit extension. `options` is read on every move,
 * so a change mid-drag reaches the drag; null or undefined leaves the handle
 * unsnapped. A held angle lock wins over the snap; a held length lock keeps
 * the length while the angle snaps.
 */
export function createHandleSnapExtension(
  options: () => HandleSnapOptions | null | undefined = () => ({}),
): PathEditExtension {
  return {
    id: 'handleSnap',
    drag(start) {
      if (start.part === 'anchor') return null;
      const pressed = anchorAt(start.anchors, start.anchorIndex);
      if (!pressed) return null;
      const anchor = { x: pressed.x, y: pressed.y };
      const other = start.part === 'controlIn' ? pressed.outHandle : pressed.inHandle;
      const opposite = other ? { x: other.x, y: other.y } : null;
      let guide: OngoingOverlay | null = null;
      return {
        handle(to, { locks }) {
          guide = null;
          const opts = options();
          if (!opts || locks.angle) return to;
          const snapped = snapHandleAngle(anchor, to, {
            stepDeg: opts.stepDeg ?? DEFAULT_STEP_DEG,
            toleranceDeg: opts.toleranceDeg ?? DEFAULT_TOLERANCE_DEG,
            opposite: opts.opposite === false ? null : opposite,
          });
          if (snapped.snapped) {
            guide = snapped.snapped.kind === 'opposite' && opposite
              ? oppositeGuide(opposite, anchor, snapped.point)
              : stepGuide(anchor, snapped.point);
          }
          return snapped.point;
        },
        overlays: () => (guide ? [guide] : []),
      };
    },
  };
}

/** The line from the opposite handle through the anchor, a quarter past the handle. */
function oppositeGuide(opposite: Point, anchor: Point, handle: Point): OngoingOverlay {
  const past = { x: handle.x + (handle.x - anchor.x) * 0.25, y: handle.y + (handle.y - anchor.y) * 0.25 };
  return { kind: 'polyline', points: [opposite, anchor, past], role: 'snap' };
}

/** The line through `anchor` toward `handle`, reaching past it on both sides. */
function stepGuide(anchor: Point, handle: Point): OngoingOverlay {
  const ux = (handle.x - anchor.x) * LINE_OVERSHOOT;
  const uy = (handle.y - anchor.y) * LINE_OVERSHOOT;
  return {
    kind: 'polyline',
    points: [{ x: anchor.x - ux, y: anchor.y - uy }, { x: anchor.x + ux, y: anchor.y + uy }],
    role: 'snap',
  };
}
