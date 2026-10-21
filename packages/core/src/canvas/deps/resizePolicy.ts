/**
 * Wires the `resizePolicy` dep consumed by `resizeAction`. Omitted
 * `constraints` default to none; Shift's aspect lock is the snap session's.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { ResizePolicy } from 'interactions/actions/depSchema';
import type { BoundsConstraint } from 'interactions/gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { GestureLifecycleOptions } from 'interactions/actions/gestureLifecycle';
import type { UseResizeOptions } from 'interactions/actions/resize/options';

/** Options for `useResizePolicy`. Each omitted field falls back to the kit
 *  default. */
export interface UseResizePolicyOptions<TPose> extends GestureLifecycleOptions {
  constraints?: TPose extends Bounds ? BoundsConstraint<TPose>[] : never[];
  expandIds?: (ids: string[]) => string[];
}

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY: readonly unknown[] = Object.freeze([]);

/** Publish how resizing should behave — constraints and group expansion —
 *  for the resize action to consult. */
export function useResizePolicy<TPose>(
  options: UseResizePolicyOptions<TPose>,
): void {
  const optsRef = useLatest(options);

  useDepSource('resizePolicy', (): ResizePolicy<unknown> => {
    const o = optsRef.current;
    return {
      label: o.label,
      transient: o.transient,
      onGestureStart: o.onGestureStart,
      onGestureEnd: o.onGestureEnd,
      constraints: (o.constraints ?? (EMPTY as unknown[])) as ResizePolicy<unknown>['constraints'],
      expandIds: o.expandIds ?? IDENTITY_EXPAND,
    };
  });
}

/** `<SceneCanvas selectTool.resize>` as {@link useResizePolicy} options.
 *  `resizable` is read by `<SceneCanvas>` itself. */
export function resizePolicyOptions<TPose>(o: UseResizeOptions<TPose>): UseResizePolicyOptions<TPose> {
  return {
    constraints: o.behaviors as UseResizePolicyOptions<TPose>['constraints'],
    expandIds: o.expandIds,
    label: o.resizeLabel,
    transient: o.transient,
    onGestureStart: o.onGestureStart,
    onGestureEnd: o.onGestureEnd,
  };
}
