/**
 * A Boolean operation of the caller's own over the selection: the operands the
 * kit resolves from it, and the commit that replaces them with the pieces the
 * caller cut from those operands, as one undo step.
 */
import type { Path } from '@weasel-js/geom';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { NodeId } from 'core/scene/types';
import { resolveEntries, type BooleanEntry, type BooleanOpResult, type BooleansAdapter } from './booleans';
import { commitPieces, type BooleanCommitPiece } from './commit';
import type { BooleanOpOptions } from './operands';

/** One selected node's operand. */
export interface BooleanSource {
  id: NodeId;
  /** In world: its path, its glyph outlines, or the region its ink covers
   *  once a stroke is counted. */
  path: Path;
  /** Set when a stroke went into `path`: what a piece standing in for this
   *  source wears. */
  paint?: PathPaint;
}

/** What {@link resolveBooleanOperands} answers. */
export interface BooleanOperands {
  /** The selection the operands were read from. */
  selection: readonly NodeId[];
  /** Back to front. */
  sources: readonly BooleanSource[];
}

/**
 * The operands the selected nodes give a Boolean operation, back to front, as
 * the built-in operations resolve them; or why there are fewer than two.
 * Reads the adapter and changes nothing.
 */
export function resolveBooleanOperands(
  adapter: BooleansAdapter,
  opts: BooleanOpOptions = {},
): BooleanOperands | Exclude<BooleanOpResult, { kind: 'applied' }> {
  const selection = [...adapter.getSelection()] as NodeId[];
  const entries = resolveEntries(adapter, selection, 'divide', opts);
  if ('kind' in entries) return entries;
  return {
    selection,
    sources: entries.map(({ id, operand: { path, paint } }) => (paint ? { id, path, paint } : { id, path })),
  };
}

/**
 * Replace `operands`' sources with `pieces` as one undo step named `label`,
 * and select what was made. Each piece is minted from the source it names, as
 * `BooleansAdapter.createPathNode` says, and stacks in that source's slot. An
 * empty `pieces` deletes every source.
 */
export function commitBooleanPieces(
  adapter: BooleansAdapter,
  operands: BooleanOperands,
  pieces: readonly BooleanCommitPiece[],
  label: string,
): Extract<BooleanOpResult, { kind: 'applied' }> {
  const entries = operands.sources.map(({ id, path, paint }): BooleanEntry => ({
    id,
    operand: paint ? { path, paint } : { path },
  }));
  return { kind: 'applied', resultIds: commitPieces(adapter, operands.selection, entries, pieces, label) };
}

export type { BooleanCommitPiece };
