import type { History } from '@weasel-js/core';
import type { ColorModePreference } from '@weasel-js/theme';
import type { ClockPosition } from '../clock/trialClock';
import { applyConfigWrite } from '../config/autoConfig';
import { withColorMode, withSectionCollapsed, withSidebarWidth, withTitle } from './trialFields';
import type { LabStoreState, TrialRecord } from './types';

/** The store's actions that add, remove, or write one field of a trial. */
export interface TrialRecordActions {
  addTrial: (record: Omit<TrialRecord, 'history'>) => void;
  removeTrial: (id: string) => void;
  updateTrialState: <TS>(id: string, next: TS | ((prev: TS) => TS)) => void;
  /** Write one config value. `path` is dotted for a value nested under an
   *  `f.group`, and the bare key for one at the root. */
  updateTrialConfig: (id: string, path: string, value: unknown) => void;
  updateTrialView: (id: string, view: unknown) => void;
  updateTrialSidebarWidth: (id: string, width: number) => void;
  /** Set the color mode a trial's content is drawn in. `'auto'` returns it to the lab's. */
  setTrialColorMode: (id: string, mode: ColorModePreference) => void;
  /** Retitle a trial. `null` returns it to its instrument's name. */
  setTrialTitle: (id: string, title: string | null) => void;
  /** Fold or unfold one of a trial's sections. */
  setTrialSectionCollapsed: (id: string, key: string, collapsed: boolean) => void;
  updateTrialAnnotations: (id: string, doc: unknown) => void;
  /** Give a trial the undo history it made on its first snapshot. */
  setTrialHistory: (id: string, history: History) => void;
  /** Record where a trial's clock stands. */
  updateTrialClock: (id: string, clock: ClockPosition) => void;
  setTrialTool: (trialId: string, id: string | null) => void;
}

/** {@link TrialRecordActions} writing through the store's `set`. */
export function trialRecordActions(
  set: (next: (s: LabStoreState) => Partial<LabStoreState>) => void,
): TrialRecordActions {
  return {
    addTrial: (record) => {
      set((s) => ({
        trials: [...s.trials, record],
      }));
    },

    removeTrial: (id) => {
      set((s) => ({ trials: s.trials.filter((w) => w.id !== id) }));
    },

    updateTrialState: (id, next) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          const nextState =
            typeof next === 'function' ? (next as (prev: unknown) => unknown)(w.state) : next;
          // An updater that returns its input means "nothing changed", and must not
          // cost a new record: the trial re-renders on record identity, so
          // allocating here turns the standard React bail-out into a render loop.
          if (Object.is(nextState, w.state)) return w;
          return { ...w, state: nextState };
        }),
      }));
    },

    updateTrialConfig: (id, path, value) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          const was = w.auto ?? [];
          // The sentinel is never stored: it becomes membership in `auto`, and
          // the pinned value at the path is left exactly where it is.
          const next = applyConfigWrite(w.config, was, path, value);
          if (next.config === w.config && next.autoPaths === was) return w;
          const { auto: _was, ...kept } = w;
          const record: TrialRecord = { ...kept, config: next.config };
          if (next.autoPaths.length > 0) record.auto = next.autoPaths;
          return record;
        }),
      }));
    },

    updateTrialView: (id, view) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id && !Object.is(view, w.view) ? { ...w, view } : w)),
      }));
    },

    updateTrialSidebarWidth: (id, width) =>
      set((s) => ({ trials: withSidebarWidth(s.trials, id, width) })),
    setTrialColorMode: (id, mode) => set((s) => ({ trials: withColorMode(s.trials, id, mode) })),
    setTrialTitle: (id, title) => set((s) => ({ trials: withTitle(s.trials, id, title) })),
    setTrialSectionCollapsed: (id, key, collapsed) =>
      set((s) => ({ trials: withSectionCollapsed(s.trials, id, key, collapsed) })),

    updateTrialAnnotations: (id, doc) => {
      set((s) => ({
        trials: s.trials.map((w) =>
          w.id === id && !Object.is(doc, w.annotations) ? { ...w, annotations: doc } : w,
        ),
      }));
    },

    updateTrialClock: (id, clock) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id ? { ...w, clock } : w)),
      }));
    },
    setTrialHistory: (id, history) => {
      set((s) => ({
        trials: s.trials.map((w) => (w.id === id ? { ...w, history } : w)),
      }));
    },

    setTrialTool: (trialId, id) => set((s) => trialToolSet(s, trialId, id)),
  };
}

// A write of the tool a trial already holds must notify no one: the canvas a
// trial's tool slot mirrors answers every notice with a write of its own.
function trialToolSet<S extends LabStoreState>(
  s: S,
  trialId: string,
  id: string | null,
): S | Pick<S, 'trials'> {
  return holdsTool(s.trials, trialId, id) ? s : { trials: withTool(s.trials, trialId, id) };
}

function holdsTool(trials: readonly TrialRecord[], trialId: string, id: string | null): boolean {
  return !trials.some((t) => t.id === trialId && t.activeToolId !== id);
}

function withTool(
  trials: readonly TrialRecord[],
  trialId: string,
  id: string | null,
): TrialRecord[] {
  return trials.map((t) => (t.id === trialId ? { ...t, activeToolId: id } : t));
}
