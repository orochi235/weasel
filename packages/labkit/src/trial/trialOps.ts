import type { Instrument, InstrumentList } from '../instrument/types';
import type { TrialRecord } from '../state/types';

const DEFAULT_VIEW = { zoom: 1, pan: { x: 0, y: 0 } } as const;

function findInstrument(instruments: InstrumentList, name: string): Instrument {
  const found = instruments.find((i) => i.name === name);
  if (!found) {
    throw new Error(`[labkit] Unknown instrument: "${name}"`);
  }
  return found;
}

function initialView(instrument: Instrument): TrialRecord['view'] {
  return instrument.canvas?.initialView
    ? structuredClone(instrument.canvas.initialView)
    : { ...DEFAULT_VIEW, pan: { ...DEFAULT_VIEW.pan } };
}

/** Append a new trial running `instrumentName`, at that instrument's
 *  default config and initial state. */
export function addTrial(
  trials: TrialRecord[],
  instruments: InstrumentList,
  instrumentName: string,
): TrialRecord[] {
  const instrument = findInstrument(instruments, instrumentName);
  const config = instrument.defaultConfig();
  const state = instrument.initialState(config);
  const record: TrialRecord = {
    id: crypto.randomUUID(),
    instrumentName,
    config,
    state,
    view: initialView(instrument),
    undoStack: { past: [], future: [] },
  };
  return [...trials, record];
}

/** Insert a deep copy of a trial directly after it. The copy starts with
 *  an empty undo history — the original's is not shared. */
export function cloneTrial(trials: TrialRecord[], id: string): TrialRecord[] {
  const sourceIdx = trials.findIndex((w) => w.id === id);
  const source = trials[sourceIdx];
  if (!source) return trials;
  const clone: TrialRecord = {
    ...source,
    id: crypto.randomUUID(),
    config: structuredClone(source.config),
    state: structuredClone(source.state),
    view: structuredClone(source.view),
    undoStack: { past: [], future: [] },
  };
  return [...trials.slice(0, sourceIdx + 1), clone, ...trials.slice(sourceIdx + 1)];
}

/** Remove a trial, unless it is the last one — a lab always has at least
 *  one. */
export function closeTrial(trials: TrialRecord[], id: string): TrialRecord[] {
  if (trials.length <= 1) return trials;
  const next = trials.filter((w) => w.id !== id);
  return next.length === trials.length ? trials : next;
}

/** Return a trial to its instrument's defaults, keeping its id and its
 *  place in the list. */
export function resetTrial(
  trials: TrialRecord[],
  id: string,
  instruments: InstrumentList,
): TrialRecord[] {
  const idx = trials.findIndex((w) => w.id === id);
  const current = trials[idx];
  if (!current) return trials;
  const instrument = findInstrument(instruments, current.instrumentName);
  const config = instrument.defaultConfig();
  const state = instrument.initialState(config);
  const reset: TrialRecord = {
    ...current,
    config,
    state,
    view: initialView(instrument),
  };
  return [...trials.slice(0, idx), reset, ...trials.slice(idx + 1)];
}

/**
 * Reorder to match `ids`. Ids the list doesn't mention keep their relative
 * order at the end, and ids it names that no longer exist are dropped — a
 * reorder that raced a close should not resurrect the closed trial.
 */
export function reorderTrials(trials: TrialRecord[], ids: readonly string[]): TrialRecord[] {
  const byId = new Map(trials.map((w) => [w.id, w]));
  const named = ids.map((id) => byId.get(id)).filter((w): w is TrialRecord => w !== undefined);
  const seen = new Set(named.map((w) => w.id));
  const rest = trials.filter((w) => !seen.has(w.id));
  return [...named, ...rest];
}
