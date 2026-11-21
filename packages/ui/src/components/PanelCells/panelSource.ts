import type { SelectionApi } from '@weasel-js/routing';
import { createSelectionSource, type PrefLeafStatus, type SelectionSource } from '@weasel-js/prefs';
import { nodeLeafValue, panelLeafKey, type PanelLeaf, type PanelRecord } from './model';

/** A panel's writes into the selected records. */
export interface LeafWrites {
  /** The value an edit settles on: one undo step, from where each record was before any draft of it. */
  commit(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: (prev: unknown) => unknown): void;
  /** A value on the way there, as a slider's drag passes through: written, and kept out of undo. */
  draft(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: (prev: unknown) => unknown): void;
  /** What the drafts of `leaf`'s edit in flight wrote over, put back and kept out of undo: the edit was canceled. */
  cancel?(leaf: PanelLeaf): void;
  /** Each of `leaves` back as its schema says (`prefStoredReset`), in every selected record, as one undo step. */
  reset(selection: Pick<SelectionApi, 'current'>, leaves: readonly PanelLeaf[], label: string): void;
}

/** What a panel's source is drawn over. */
export interface PanelSourceInput {
  /** The selected records, in selection order. */
  records: readonly PanelRecord[];
  /** The panel's leaves, each at the path it reads. */
  leaves: readonly PanelLeaf[];
  selection: Pick<SelectionApi, 'current'>;
  writes: LeafWrites;
  disabled: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  active?: ReadonlySet<string>;
}

/** The selected records as the targets of a `createSelectionSource`: a record holding nothing at a leaf has no such
 *  property, and reads as unset unless the leaf is `absentIsDefault`. */
export function panelSource(input: PanelSourceInput): SelectionSource {
  const { records, selection, writes, disabled, hidden, active } = input;
  const keysAt = new Map<string, string[]>();
  const byPath = new Map<string, PanelLeaf>();
  for (const l of input.leaves) {
    keysAt.set(l.path, [...(keysAt.get(l.path) ?? []), panelLeafKey(l)]);
    if (!byPath.has(l.path) || l.own === undefined) byPath.set(l.path, l);
  }
  // Leaves sharing a path (an alias and its target) each answer by their own key; the path is as free as the freest.
  const keysOf = (path: string): readonly string[] => keysAt.get(path) ?? [path];
  return createSelectionSource({
    leaves: Object.fromEntries([...byPath].map(([path, l]) => [path, l.leaf])),
    read: (path) => records.map((r) => r.valueAt(path)),
    shown: nodeLeafValue,
    write: (path, next, options) => {
      const at = byPath.get(path);
      if (!at) return;
      if (options?.draft === true) writes.draft(selection, at, next);
      else writes.commit(selection, at, next);
    },
    reset: (plan, label) => {
      const due = [...new Set(plan.flatMap((w) => byPath.get(w.path) ?? []))];
      if (due.length > 0) writes.reset(selection, due, label);
    },
    stateAt: (path): PrefLeafStatus => {
      const keys = keysOf(path);
      return {
        enabled: keys.some((key) => !disabled.has(key)),
        shown: keys.some((key) => !hidden.has(key)),
        active: keys.some((key) => active?.has(key) === true),
      };
    },
  });
}
