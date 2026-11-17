/**
 * Wires the `resizePolicy` dep consumed by `resizeAction`. Omitted
 * `constraints` default to none; Shift's aspect lock is the snap session's.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { ResizePolicy, BoundsConstraint, RunLifecycleOptions } from '@weasel-js/core/engine';
import type { Bounds, ResizeOptions } from '@weasel-js/core';

/** Options for `useResizePolicyDepSource`. Each omitted field falls back to the kit
 *  default. */
export interface UseResizePolicyDepSourceOptions<TPose> extends RunLifecycleOptions {
  constraints?: TPose extends Bounds ? BoundsConstraint<TPose>[] : never[];
  expandIds?: (ids: string[]) => string[];
}

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY: readonly unknown[] = Object.freeze([]);

/** Publish how resizing should behave — constraints and group expansion —
 *  for the resize action to consult. */
export function useResizePolicyDepSource<TPose>(
  options: UseResizePolicyDepSourceOptions<TPose>,
): void {
  const optsRef = useLatest(options);

  useDepSource('resizePolicy', (): ResizePolicy<unknown> => {
    const o = optsRef.current;
    return {
      label: o.label,
      transient: o.transient,
      onRunStart: o.onRunStart,
      onRunEnd: o.onRunEnd,
      constraints: (o.constraints ?? (EMPTY as unknown[])) as ResizePolicy<unknown>['constraints'],
      expandIds: o.expandIds ?? IDENTITY_EXPAND,
    };
  });
}

/** `<SceneCanvas selectTool.resize>` as {@link useResizePolicyDepSource} options.
 *  `resizable` is read by `<SceneCanvas>` itself. */
export function resizePolicyOptions<TPose>(o: ResizeOptions<TPose>): UseResizePolicyDepSourceOptions<TPose> {
  return {
    constraints: o.behaviors as UseResizePolicyDepSourceOptions<TPose>['constraints'],
    expandIds: o.expandIds,
    label: o.resizeLabel,
    transient: o.transient,
    onRunStart: o.onRunStart,
    onRunEnd: o.onRunEnd,
  };
}
