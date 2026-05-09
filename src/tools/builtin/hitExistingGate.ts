import type { NodeId } from '../../core/scene/types';
import type { ToolCtx } from '../types';

/** Hit-existing gate shared by the drag-insert tool hooks. When the consumer
 *  supplies a `hitExisting` callback, run it at the cursor's world point.
 *  On hit (string id or array of ids), set the selection and return `true` —
 *  the caller should claim and skip insertion. On miss or when no callback
 *  is supplied, return `false`. */
export function applyHitExistingGate(
  ctx: ToolCtx<unknown>,
  hitExisting:
    | ((p: { x: number; y: number }) => string | string[] | null)
    | undefined,
): boolean {
  if (!hitExisting) return false;
  const hit = hitExisting({ x: ctx.worldX, y: ctx.worldY });
  if (!hit) return false;
  const ids = Array.isArray(hit) ? hit : [hit];
  ctx.selection.set(ids as NodeId[]);
  return true;
}
