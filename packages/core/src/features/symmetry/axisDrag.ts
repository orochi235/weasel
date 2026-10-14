import type { Action, InvocationCtx, OngoingHandle } from '@weasel-js/routing';

/**
 * @experimental
 * Drag the symmetry axis by its handle. A vertical axis moves only sideways
 * and a horizontal one only up and down; the crossing of both moves freely.
 * The new center goes through the `snap` dep when there is one. The axis is a
 * setting rather than document content, so the drag writes the `symmetry`
 * dep and makes no undo entry; cancel puts it back.
 */
export const symmetryAxisDragAction: Action & { requires: string[] } = {
  id: 'symmetry.moveAxis',
  label: 'Move symmetry axis',
  requires: ['symmetry', 'snap'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const dep = ctx.deps.symmetry;
      const origin = dep?.get();
      if (!dep || !origin) return {};
      const snap = ctx.deps.snap;
      const press = { x: ctx.world.x, y: ctx.world.y };
      return {
        kind: 'symmetry-axis',
        onMove(moveCtx: InvocationCtx): void {
          const moved = {
            x: origin.center.x + moveCtx.world.x - press.x,
            y: origin.center.y + moveCtx.world.y - press.y,
          };
          const p = snap ? snap.point(moved) : moved;
          dep.set({
            ...origin,
            center: {
              x: origin.axis === 'horizontal' ? origin.center.x : p.x,
              y: origin.axis === 'vertical' ? origin.center.y : p.y,
            },
          });
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') dep.set(origin);
        },
      };
    },
  },
};
