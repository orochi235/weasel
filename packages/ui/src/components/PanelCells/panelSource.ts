import type { SelectionApi } from '@weasel-js/routing';
import { createSelectionSource, type LeafState, type SelectionSource } from '@weasel-js/prefs';
import { nodeLeafValue, panelLeafKey, type PanelLeaf, type PanelRecord } from './model';

type Next = (prev: unknown) => unknown;

/** A panel's writes into the selected records. */
export interface LeafWrites {
  /** The value an edit settles on: one undo step, from where each record was before any draft of it. */
  commit(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: Next): void;
  /** A value on the way there, as a slider's drag passes through: written, and kept out of undo. */
  draft(selection: Pick<SelectionApi, 'current'>, leaf: PanelLeaf, next: Next): void;
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
  const byPath = new Map(input.leaves.map((l) => [l.path, l] as const));
  const keyOf = (path: string): string => {
    const at = byPath.get(path);
    return at ? panelLeafKey(at) : path;
  };
  return createSelectionSource({
    leaves: Object.fromEntries(input.leaves.map((l) => [l.path, l.leaf])),
    read: (path) => records.map((r) => r.valueAt(path)),
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
