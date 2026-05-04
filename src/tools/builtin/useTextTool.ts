import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { createInsertOp } from '../../core/ops/create';

export interface UseTextToolOptions<TObject extends { id: string }> {
  /** Build a new text object at the clicked world point. Return `null` to
   *  decline (e.g. clicked on an existing object the consumer would rather
   *  treat as edit-entry). The kit wraps the returned object in an InsertOp
   *  and dispatches it via `ctx.applyBatch`. */
  commitInsert: (point: { worldX: number; worldY: number }) => TObject | null;
}

/** Active-slot Tool: click to create a new text object.
 *  v1 is click-to-create only — no drag-to-size and no enter-edit-on-click
 *  on existing nodes. The consumer can wire double-click on an existing node
 *  to enter `useTextEdit` separately (see Swillustrator demo). */
export function useTextTool<TObject extends { id: string }>(
  options: UseTextToolOptions<TObject>,
): Tool<undefined> {
  const { commitInsert } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'text',
        keybinding: 'T',
        cursor: 'text',
        pointer: {
          onClick: (_e, ctx) => {
            const obj = commitInsert({ worldX: ctx.worldX, worldY: ctx.worldY });
            if (!obj) return 'pass';
            ctx.applyBatch([createInsertOp({ object: obj })], 'Insert text');
            return 'claim';
          },
        },
      }),
    [commitInsert],
  );
}
