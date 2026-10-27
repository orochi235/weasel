import { asNodeId, type NodeId, type NodePropertiesEntry, type Scene, type SelectionApi } from '@weasel-js/core';
import { boundAtNode } from './nodeBounds';
import { declaredField, nodeRoot } from './declaredFields';
import { nodeLeafValue, nodeValueAt, setAtPath, type AnyNode, type PanelLeaf } from './model';

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
    const value = boundAtNode(leaf.leaf, node as AnyNode, next(nodeLeafValue(leaf.leaf, held)), held);
    const declared = declaredField(head);
    if (declared) {
      const field = nodeRoot(node as AnyNode, head);
      const to = rest.length === 0 ? value : setAtPath((field ?? {}) as object, rest, value);
      if (to !== field) declared.write(scene, id, to);
      continue;
    }
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

const writable = (leaf: PanelLeaf): boolean =>
  /^(pose|data)\../.test(leaf.path) || declaredField(leaf.path.split('.')[0]) !== undefined;

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

/** What a node held before a draft wrote over it. */
interface Held { pose: unknown; data: unknown; field: unknown }

/** The writes of one panel over `scene`. Keep one per panel: it holds what the drafts in flight wrote over. */
export function leafWrites<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  settleOf: SettleOf = NO_SETTLE,
): LeafWrites {
  // By leaf path: the pose, data and declared field each node held before the first draft of the edit in flight.
  const drafted = new Map<string, Map<NodeId, Held>>();

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
        const head = leaf.path.split('.')[0];
        const field = declaredField(head);
        if (field && nodeRoot(node as AnyNode, head) !== held.field) field.write(scene, id, held.field);
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
      const before = drafted.get(leaf.path) ?? new Map<NodeId, Held>();
      drafted.set(leaf.path, before);
      for (const id of ids) {
        const node = scene.get(id);
        if (node && !before.has(id)) {
          before.set(id, { pose: node.pose, data: node.data, field: nodeRoot(node as AnyNode, leaf.path.split('.')[0]) });
        }
      }
      scene.untracked(() => writeLeaf(scene, ids, leaf, next, settleOf));
    },
  };
}
