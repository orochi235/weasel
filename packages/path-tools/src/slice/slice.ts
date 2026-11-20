import { defineAction, resolveParams } from '@weasel-js/routing';
import type { Action, InvocationCtx, OngoingHandle, OngoingOverlay, Point2 } from '@weasel-js/routing';
import { pathOperationTags } from '@weasel-js/core';
import type {} from '../actionParamSchema';
import * as groups from '@weasel-js/editing/groups';
import { sliceCommitOf, type SliceOptions } from './slicePaths';

/**
 * The `slice` Action, committing its cuts as `options` says: through
 * `slicePaths`, which cuts every path the cut crosses, unless `options.commit`
 * replaces it.
 *
 * Ongoing drag invoker: tracks the cut while the gesture is in flight,
 * publishes it as a `'cut'` overlay, and on commit hands it to the commit.
 *
 * The cut is a straight line from drag start to the pointer by default. With
 * the binding param `cut: 'freehand'` it is the whole drag trail instead.
 */
export function createSliceAction(options: SliceOptions = {}): Action {
  const { commit, requires } = sliceCommitOf(options);
  return defineAction({
    id: 'slice',
    label: 'Slice',
    tags: pathOperationTags('click'),
    group: groups.edit,
    eligible: { capability: 'edits-page' },
    requires: [...requires],
    invoker: {
      timing: 'ongoing',
      start(ctx, opts): OngoingHandle {
        // The dispatcher hands an ongoing handle's onEnd no deps, so the commit gets these.
        const { deps } = ctx;
        const a: Point2 = ctx.drag?.start ?? ctx.world;
        let current: Point2 = ctx.drag?.current ?? ctx.world;
        let trail: ReadonlyArray<Point2> | undefined;
        let open = true;

        const freehand = () => resolveParams(opts?.params)?.cut === 'freehand';
        const cut = (): Point2[] =>
          freehand() && trail && trail.length >= 2
            ? trail.map((p) => ({ x: p.x, y: p.y }))
            : [a, current];

        return {
          kind: 'slice',
          onMove(moveCtx: InvocationCtx): void {
            current = moveCtx.drag?.current ?? moveCtx.world;
            trail = moveCtx.drag?.points;
          },
          overlay(): OngoingOverlay | null {
            if (!open) return null;
            return { kind: 'polyline', points: cut(), role: 'cut' };
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            if (reason === 'cancel') return;
            current = endCtx.drag?.current ?? endCtx.world;
            trail = endCtx.drag?.points ?? trail;
            commit(cut(), deps);
          },
        };
      },
    },
    enabled: () => true,
  });
}

/** The `slice` Action with the default commit, `slicePaths`. */
export const sliceAction = createSliceAction();
