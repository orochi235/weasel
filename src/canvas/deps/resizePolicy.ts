/**
 * `useResizePolicy` — wires the `resizePolicy` dep consumed
 * by `resizeAction`.
 *
 *   - `constraints`   — bounds-frame constraints (e.g. `lockAspectWithModifier`).
 *   - `pointSnap`     — world-space anchor-point snap behaviors.
 *   - `expandIds`     — group-expansion at gesture start.
 *   - `projection`    — pose↔bounds projection (`PoseProjection`).
 *
 * Every field is optional; omitted fields fall back to the same identity
 * defaults `useResize` applies (`[]`, `[]`, `ids => ids`,
 * `RECT_POSE_DESCRIPTOR`).
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
import {
  RECT_POSE_DESCRIPTOR,
  type PoseProjection,
} from 'interactions/actions/resize/geometry';

export interface UseResizePolicyOptions<TPose> {
  constraints?: TPose extends ResizePose ? BoundsConstraint<TPose>[] : never[];
  pointSnap?: TPose extends ResizePose ? PointSnapBehavior<TPose>[] : never[];
  expandIds?: (ids: string[]) => string[];
  projection?: PoseProjection<TPose>;
}

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY: readonly unknown[] = Object.freeze([]);

export function useResizePolicy<TPose>(
  options: UseResizePolicyOptions<TPose>,
): void {
  const optsRef = useRef(options);
  optsRef.current = options;

  useDepSource('resizePolicy', (): ResizePolicy<unknown> => {
    const o = optsRef.current;
    return {
      constraints: (o.constraints ?? (EMPTY as unknown[])) as ResizePolicy<unknown>['constraints'],
      pointSnap: (o.pointSnap ?? (EMPTY as unknown[])) as ResizePolicy<unknown>['pointSnap'],
      expandIds: o.expandIds ?? IDENTITY_EXPAND,
      projection: (o.projection ?? RECT_POSE_DESCRIPTOR) as PoseProjection<unknown>,
    };
  });
}
