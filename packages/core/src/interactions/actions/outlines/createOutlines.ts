/**
 * Create Outlines: replace each selected text node with path nodes carrying
 * its glyph outlines, giving up editability for geometry — the destructive
 * conversion every vector editor has. One path per paint the text wears; one
 * undoable batch; the replacement takes the text node's slot, so stacking
 * order is unchanged.
 */
import type { Affine, Path, Rect } from '@weasel-js/geom';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { textToPathsByPaint, TextOutlinesError, type TextNodeSource } from '@weasel-js/text';
import { replaceWithPaths, type PaintedPath } from './replaceWithPaths';

/** What a path minted by an outline action must carry — see
 *  {@link CreateOutlinesAdapter.createPathNode}. */
export interface OutlinePathSpec extends PathPaint {
  /** The parent the path goes under: the source's own, or the container
   *  minted to hold a source's several paths. */
  parent: string | null;
}

/** What `applyCreateOutlines` and `applyOutlineStroke` read and write through. */
export interface CreateOutlinesAdapter {
  getSelection(): readonly NodeId[] | readonly string[];
  /** The text node behind `id`, or `undefined` for anything else. */
  getTextSource(id: NodeId): TextNodeSource | undefined;
  /**
   * Optional: the world-space path of the path node behind `id`, and the
   * paint it wears. Outline Stroke reads both, and passes over a node that
   * lacks either.
   */
  getWorldPath?(id: NodeId): Path | undefined;
  getPaint?(id: NodeId): PathPaint | undefined;
  /**
   * Optional: the frame the node behind `id` draws its stroke in, as the
   * matrix taking that frame to world (`poseFrameOf`); null or absent for a
   * node drawn straight. Outline Stroke skews and stretches a world-width
   * stroke with it. Without it every stroke is outlined in world.
   */
  getStrokeFrame?(id: NodeId): Affine | null | undefined;
  /**
   * Mint one path node of node `sourceId`'s outlines. `path` is in world
   * space. The node must wear `spec`'s fill and stroke — a text whose runs
   * differ in paint gets one path per paint, and a filled node whose stroke
   * is outlined gets one for the fill and one for the stroke — and sit under
   * `spec.parent`. The kit places it; only the consumer knows its data shape,
   * so anything else of the source's `data` worth keeping is the adapter's to
   * copy: onto this path when it stands alone in the source's slot, onto the
   * container when `createContainerNode` minted one.
   */
  createPathNode(path: Path, sourceId: NodeId, spec: OutlinePathSpec): { id: string };
  /**
   * Mint the container that holds one source's several paths, under `parent`.
   * `bounds` is the world envelope of the paths. The kit puts the container in
   * the source's slot and the paths inside it, back to front. Without this,
   * the paths are laid flat in that slot instead.
   */
  createContainerNode?(sourceId: NodeId, spec: { parent: string | null; bounds: Rect }): { id: string };
  /** Full node for `id`, so undo restores the text node whole. */
  getNode(id: string): { id: string } | undefined | null;
  /** The tree: each path is inserted at its source node's index among its
   *  parent's children. */
  getParent(id: string): string | null;
  getChildren(parentId: string | null): string[];
  applyOps?(ops: Op[], label?: string): void;
  setSelection?(ids: NodeId[]): void;
  insertNode?(node: { id: string }, index?: number): void;
  removeNode?(id: string): void;
}

/** Outcome of {@link applyCreateOutlines}. */
export type CreateOutlinesResult =
  /** `resultIds` are what replaced the text nodes at their level — a path,
   *  a container, or a run of flat paths each — which is also what is now
   *  selected in the text nodes' place. */
  | { kind: 'applied'; resultIds: string[] }
  /** Nothing selected is text with ink. */
  | { kind: 'noop'; reason: 'no-text' }
  /** Some selected text has no outline geometry; nothing was changed. */
  | { kind: 'failed'; reason: 'text-outlines'; error: TextOutlinesError };

/**
 * Convert every text node among `ids` — the selection, when not given — to
 * outlines, as one batch labeled "Create Outlines". Other nodes are left
 * alone, and the selection keeps them; a selected text node's replacement
 * takes its place there. All or nothing: if any text node's face cannot
 * supply outlines the scene is untouched and the error comes back in the
 * result.
 */
export function applyCreateOutlines(adapter: CreateOutlinesAdapter, ids?: readonly NodeId[]): CreateOutlinesResult {
  const sel = [...adapter.getSelection()] as NodeId[];
  const converted: { id: NodeId; paths: PaintedPath[] }[] = [];
  try {
    for (const id of ids ?? sel) {
      const text = adapter.getTextSource(id);
      if (!text) continue;
      const paths = textToPathsByPaint(text.data, text.pose);
      if (paths.length > 0) converted.push({ id, paths });
    }
  } catch (err) {
    if (err instanceof TextOutlinesError) return { kind: 'failed', reason: 'text-outlines', error: err };
    throw err;
  }
  if (converted.length === 0) return { kind: 'noop', reason: 'no-text' };

  const replaced = replaceWithPaths(adapter, sel, converted, 'Create Outlines');
  return { kind: 'applied', resultIds: converted.flatMap((c) => replaced.get(c.id)!) };
}
