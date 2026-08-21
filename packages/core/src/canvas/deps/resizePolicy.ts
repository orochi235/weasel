/**
 * `useResizePolicy` — wires the `resizePolicy` dep consumed
 * by `resizeAction`.
 *
 *   - `constraints`   — bounds-frame constraints (e.g. `lockAspectWithModifier`).
 *   - `pointSnap`     — world-space anchor-point snap behaviors.
 *   - `expandIds`     — group-expansion at gesture start.
 *   - `projection`    — pose↔bounds projection (`PoseProjection`).
 *
 * Every field is optional; omitted fields fall back to kit defaults
 * (`DEFAULT_RESIZE_BEHAVIORS` — shift = aspect lock; pass `[]` to disable —
 * then `[]`, `ids => ids`, `AUTO_POSE_DESCRIPTOR`). The AUTO projection
 * dispatches per-call to `pathPoseDescriptor` for Path-shaped poses and
 * to `RECT_POSE_DESCRIPTOR` for everything else, so unwired path consumers
 * get correct translate/resize/intersect behavior without having to
 * thread `geometry` themselves.
 *
 * Built once per render and stabilised by `useDepSource` (which reads via a
 * ref internally), so callers can pass fresh closures without triggering
 * re-registration.
 *
 * @see ResizePolicy — the dep schema entry.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { ResizePolicy } from 'interactions/actions/depSchema';
import type {
  PointSnapBehavior,
  BoundsConstraint,
  ResizePose,
} from 'interactions/gestures/types';
import { type PoseProjection } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { DEFAULT_RESIZE_BEHAVIORS } from 'interactions/actions/resize/behaviors';

/** Options for `useResizePolicy`. Each omitted field falls back to the kit
 *  default. */
export interface UseResizePolicyOptions<TPose> {
  constraints?: TPose extends ResizePose ? BoundsConstraint<TPose>[] : never[];
  pointSnap?: TPose extends ResizePose ? PointSnapBehavior<TPose>[] : never[];
  expandIds?: (ids: string[]) => string[];
  projection?: PoseProjection<TPose>;
}

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY: readonly unknown[] = Object.freeze([]);

/** Publish how resizing should behave — constraints, point snapping, group
 *  expansion, pose projection — for the resize action to consult. */
export function useResizePolicy<TPose>(
  options: UseResizePolicyOptions<TPose>,
): void {
  const optsRef = useRef(options);
  optsRef.current = options;

  useDepSource('resizePolicy', (): ResizePolicy<unknown> => {
    const o = optsRef.current;
    return {
      constraints: (o.constraints ?? DEFAULT_RESIZE_BEHAVIORS) as ResizePolicy<unknown>['constraints'],
      pointSnap: (o.pointSnap ?? (EMPTY as unknown[])) as ResizePolicy<unknown>['pointSnap'],
      expandIds: o.expandIds ?? IDENTITY_EXPAND,
      projection: (o.projection ?? AUTO_POSE_DESCRIPTOR) as PoseProjection<unknown>,
    };
  });
}
