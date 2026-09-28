import type { Action } from '@weasel-js/routing';
import type { SliceDep } from '../depSchema';
import { ActionDisabledReason, resolveParams } from '@weasel-js/routing';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingOverlay, Point2 } from '@weasel-js/routing';

/**
 * @experimental
 * Static descriptor for the `slice` Action.
 *
 * Ongoing drag invoker: tracks the cut while the gesture is in flight,
 * publishes it as a `'cut'` overlay, and on commit hands it to
 * `SliceDep.commit(cut)`. No-ops gracefully when the `slice` dep is absent.
 *
 * The cut is a straight line from drag start to the pointer by default. With
 * the binding param `cut: 'freehand'` it is the whole drag trail instead.
 */
export const sliceAction: Action & { requires: string[] } = {
  id: 'slice',
  label: 'Slice',
  group: 'edit',
  eligible: { capability: 'edits-page' },
  requires: ['slice'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const dep = ctx.deps['slice'] as SliceDep | undefined;
      const a: Point2 = ctx.drag?.start ?? ctx.world;
      let current: Point2 = ctx.drag?.current ?? ctx.world;
      let trail: ReadonlyArray<Point2> | undefined;
      let open = true;

      const freehand = () => resolveParams(opts?.params)?.['cut'] === 'freehand';
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
          if (reason === 'cancel' || !dep) return;
          current = endCtx.drag?.current ?? endCtx.world;
          trail = endCtx.drag?.points ?? trail;
          dep.commit(cut());
        },
      };
    },
  },
  // Slice can only act when a `slice` dep is wired (its `onEnd` no-ops
  // otherwise), so reflect dep presence for any UI reading action-enabled
  // state. The dispatcher still self-guards via the empty-handle path.
  enabled: (deps) => (deps?.['slice'] ? true : ActionDisabledReason.NotApplicable),
};
