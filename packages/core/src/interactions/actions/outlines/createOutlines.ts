/**
 * Create Outlines: replace each selected text node with a path node carrying
 * its glyph outlines, giving up editability for geometry — the destructive
 * conversion every vector editor has. One undoable batch; each path takes its
 * text node's slot, so stacking order is unchanged.
 */
import type { PolygonPath } from '@weasel-js/geom';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import { textToPath, TextOutlinesError, type TextNodeSource } from 'features/text/textToPath';

/** What `applyCreateOutlines` reads and writes through. */
export interface CreateOutlinesAdapter {
  getSelection(): readonly NodeId[] | readonly string[];
  /** The text node behind `id`, or `undefined` for anything else. */
  getTextSource(id: NodeId): TextNodeSource | undefined;
  /**
   * Mint the path node that replaces text node `sourceId`. `path` is in world
   * space. The node should carry the text's fill and stroke and sit under the
   * same parent — the kit places it in the text's slot, but only the consumer
   * knows its data shape.
   */
  createPathNode(path: PolygonPath, sourceId: NodeId): { id: string };
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
  const converted: { id: NodeId; path: PolygonPath }[] = [];
  try {
    for (const id of sel) {
      const text = adapter.getTextSource(id);
      if (!text) continue;
      const path = textToPath(text.data, text.pose);
      if (path.commands.length > 0) converted.push({ id, path });
    }
  } catch (err) {
    if (err instanceof TextOutlinesError) return { kind: 'failed', reason: 'text-outlines', error: err };
    throw err;
  }
  if (converted.length === 0) return { kind: 'noop', reason: 'no-text' };

  const ops: Op[] = [];
  const replaced = new Map<NodeId, string>();
  for (const { id, path } of converted) {
    const node = adapter.getNode?.(id) ?? { id };
    const siblings = adapter.getChildren?.(adapter.getParent?.(id) ?? null);
    const index = siblings ? siblings.indexOf(id) : -1;
    const created = adapter.createPathNode(path, id);
    replaced.set(id, created.id);
    // Delete then insert at the same index: the sibling list is the same
    // length again after each pair, so the pairs compose in any order.
    ops.push(createDeleteOp({ node, index }));
    ops.push(createInsertOp(index >= 0 ? { node: created, index } : { node: created }));
  }
  ops.push(createSetSelectionOp({
    from: sel,
    to: sel.map((id) => (replaced.get(id) ?? id) as NodeId),
  }));
  dispatchApplyBatch(adapter, ops, 'Create Outlines');
  return { kind: 'applied', resultIds: [...replaced.values()] };
}
