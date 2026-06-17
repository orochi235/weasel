import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, OngoingOverlay, Point2 } from '../invoker';
import type { DrawCommand } from '../../../renderer';
import { linePath } from '../../../features/paths/builder';

/**
 * Consumer-supplied commit for the Slice action. `commit` receives the finite
 * slice segment (world coords); the consumer scans the scene, splits crossed
 * paths via `splitPathByLine`, and applies the result as one undoable batch.
 */
export interface SliceDep {
  commit(a: Point2, b: Point2): void;
}

const SLICE_STROKE = '#e23b3b';
const SLICE_WIDTH = 1;
const SLICE_DASH = [6, 4];

/**
 * @experimental
 * Static descriptor for the `slice` Action.
 *
 * Ongoing drag invoker: tracks a slice line from drag start to current
 * pointer, renders a live line overlay while the gesture is in flight,
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
          const cmd: DrawCommand = {
            kind: 'path',
            path: linePath(a, current),
            stroke: { paint: { color: SLICE_STROKE }, width: SLICE_WIDTH, dash: SLICE_DASH },
          };
          return { kind: 'commands', commands: [cmd], space: 'world' };
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
  enabled: () => true as const,
};
