/**
 * `useResizeBehaviorsDepSource` — wires the `resizeBehaviors` dep consumed
 * by `resizeAction`. Mirrors the legacy `UseResizeOptions` surface:
 *
 *   - `behaviors`     — bounds-frame behaviors (e.g. `lockAspectWithModifier`).
 *   - `pointSnap`     — world-space anchor-point snap behaviors.
 *   - `expandIds`     — group-expansion at gesture start.
 *   - `geometry`      — pose↔bounds projection (`PoseDescriptor`).
 *
 * Every field is optional; omitted fields fall back to the same identity
 * defaults `useResize` applies (`[]`, `[]`, `ids => ids`,
 * `RECT_POSE_DESCRIPTOR`).
 *
 * Built once per render and stabilised by `useDepSource` (which reads via a
 * ref internally), so callers can pass fresh closures without triggering
 * re-registration.
 *
 * @see ResizeBehaviorsDep — the dep schema entry.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { ResizeBehaviorsDep } from 'interactions/actions/depSchema';
import type {
  PointSnapBehavior,
  ResizeBehavior,
  ResizePose,
} from 'interactions/gestures/types';
import {
  RECT_POSE_DESCRIPTOR,
  type PoseDescriptor,
} from 'interactions/actions/resize/geometry';

export interface UseResizeBehaviorsDepSourceOptions<TPose> {
  behaviors?: TPose extends ResizePose ? ResizeBehavior<TPose>[] : never[];
  pointSnap?: TPose extends ResizePose ? PointSnapBehavior<TPose>[] : never[];
  expandIds?: (ids: string[]) => string[];
  geometry?: PoseDescriptor<TPose>;
}

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY: readonly unknown[] = Object.freeze([]);

export function useResizeBehaviorsDepSource<TPose>(
  options: UseResizeBehaviorsDepSourceOptions<TPose>,
): void {
  const optsRef = useRef(options);
  optsRef.current = options;

  useDepSource('resizeBehaviors', (): ResizeBehaviorsDep<unknown> => {
    const o = optsRef.current;
    return {
      behaviors: (o.behaviors ?? (EMPTY as unknown[])) as ResizeBehaviorsDep<unknown>['behaviors'],
      pointSnap: (o.pointSnap ?? (EMPTY as unknown[])) as ResizeBehaviorsDep<unknown>['pointSnap'],
      expandIds: o.expandIds ?? IDENTITY_EXPAND,
      geometry: (o.geometry ?? RECT_POSE_DESCRIPTOR) as PoseDescriptor<unknown>,
    };
  });
}
