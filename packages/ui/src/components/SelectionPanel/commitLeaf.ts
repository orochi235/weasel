import { asNodeId, type NodeId, type NodePropertiesEntry, type Scene, type SelectionApi } from '@weasel-js/core';
import { boundAtNode } from './nodeBounds';
import { absentValue, nodeValueAt, setAtPath, type AnyNode, type PanelLeaf } from './model';

type Next = (prev: unknown) => unknown;

/** The `settle` of the properties entry a node is edited under, if it has one. */
export type SettleOf = (node: AnyNode) => NodePropertiesEntry['settle'];

const NO_SETTLE: SettleOf = () => undefined;

/** Writes, into every node of `ids`, what `next` derives from the value that node holds at the leaf's path. */
function writeLeaf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  ids: readonly NodeId[],
  leaf: PanelLeaf,
  next: Next,
  settleOf: SettleOf,
): void {
  const [head, ...rest] = leaf.path.split('.');
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    const held = nodeValueAt(node as AnyNode, leaf.path);
    const value = boundAtNode(leaf.leaf, node as AnyNode, next(held === undefined ? absentValue(leaf.leaf) : held), held);
    // `setAtPath` spreads plain objects/arrays down the schema path;
    // consumer `pose`/`data` are assumed plain-object-shaped along
    // that path (a class instance's prototype would be dropped by
    // the spread) — the `as TPose`/`as TData` casts below rely on it.
    const prev = { pose: node.pose as unknown, data: node.data as unknown };
    let written = head === 'pose'
      ? { pose: setAtPath(node.pose as object, rest, value) as unknown, data: prev.data }
      : head === 'data'
        ? { pose: prev.pose, data: setAtPath(node.data as object, rest, value) as unknown }
        : null;
    if (written === null) continue;
    const settle = settleOf(node as AnyNode);
    if (settle) written = settle(written, prev);
    if (written.pose !== prev.pose) scene.setPose(id, written.pose as TPose);
    if (written.data !== prev.data) scene.update(id, { data: written.data as TData });
  }
}

const writable = (leaf: PanelLeaf): boolean => /^(pose|data)\../.test(leaf.path);

/**
 * Writes, into every selected node, what `next` derives from the value that
 * node holds at the leaf's path, as one labeled batch. A node whose properties
 * entry has a `settle` stores what that returns.
 */
export function commitLeaf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  selection: Pick<SelectionApi, 'current'>,
  leaf: PanelLeaf,
  next: Next,
  settleOf: SettleOf = NO_SETTLE,
): void {
  if (!writable(leaf)) return;
  const ids = selection.current.map(asNodeId);
  scene.batch(`Edit ${leaf.leaf.name}`, () => writeLeaf(scene, ids, leaf, next, settleOf));
}

/** A panel's two writes into the selected nodes. */
export interface LeafWrites {
  /** The value an edit settles on: one undo step, from where each node was before any draft of it. */
  commit(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: Next): void;
  /** A value on the way there, as a slider's drag passes through: written, and kept out of undo. */
  draft(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: Next): void;
}

/** The writes of one panel over `scene`. Keep one per panel: it holds what the drafts in flight wrote over. */
export function leafWrites<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  settleOf: SettleOf = NO_SETTLE,
): LeafWrites {
  // By leaf path: the pose and data each node held before the first draft of the edit in flight.
  const drafted = new Map<string, Map<NodeId, { pose: unknown; data: unknown }>>();

  const restore = (leaf: PanelLeaf): void => {
    const before = drafted.get(leaf.path);
    if (!before) return;
    drafted.delete(leaf.path);
    scene.untracked(() => {
      for (const [id, held] of before) {
        const node = scene.get(id);
        if (!node) continue;
        if (node.pose !== held.pose) scene.setPose(id, held.pose as TPose);
        if (node.data !== held.data) scene.update(id, { data: held.data as TData });
      }
    });
  };

  return {
    commit: (selection, leaf, next) => {
      // A batch records a write from what the document holds, so the drafts come out first.
      restore(leaf);
      commitLeaf(scene, selection, leaf, next, settleOf);
    },
    draft: (selection, leaf, next) => {
      if (!writable(leaf)) return;
      const ids = selection.current.map(asNodeId);
      const before = drafted.get(leaf.path) ?? new Map<NodeId, { pose: unknown; data: unknown }>();
      drafted.set(leaf.path, before);
      for (const id of ids) {
        const node = scene.get(id);
        if (node && !before.has(id)) before.set(id, { pose: node.pose, data: node.data });
      }
      scene.untracked(() => writeLeaf(scene, ids, leaf, next, settleOf));
    },
  };
}
