import type { SelectionApi } from '@weasel-js/core';
import type { LeafReading, PrefSection } from '@weasel-js/prefs';
import type { PrefsSource } from '../PrefsSource/PrefsSource';
import { sourceResetPlan } from '../PrefsSource/policy';
import type { LeafState } from '../PrefsSource/types';
import type { LeafWrites } from './commitLeaf';
import { MIXED, aggregateLeaf, aggregateValue, nodeLeafValue, nodeValueAt, panelLeafKey, type AnyNode, type PanelLeaf } from './model';

/** What a selection source is drawn over. */
export interface SelectionSourceInput {
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

/** A selection's source, whose reset also takes the name of its undo step. */
export interface SelectionSource extends PrefsSource {
  resetAs(paths: readonly string[], label: string): void;
}

/**
 * A source over the selected nodes: each is a target, so a reading's `each` holds one value per node and a write
 * lands in every one as one undo step. A node keeps no auto state, so no leaf is auto here.
 */
export function selectionSource(input: SelectionSourceInput): SelectionSource {
  const { nodes, selection, writes, disabled, hidden, active } = input;
  const byPath = new Map(input.leaves.map((l) => [l.path, l] as const));
  const schema: PrefSection = { name: '', members: Object.fromEntries(input.leaves.map((l) => [l.path, l.leaf])) };
  const panelLeaf = (path: string): PanelLeaf | undefined => byPath.get(path);
  const keyOf = (path: string): string => {
    const at = panelLeaf(path);
    return at ? panelLeafKey(at) : path;
  };
  const writeVia = (path: string, next: (prev: unknown) => unknown, draft: boolean): void => {
    const at = panelLeaf(path);
    if (!at) return;
    if (draft) writes.draft(selection, at, next);
    else writes.commit(selection, at, next);
  };
  const source: SelectionSource = {
    schema,
    valueAt: (path): LeafReading => {
      const leaf = panelLeaf(path)?.leaf;
      const aggregated = leaf ? aggregateLeaf(nodes, path, leaf) : aggregateValue(nodes, path);
      const each = nodes.map((n) => (leaf ? nodeLeafValue(leaf, nodeValueAt(n, path)) : nodeValueAt(n, path)));
      return aggregated === MIXED ? { value: undefined, mixed: true, each } : { value: aggregated, mixed: false, each };
    },
    write: (path, value, options) => writeVia(path, () => value, options?.draft === true),
    update: (path, fn, options) => writeVia(path, (prev) => fn(prev), options?.draft === true),
    autoAt: () => undefined,
    stateAt: (path): LeafState => {
      const key = keyOf(path);
      return { disabled: disabled.has(key), hidden: hidden.has(key), active: active?.has(key) === true };
    },
    reset: (paths) => source.resetAs(paths, paths.length === 1 ? (panelLeaf(paths[0]!)?.leaf.name ?? '') : ''),
    resetAs: (paths, label) => {
      const due = sourceResetPlan(source, paths).flatMap((w) => panelLeaf(w.path) ?? []);
      if (due.length > 0) writes.reset(selection, due, label);
    },
  };
  return source;
}

/** A panel's source over the selection it draws: {@link selectionSource}. The nodes change with every scene
 *  version, so it is built fresh each render. */
export function useSelectionSource(input: SelectionSourceInput): SelectionSource {
  return selectionSource(input);
}
