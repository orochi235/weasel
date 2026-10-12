/**
 * Outline Stroke: replace each selected stroked path with the region its
 * stroke covers, as a path filled in the stroke's paint. A node that is also
 * filled keeps its fill as a path of its own underneath. One undoable batch;
 * the replacement takes the node's slot.
 */
import { strokeToPath, type StrokeToPathOptions } from '@weasel-js/stroke';
import type { NodeId } from 'core/scene/types';
import type { CreateOutlinesAdapter } from './createOutlines';
import { replaceWithPaths, type PaintedPath } from './replaceWithPaths';

/** Outcome of {@link applyOutlineStroke}. */
export type OutlineStrokeResult =
  /** `resultIds` are what replaced the stroked nodes at their level — a
   *  path, a container, or two flat paths each — and are now selected in
   *  their place. */
  | { kind: 'applied'; resultIds: string[] }
  /** Nothing selected is a path with a stroke that has width. */
  | { kind: 'noop'; reason: 'no-stroke' };

/**
 * Outline the stroke of every stroked path in the selection, as one batch
 * labeled "Outline Stroke". Other selected nodes are left alone and stay
 * selected. `opts.scale` is the view scale a `{ px }` width resolves against.
 */
export function applyOutlineStroke(
  adapter: CreateOutlinesAdapter,
  opts: StrokeToPathOptions = {},
): OutlineStrokeResult {
  const sel = [...adapter.getSelection()] as NodeId[];
  const converted: { id: NodeId; paths: PaintedPath[] }[] = [];
  for (const id of sel) {
    const path = adapter.getWorldPath?.(id);
    const paint = adapter.getPaint?.(id);
    if (!path || paint?.stroke?.paint == null) continue;
    const outline = strokeToPath(path, paint.stroke, opts);
    if (outline.commands.length === 0) continue;
    const stroke: PaintedPath = { path: outline, fill: { paint: paint.stroke.paint } };
    converted.push({ id, paths: paint.fill !== null ? [{ path, fill: paint.fill }, stroke] : [stroke] });
  }
  if (converted.length === 0) return { kind: 'noop', reason: 'no-stroke' };
  const replaced = replaceWithPaths(adapter, sel, converted, 'Outline Stroke');
  return { kind: 'applied', resultIds: converted.flatMap((c) => replaced.get(c.id)!) };
}
