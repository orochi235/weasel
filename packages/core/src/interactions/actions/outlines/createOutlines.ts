/**
 * Create Outlines: replace each selected text node with path nodes carrying
 * its glyph outlines, giving up editability for geometry — the destructive
 * conversion every vector editor has. One path per paint the text wears; one
 * undoable batch; the replacement takes the text node's slot, so stacking
 * order is unchanged.
 */
import { boundsOfPath, type PolygonPath, type Rect } from '@weasel-js/geom';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import { locateChild } from 'core/ops/slot';
import { unionBounds } from 'core/geometry/unionBounds';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import {
  textToPathsByPaint, TextOutlinesError, type TextNodeSource, type TextPaintPath,
} from 'features/text/textToPath';

/** What a path minted by Create Outlines must carry — see
 *  {@link CreateOutlinesAdapter.createPathNode}. */
export interface OutlinePathSpec {
  /** The fill these glyphs wear, resolved: their run's, else the node's,
   *  else the default text fill. `null` is no fill. */
  fill: FillStyle | null;
  /** The stroke they wear, resolved the same way; absent for none. */
  stroke?: Stroke;
  /** The parent the path goes under: the text's own, or the container
   *  minted to hold a multi-paint text's paths. */
  parent: string | null;
}

/** What `applyCreateOutlines` reads and writes through. */
export interface CreateOutlinesAdapter {
  getSelection(): readonly NodeId[] | readonly string[];
  /** The text node behind `id`, or `undefined` for anything else. */
  getTextSource(id: NodeId): TextNodeSource | undefined;
  /**
   * Mint one path node of text node `sourceId`'s outlines. `path` is in world
   * space. The node must wear `spec`'s fill and stroke — a text whose runs
   * differ in paint gets one path per paint — and sit under `spec.parent`.
   * The kit places it; only the consumer knows its data shape.
   */
  createPathNode(path: PolygonPath, sourceId: NodeId, spec: OutlinePathSpec): { id: string };
  /**
   * Mint the container that holds a multi-paint text's paths, under `parent`.
   * `bounds` is the world envelope of the paths. The kit puts the container in
   * the text's slot and the paths inside it, in the text's order. Without
   * this, the paths are laid flat in that slot instead.
   */
  createContainerNode?(sourceId: NodeId, spec: { parent: string | null; bounds: Rect }): { id: string };
  /** Full node for `id`, so undo restores the text node whole. Without it the
   *  delete captures an `{ id }` stub. */
  getNode?(id: string): { id: string } | undefined | null;
  /** Parent and sibling order — the reorder contract. With both, each path is
   *  inserted at its text node's index; without, where `insertNode` defaults. */
  getParent?(id: string): string | null;
  getChildren?(parentId: string | null): readonly string[];
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
 * Convert every text node in the selection to outlines, as one batch labeled
 * "Create Outlines". Other selected nodes are left alone and stay selected.
 * All or nothing: if any text node's face cannot supply outlines the scene is
 * untouched and the error comes back in the result.
 */
export function applyCreateOutlines(adapter: CreateOutlinesAdapter): CreateOutlinesResult {
  const sel = [...adapter.getSelection()] as NodeId[];
  const converted: { id: NodeId; paths: TextPaintPath[] }[] = [];
  try {
    for (const id of sel) {
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

  const ops: Op[] = [];
  const replaced = new Map<NodeId, string[]>();
  // Replacements in the same parent are inserted top slot first, so an
  // earlier one widening the sibling list cannot shift a later one's index.
  const located = converted.map((c) => ({ ...c, at: locateChild(adapter, c.id) }));
  const order = [...located].sort((a, b) => (b.at?.index ?? -1) - (a.at?.index ?? -1));
  for (const { id, paths, at } of order) {
    const node = adapter.getNode?.(id) ?? { id };
    const index = at?.index ?? -1;
    const parent = at?.parentId ?? adapter.getParent?.(id) ?? null;
    const place = (created: { id: string }, i: number) =>
      createInsertOp(index >= 0 ? { node: created, index: index + i } : { node: created });
    ops.push(createDeleteOp({ node, index }));

    const container = paths.length > 1
      ? adapter.createContainerNode?.(id, { parent, bounds: envelope(paths) })
      : undefined;
    if (container) {
      ops.push(place(container, 0));
      for (const p of paths) {
        ops.push(createInsertOp({ node: adapter.createPathNode(p.path, id, specOf(p, container.id)) }));
      }
      replaced.set(id, [container.id]);
    } else {
      const created = paths.map((p) => adapter.createPathNode(p.path, id, specOf(p, parent)));
      created.forEach((n, i) => ops.push(place(n, i)));
      replaced.set(id, created.map((n) => n.id));
    }
  }
  ops.push(createSetSelectionOp({
    from: sel,
    to: sel.flatMap((id) => (replaced.get(id) ?? [id]) as NodeId[]),
  }));
  dispatchApplyBatch(adapter, ops, 'Create Outlines');
  return { kind: 'applied', resultIds: converted.flatMap((c) => replaced.get(c.id)!) };
}

function specOf(p: TextPaintPath, parent: string | null): OutlinePathSpec {
  return p.stroke !== undefined ? { fill: p.fill, stroke: p.stroke, parent } : { fill: p.fill, parent };
}

function envelope(paths: readonly TextPaintPath[]): Rect {
  return unionBounds(paths.map((p) => boundsOfPath(p.path)))!;
}
