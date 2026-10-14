import { asNodeId, type NodeId, type Scene, type SelectionApi } from '@weasel-js/core';
import { absentValue, nodeValueAt, setAtPath, type AnyNode, type PanelLeaf } from './model';

type Next = (prev: unknown) => unknown;

/** Writes, into every node of `ids`, what `next` derives from the value that node holds at the leaf's path. */
function writeLeaf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  ids: readonly NodeId[],
  leaf: PanelLeaf,
  next: Next,
): void {
  const [head, ...rest] = leaf.path.split('.');
  for (const id of ids) {
    const node = scene.get(id);
    if (!node) continue;
    const held = nodeValueAt(node as AnyNode, leaf.path);
    const value = next(held === undefined ? absentValue(leaf.leaf) : held);
    // `setAtPath` spreads plain objects/arrays down the schema path;
    // consumer `pose`/`data` are assumed plain-object-shaped along
    // that path (a class instance's prototype would be dropped by
    // the spread) — the `as TPose`/`as TData` casts below rely on it.
    if (head === 'pose') {
      scene.setPose(id, setAtPath(node.pose as object, rest, value) as TPose);
    } else if (head === 'data') {
      scene.update(id, { data: setAtPath(node.data as object, rest, value) as TData });
    }
  }
}

const writable = (leaf: PanelLeaf): boolean => /^(pose|data)\../.test(leaf.path);

/**
 * Writes, into every selected node, what `next` derives from the value that
 * node holds at the leaf's path, as one labeled batch.
 */
export function commitLeaf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  selection: Pick<SelectionApi, 'current'>,
  leaf: PanelLeaf,
  next: Next,
): void {
  if (!writable(leaf)) return;
  const ids = selection.current.map(asNodeId);
  scene.batch(`Edit ${leaf.leaf.name}`, () => writeLeaf(scene, ids, leaf, next));
}

/** A panel's two writes into the selected nodes. */
export interface LeafWrites {
  /** The value an edit settles on: one undo step, from where each node was before any draft of it. */
  commit(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: Next): void;
  /** A value on the way there, as a slider's drag passes through: written, and kept out of undo. */
  draft(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: Next): void;
}

/** The writes of one panel over `scene`. Keep one per panel: it holds what the drafts in flight wrote over. */
export function leafWrites<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): LeafWrites {
  // By leaf path: the pose or data each node held before the first draft of the edit in flight.
  const drafted = new Map<string, Map<NodeId, unknown>>();

  const restore = (leaf: PanelLeaf): void => {
    const before = drafted.get(leaf.path);
    if (!before) return;
    drafted.delete(leaf.path);
    const pose = leaf.path.startsWith('pose.');
    scene.untracked(() => {
      for (const [id, held] of before) {
        if (!scene.get(id)) continue;
        if (pose) scene.setPose(id, held as TPose);
        else scene.update(id, { data: held as TData });
      }
    });
  };

  return {
    commit: (selection, leaf, next) => {
      // A batch records a write from what the document holds, so the drafts come out first.
      restore(leaf);
      commitLeaf(scene, selection, leaf, next);
    },
    draft: (selection, leaf, next) => {
      if (!writable(leaf)) return;
      const ids = selection.current.map(asNodeId);
      const before = drafted.get(leaf.path) ?? new Map<NodeId, unknown>();
      drafted.set(leaf.path, before);
      const pose = leaf.path.startsWith('pose.');
      for (const id of ids) {
        const node = scene.get(id);
        if (node && !before.has(id)) before.set(id, pose ? node.pose : node.data);
      }
      scene.untracked(() => writeLeaf(scene, ids, leaf, next));
    },
  };
}
