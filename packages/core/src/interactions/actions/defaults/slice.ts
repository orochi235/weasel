import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle, OngoingOverlay, Point2 } from '../invoker';

/**
 * Consumer-supplied commit for the Slice action. `commit` receives the finite
 * slice segment (world coords); the consumer scans the scene, splits crossed
 * paths via `splitPathByLine`, and applies the result as one undoable batch.
 */
export interface SliceDep {
  commit(a: Point2, b: Point2): void;
}

/**
 * @experimental
 * Static descriptor for the `slice` Action.
 *
 * Ongoing drag invoker: tracks a slice line from drag start to current
 * pointer, publishes it as a `'cut'` overlay while the gesture is in flight,
 * and on commit calls `SliceDep.commit(a, b)`. No-ops gracefully when
 * the `slice` dep is absent.
 */
export const sliceAction: Action & { requires: string[] } = {
  id: 'slice',
  label: 'Slice',
  group: 'edit',
  defaultBinding: { kind: 'drag' },
  eligible: { capability: 'edits-page' },
  requires: ['slice'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const dep = ctx.deps['slice'] as SliceDep | undefined;
      const a: Point2 = ctx.drag?.start ?? ctx.world;
      let current: Point2 = ctx.drag?.current ?? ctx.world;
      let open = true;

      return {
        kind: 'slice',
        onMove(moveCtx: InvocationCtx): void {
          current = moveCtx.drag?.current ?? moveCtx.world;
        },
        overlay(): OngoingOverlay | null {
          if (!open) return null;
          return { kind: 'polyline', points: [a, current], role: 'cut' };
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          open = false;
          if (reason === 'cancel' || !dep) return;
          const b: Point2 = endCtx.drag?.current ?? endCtx.world;
          dep.commit(a, b);
        },
      };
    },
  },
  // Slice can only act when a `slice` dep is wired (its `onEnd` no-ops
  // otherwise), so reflect dep presence for any UI reading action-enabled
  // state. The dispatcher still self-guards via the empty-handle path.
  enabled: (deps) => (deps?.['slice'] ? true : ActionDisabledReason.NotApplicable),
};
