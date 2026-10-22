/**
 * Outline Stroke: replace each selected stroked path, or stroked text, with
 * the region its stroke covers, as a path filled in the stroke's paint. A node
 * that is also filled keeps its fill as a path of its own underneath. One
 * undoable batch; the replacement takes the node's slot.
 */
import { textToPathsByPaint, TextOutlinesError, type TextNodeSource } from '@weasel-js/text';
import { resolveFill, resolveStroke } from '@weasel-js/paint';
import type { NodeId } from 'core/scene/types';
import type { CreateOutlinesAdapter } from './createOutlines';
import { replaceWithPaths, type PaintedPath } from './replaceWithPaths';
import { strokeRegion, type StrokeRegionOptions } from './strokeRegion';

/** Outcome of {@link applyOutlineStroke}. */
export type OutlineStrokeResult =
  /** `resultIds` are what replaced the stroked nodes at their level — a
   *  path, a container, or a run of flat paths each — and are now selected in
   *  their place. */
  | { kind: 'applied'; resultIds: string[] }
  /** Nothing selected is a path or text with a stroke that has width. */
  | { kind: 'noop'; reason: 'no-stroke' }
  /** Some selected stroked text has no outline geometry; nothing was changed. */
  | { kind: 'failed'; reason: 'text-outlines'; error: TextOutlinesError };

/** Whether a text node wears a stroke anywhere: its own, or a run's. */
export function textIsStroked(text: TextNodeSource | undefined): boolean {
  return text != null && (text.data.stroke != null || !!text.data.runs?.some((r) => r.stroke != null));
}

/** What the adapter knows of `id` as painted world paths: a path node's one,
 *  or a text node's glyphs by paint. Throws as `textToPathsByPaint` does. */
function paintedPaths(adapter: CreateOutlinesAdapter, id: NodeId): PaintedPath[] {
  const path = adapter.getWorldPath?.(id);
  if (path) {
    const paint = adapter.getPaint?.(id);
    return paint ? [{ path, ...paint }] : [];
  }
  const text = adapter.getTextSource(id);
  // Text with no stroke stays text: its outlines are not read, so a face
  // without them fails only the text this would convert.
  if (!text || !textIsStroked(text)) return [];
  return textToPathsByPaint(text.data, text.pose);
}

/**
 * Outline the stroke of every stroked path and stroked text in the selection,
 * as one batch labeled "Outline Stroke". Other selected nodes are left alone
 * and stay selected. Each stroke is outlined in the frame it is drawn in: see
 * {@link strokeRegion}. All or nothing: if a stroked text's face cannot
 * supply outlines the scene is untouched and the error comes back.
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
    if (err instanceof TextOutlinesError) return { kind: 'failed', reason: 'text-outlines', error: err };
    throw err;
  }
  if (converted.length === 0) return { kind: 'noop', reason: 'no-stroke' };
  const replaced = replaceWithPaths(adapter, sel, converted, 'Outline Stroke');
  return { kind: 'applied', resultIds: converted.flatMap((c) => replaced.get(c.id)!) };
}
