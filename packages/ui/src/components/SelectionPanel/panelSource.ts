import type { SelectionApi } from '@weasel-js/core';
import { createSelectionSource, type LeafState, type SelectionSource } from '@weasel-js/prefs';
import type { LeafWrites } from './commitLeaf';
import { nodeLeafValue, nodeValueAt, panelLeafKey, type AnyNode, type PanelLeaf } from './model';

/** What a panel's source is drawn over. */
export interface PanelSourceInput {
  /** The selected nodes, in selection order. */
  nodes: readonly AnyNode[];
  /** The panel's leaves, each at the node path it reads. */
  leaves: readonly PanelLeaf[];
  selection: Pick<SelectionApi, 'current'>;
  writes: LeafWrites;
  disabled: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  active?: ReadonlySet<string>;
}

/** The selected nodes as the targets of a `createSelectionSource`: a node holding nothing at a leaf has no such
 *  property, and reads as unset unless the leaf is `absentIsDefault`. */
export function panelSource(input: PanelSourceInput): SelectionSource {
  const { nodes, selection, writes, disabled, hidden, active } = input;
  const byPath = new Map(input.leaves.map((l) => [l.path, l] as const));
  const keyOf = (path: string): string => {
    const at = byPath.get(path);
    return at ? panelLeafKey(at) : path;
  };
  return createSelectionSource({
    leaves: Object.fromEntries(input.leaves.map((l) => [l.path, l.leaf])),
    read: (path) => nodes.map((n) => nodeValueAt(n, path)),
    shown: nodeLeafValue,
    write: (path, next, options) => {
      const at = byPath.get(path);
      if (!at) return;
      if (options?.draft === true) writes.draft(selection, at, next);
      else writes.commit(selection, at, next);
    },
    reset: (plan, label) => {
      const due = plan.flatMap((w) => byPath.get(w.path) ?? []);
      if (due.length > 0) writes.reset(selection, due, label);
    },
    stateAt: (path): LeafState => {
      const key = keyOf(path);
      return { disabled: disabled.has(key), hidden: hidden.has(key), active: active?.has(key) === true };
    },
  });
}
