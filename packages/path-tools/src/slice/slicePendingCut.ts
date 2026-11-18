/** The knife's click-by-click cut: placing, taking back, committing and discarding its points. */
import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import { withinPxRadius } from '@weasel-js/geom';
import { createEmitter } from '@weasel-js/registry';
import { createPointerFollower, type PointerFollower } from '@weasel-js/editing';
import type {} from '../actionParamSchema';

/** The click-by-click cut in progress, in world coords. */
export interface SliceScratch {
  points: { x: number; y: number }[];
}

/** What the pending cut's overlay hears: a change to the points, and, while
 *  any are placed, every move of the pointer the rubber band follows. */
export interface SliceLive extends PointerFollower {
  notify: () => void;
  listen: (fn: () => void) => () => void;
}

export function createSliceLive(): SliceLive {
  const changed = createEmitter();
  return {
    notify: changed.emit,
    listen: changed.subscribe,
    ...createPointerFollower(changed.emit),
  };
}

/** Empty the cut and stop following the pointer. */
export function resetPendingCut(scratch: SliceScratch, live: SliceLive): void {
  scratch.points = [];
  live.unfollow();
  live.notify();
}

/** The actions that build a cut one point at a time. `closeHitPx` is read on
 *  each click: how near the first point, in screen px, a click closes the cut. */
export function createPendingCutActions(
  scratch: SliceScratch,
  live: SliceLive,
  closeHitPx: () => number,
): Action[] {
  const points = () => scratch.points;
  const pending = () => (points().length > 0 ? true : ActionDisabledReason.NotApplicable);
  const reset = () => resetPendingCut(scratch, live);

  const commit = (deps: ActionDeps): void => {
    const cut = points().slice();
    reset();
    if (cut.length >= 2) deps.slice?.commit(cut);
  };
  const place = (deps: ActionDeps, x: number, y: number): void => {
    const pts = points();
    const first = pts[0];
    const scale = deps.view?.get().scale ?? { x: 1, y: 1 };
    if (pts.length >= 3 && withinPxRadius(x - first.x, y - first.y, closeHitPx(), scale)) {
      pts.push({ x: first.x, y: first.y });
      commit(deps);
      return;
    }
    pts.push({ x, y });
    live.follow(deps.pointer);
    live.notify();
  };

  const eligible = { capability: 'edits-page' } as const;
  return [
    defineAction({
      id: 'slice.addPoint',
      label: 'Slice — place point',
      eligible,
      requires: ['slice', 'view', 'pointer'],
      enabled: (deps) => (deps?.['slice'] ? true : ActionDisabledReason.NotApplicable),
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const press = params?.press;
          if (!press) return;
          place(deps, press.x, press.y);
        },
      },
    }),
    {
      id: 'slice.dragPoint',
      label: 'Slice — drag out a point',
      eligible,
      requires: ['slice', 'view', 'pointer'],
      enabled: pending,
      invoker: {
        timing: 'ongoing',
        // The dispatcher hands `onEnd` a context with empty deps.
        start: ({ deps }: InvocationCtx) => ({
          onMove: () => {},
          onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
            if (reason === 'cancel' || points().length === 0) return;
            const at = endCtx.drag?.current ?? endCtx.world;
            place(deps, at.x, at.y);
          },
        }),
      },
    },
    defineAction({
      id: 'slice.finish',
      label: 'Slice — cut along the points',
      eligible,
      requires: ['slice'],
      enabled: pending,
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          // A double click arrives after both of its clicks, so the second
          // has already placed a point on top of the first.
          if (params?.viaDoubleClick) points().pop();
          commit(deps);
        },
      },
    }),
    {
      id: 'slice.dropPoint',
      label: 'Slice — take back the last point',
      eligible,
      enabled: pending,
      invoker: {
        timing: 'immediate',
        run: () => {
          points().pop();
          if (points().length === 0) reset();
          else live.notify();
        },
      },
    },
    {
      id: 'slice.cancel',
      label: 'Slice — discard the points',
      eligible,
      // Declining with nothing placed leaves Escape to the ambient `escape`.
      enabled: pending,
      invoker: { timing: 'immediate', run: () => reset() },
    },
  ];
}
