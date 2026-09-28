/**
 * `useResizePolicy` — wires the `resizePolicy` dep consumed
 * by `resizeAction`.
 *
 *   - `constraints`   — bounds-frame constraints (e.g. `lockAspectWithModifier`).
 *   - `pointSnap`     — world-space anchor-point snap behaviors.
 *   - `expandIds`     — group-expansion at gesture start.
 *   - `label`, `transient`, `onGestureStart`, `onGestureEnd` — the commit's
 *     history label and recording, and the gesture's lifecycle callbacks.
 *
 * Every field is optional; omitted fields fall back to kit defaults
 * (`DEFAULT_RESIZE_BEHAVIORS` — shift = aspect lock; pass `[]` to disable —
 * then `[]`, `ids => ids`).
 *
 * Built once per render and stabilised by `useDepSource` (which reads via a
 * ref internally), so callers can pass fresh closures without triggering
 * re-registration.
 *
 * @see ResizePolicy — the dep schema entry.
 */
import { useRef } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import type { ResizePolicy } from 'interactions/actions/depSchema';
import type {
  PointSnapBehavior,
  BoundsConstraint,
} from 'interactions/gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { DEFAULT_RESIZE_BEHAVIORS } from 'interactions/actions/resize/behaviors';
import type { GestureLifecycleOptions } from 'interactions/actions/gestureLifecycle';
import type { UseResizeOptions } from 'interactions/actions/resize/options';

/** Options for `useResizePolicy`. Each omitted field falls back to the kit
 *  default. */
export interface UseResizePolicyOptions<TPose> extends GestureLifecycleOptions {
  constraints?: TPose extends Bounds ? BoundsConstraint<TPose>[] : never[];
  pointSnap?: TPose extends Bounds ? PointSnapBehavior<TPose>[] : never[];
  expandIds?: (ids: string[]) => string[];
}

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY: readonly unknown[] = Object.freeze([]);

/** Publish how resizing should behave — constraints, point snapping, group
 *  expansion — for the resize action to consult. */
export function useResizePolicy<TPose>(
  options: UseResizePolicyOptions<TPose>,
): void {
  const optsRef = useRef(options);
  optsRef.current = options;

  useDepSource('resizePolicy', (): ResizePolicy<unknown> => {
    const o = optsRef.current;
    return {
      label: o.label,
      transient: o.transient,
      onGestureStart: o.onGestureStart,
      onGestureEnd: o.onGestureEnd,
      constraints: (o.constraints ?? DEFAULT_RESIZE_BEHAVIORS) as ResizePolicy<unknown>['constraints'],
      pointSnap: (o.pointSnap ?? (EMPTY as unknown[])) as ResizePolicy<unknown>['pointSnap'],
      expandIds: o.expandIds ?? IDENTITY_EXPAND,
    };
  });
}

/** `<SceneCanvas selectTool.resize>` as {@link useResizePolicy} options.
 *  `resizable` is read by `<SceneCanvas>` itself. */
export function resizePolicyOptions<TPose>(o: UseResizeOptions<TPose>): UseResizePolicyOptions<TPose> {
  return {
    constraints: o.behaviors as UseResizePolicyOptions<TPose>['constraints'],
    pointSnap: o.pointSnapBehaviors as UseResizePolicyOptions<TPose>['pointSnap'],
    expandIds: o.expandIds,
    label: o.resizeLabel,
    transient: o.transient,
    onGestureStart: o.onGestureStart,
    onGestureEnd: o.onGestureEnd,
  };
}
