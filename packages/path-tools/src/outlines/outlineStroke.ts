/**
 * Outline Stroke: replace each selected stroked path, or stroked outline (a
 * text node's glyphs), with
 * the region its stroke covers, as a path filled in the stroke's paint. A node
 * that is also filled keeps its fill as a path of its own underneath. One
 * undoable batch; the replacement takes the node's slot.
 */
import { resolveFill, resolveStroke } from '@weasel-js/paint';
import type { NodeId } from '@weasel-js/core';
import type { CreateOutlinesAdapter } from './createOutlines';
import { replaceWithPaths } from './replaceWithPaths';
import { NodeOutlineError, strokeRegion, type PaintedPath, type StrokeRegionOptions } from '@weasel-js/core';

/** Outcome of {@link applyOutlineStroke}. */
export type OutlineStrokeResult =
  /** `resultIds` are what replaced the stroked nodes at their level — a
   *  path, a container, or a run of flat paths each — and are now selected in
   *  their place. */
  | { kind: 'applied'; resultIds: string[] }
  /** Nothing selected is a path or outline with a stroke that has width. */
  | { kind: 'noop'; reason: 'no-stroke' }
  /** Some selected stroked outline could not be built; nothing was changed. */
  | { kind: 'failed'; reason: 'outlines'; error: NodeOutlineError };

/** What the adapter knows of `id` as painted world paths: a path node's one,
 *  or a stroked outline's parts. Throws as `NodeOutline.parts` does. */
function paintedPaths(adapter: CreateOutlinesAdapter, id: NodeId): PaintedPath[] {
  const path = adapter.getWorldPath?.(id);
  if (path) {
    const paint = adapter.getPaint?.(id);
    return paint ? [{ path, ...paint }] : [];
  }
  const outline = adapter.getOutline(id);
  // An unstroked node stays as it is: its outline is not built, so a text
  // face without outlines fails only the text this would convert.
  if (!outline?.stroked) return [];
  return [...outline.parts()];
}

/**
 * Outline the stroke of every stroked path and stroked outline in the selection,
 * as one batch labeled "Outline Stroke". Other selected nodes are left alone
 * and stay selected. Each stroke is outlined in the frame it is drawn in: see
 * {@link strokeRegion}. All or nothing: if a stroked outline cannot be
 * built the scene is untouched and the error comes back.
 */
export function applyOutlineStroke(
  adapter: CreateOutlinesAdapter,
  opts: StrokeRegionOptions = {},
): OutlineStrokeResult {
  const sel = [...adapter.getSelection()] as NodeId[];
  const converted: { id: NodeId; paths: PaintedPath[] }[] = [];
  try {
    for (const id of sel) {
      const frame = adapter.getStrokeFrame?.(id);
      const paths: PaintedPath[] = [];
      let outlined = false;
      for (const { path, fill, stroke } of paintedPaths(adapter, id)) {
        const painted = resolveStroke(stroke);
        const outline = painted === null ? null : strokeRegion(path, painted, frame, opts);
        if (!outline || outline.commands.length === 0) {
          paths.push(stroke ? { path, fill, stroke } : { path, fill });
          continue;
        }
        outlined = true;
        if (resolveFill(fill) !== null) paths.push({ path, fill });
        paths.push({ path: outline, fill: { paint: painted!.paint } });
      }
      if (outlined) converted.push({ id, paths });
    }
  } catch (err) {
    if (err instanceof NodeOutlineError) return { kind: 'failed', reason: 'outlines', error: err };
    throw err;
  }
  if (converted.length === 0) return { kind: 'noop', reason: 'no-stroke' };
  const replaced = replaceWithPaths(adapter, sel, converted, 'Outline Stroke');
  return { kind: 'applied', resultIds: converted.flatMap((c) => replaced.get(c.id)!) };
}
