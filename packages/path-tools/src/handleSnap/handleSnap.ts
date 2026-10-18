/**
 * Handle snapping: a control handle dragged in path edit snaps its angle to
 * steps and to the line through the anchor's other handle, keeping its
 * length. The drag runs a `'handle'` snap session about the anchor, and
 * {@link handleSnapSource} offers it the angles.
 */
import { anchorAt } from '@weasel-js/geom';
import type { AngleCandidate, PathEditExtension, SnapMark, SnapSession, SnapSource } from '@weasel-js/core';

/** Angle snapping for a control-handle drag. */
export interface HandleSnapOptions {
  /** Snap to every multiple of this many degrees. Default 45; 0 turns the
   *  steps off and leaves only the opposite handle. */
  stepDeg?: number;
  /** How near, in degrees, the handle must come to an angle to snap. Read
   *  by the drag as it starts. Default 6. */
  reachDeg?: number;
  /** Also snap onto the line through the anchor's other handle. Default true. */
  opposite?: boolean;
}

/** Options, or a thunk read on every move: null or undefined from it leaves
 *  the handle unsnapped. */
export type HandleSnapOptionsInput = HandleSnapOptions | (() => HandleSnapOptions | null | undefined);

type Point = { x: number; y: number };

const DEG = Math.PI / 180;
const DEFAULT_STEP_DEG = 45;
const DEFAULT_REACH_DEG = 6;
/** How far a guide reaches past the handle, as a share of its length at the press. */
const LINE_OVERSHOOT = 1.25;

const reader = (options: HandleSnapOptionsInput) => (typeof options === 'function' ? options : () => options);

/**
 * A handle drag's angle targets: the multiples of `stepDeg` either side of
 * the handle, and the angle that puts it in line with the anchor's other
 * handle, which the drag brings as `also.anchors`. Each draws its line.
 */
export function handleSnapSource(options: HandleSnapOptionsInput = {}): SnapSource {
  const read = reader(options);
  return {
    id: 'handle',
    roles: [],
    gestures: ['handle'],
    collect: () => [],
    *angles(q): Iterable<AngleCandidate> {
      const opts = read();
      if (!opts) return;
      const { pivot } = q;
      const reach = Math.hypot(q.press.x - pivot.x, q.press.y - pivot.y) * LINE_OVERSHOOT;
      // First, so the opposite handle wins a tie with a step.
      for (const other of opts.opposite === false ? [] : q.also?.anchors ?? []) {
        if (other.x === pivot.x && other.y === pivot.y) continue;
        const angle = Math.atan2(pivot.y - other.y, pivot.x - other.x);
        yield { angle, mark: { kind: 'line', from: other, to: along(pivot, angle, reach) } };
      }
      const step = (opts.stepDeg ?? DEFAULT_STEP_DEG) * DEG;
      if (step <= 0) return;
      const k = Math.round(q.theta / step);
      for (const angle of [k - 1, k, k + 1].map((i) => i * step)) yield { angle, mark: stepLine(pivot, angle, reach) };
    },
  };
}

/**
 * Handle snapping as a path-edit extension: each control-handle drag runs a
 * `'handle'` session on the canvas's `snap` dep, in polar coordinates about
 * its anchor, and the handle keeps the length the pointer and the locks give
 * it. A held angle lock holds the angle; a held length lock keeps the length
 * while the angle snaps. The angles come from {@link handleSnapSource}, which
 * `createHandleSnapPreset` registers beside it.
 */
export function createHandleSnapExtension(options: HandleSnapOptionsInput = {}): PathEditExtension {
  const read = reader(options);
  return {
    id: 'handleSnap',
    drag(start) {
      if (start.part === 'anchor') return null;
      const pressed = anchorAt(start.anchors, start.anchorIndex);
      const handle = start.part === 'controlIn' ? pressed?.inHandle : pressed?.outHandle;
      if (!pressed || !handle) return null;
      const anchor = { x: pressed.x, y: pressed.y };
      const other = start.part === 'controlIn' ? pressed.outHandle : pressed.inHandle;
      const session: SnapSession | undefined = start.snap?.begin?.({
        gesture: 'handle',
        press: { x: handle.x, y: handle.y },
        pivot: anchor,
        ids: [start.id],
        theta0: Math.atan2(handle.y - anchor.y, handle.x - anchor.x),
        reachRad: (read()?.reachDeg ?? DEFAULT_REACH_DEG) * DEG,
        ...(other ? { also: { anchors: [{ x: other.x, y: other.y }] } } : {}),
      });
      if (!session) return null;
      return {
        handle(to, { locks }) {
          const dx = to.x - anchor.x;
          const dy = to.y - anchor.y;
          const len = Math.hypot(dx, dy);
          const off = !read() || len === 0;
          const { theta } = session.angle(Math.atan2(dy, dx), { suspend: off, constrain: false, hold: locks.angle });
          if (off || locks.angle) return to;
          return along(anchor, theta, len);
        },
        end: () => session.end(),
      };
    },
  };
}

function along(from: Point, angle: number, len: number): Point {
  return { x: from.x + Math.cos(angle) * len, y: from.y + Math.sin(angle) * len };
}

/** The line through `pivot` at `angle`, `reach` either side of it. */
function stepLine(pivot: Point, angle: number, reach: number): SnapMark {
  return { kind: 'line', from: along(pivot, angle + Math.PI, reach), to: along(pivot, angle, reach) };
}
