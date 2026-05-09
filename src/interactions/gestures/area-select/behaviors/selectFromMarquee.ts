import { createSetSelectionOp } from '../../../../core/ops/select';
import type { Op } from '../../../../core/ops/types';
import type { NodeId } from '../../../../core/scene/types';
import type { AreaSelectAdapter } from '../../../../core/adapters/types';
import type { AreaSelectBehavior } from '../../types';

/** Default area-select behavior: replace selection with hits inside the marquee, or extend with shift held. */
export function selectFromMarquee(): AreaSelectBehavior {
  return {
    defaultTransient: true,
    onEnd(ctx) {
      const adapter = ctx.adapter as unknown as AreaSelectAdapter;
      // Defensive: when the adapter omits area-select methods (opt-in
      // marquee), `useSelectTool` already skips wiring this behavior. If a
      // consumer wires it manually against an under-featured adapter, no-op
      // gracefully rather than throwing.
      if (!adapter.getSelection || !adapter.hitTestArea) return null;
      const start = ctx.origin.get('gesture')!;
      const current = ctx.current.get('gesture') ?? start;
      const x = Math.min(start.worldX, current.worldX);
      const y = Math.min(start.worldY, current.worldY);
      const width = Math.abs(current.worldX - start.worldX);
      const height = Math.abs(current.worldY - start.worldY);

      const from = adapter.getSelection();
      const isEmpty = width === 0 || height === 0;
      const shiftHeld = start.shiftHeld;

      let to: string[];
      if (isEmpty) {
        to = shiftHeld ? from : [];
      } else {
        const hits = adapter.hitTestArea({ x, y, width, height });
        if (shiftHeld) {
          const merged = [...from];
          for (const id of hits) if (!merged.includes(id)) merged.push(id);
          to = merged;
        } else {
          to = hits;
        }
      }
      const ops: Op[] = [createSetSelectionOp({ from: from as NodeId[], to: to as NodeId[] })];
      return ops;
    },
  };
}
