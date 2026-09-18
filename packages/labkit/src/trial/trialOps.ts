import { isAuto } from '../config/auto';
import { autoPathsOf } from '../config/autoConfig';
import { fillConfigDefaults, isRecord } from '../config/path';
import { unruledConfigSchema } from '../instrument/serializers';
import type { Instrument, InstrumentList } from '../instrument/types';
import { newId } from '../state/helpers';
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
  const stage = instrument.canvas ? undefined : instrument.stage;
  const declared = instrument.canvas?.initialView ?? stage?.initialView;
  // A function needs the canvas size, which no trial has at creation. `null`
  // is the unplaced marker; `Trial` resolves it on the first non-empty size.
  // A stage that names no view is fitted, which needs that size too.
  if (typeof declared === 'function' || (stage && declared === undefined)) return null;
  return declared ? structuredClone(declared) : { ...DEFAULT_VIEW, pan: { ...DEFAULT_VIEW.pan } };
}

/** What a trial opens on beyond its instrument's own defaults. */
export interface AddTrialOptions<TC = Record<string, unknown>> {
  /** Overlaid on `defaultConfig()` before `initialState` reads it, so a trial
   *  opened on a subject is running that subject from its first frame. Keys
   *  whose value is `undefined` are left to the default. */
  config?: Partial<TC>;
}

/** `defaultConfig()` with `seed` written over it, down the tree: a seed naming
 *  one leaf of a group leaves that group's other leaves at their defaults. */
function seedConfig<TC>(defaults: TC, seed: Partial<TC> | undefined): TC {
  return seed ? fillConfigDefaults(seed, defaults) : defaults;
}

/** Splits a seed config into its ordinary values and the dotted paths it wrote
 *  as `auto`, so the sentinel never reaches the record. */
function splitAutoSeed(
  seed: Record<string, unknown> | undefined,
  at = '',
): { config: Record<string, unknown>; autoPaths: string[] } {
  const config: Record<string, unknown> = {};
  const autoPaths: string[] = [];
  for (const [key, value] of Object.entries(seed ?? {})) {
    const path = at === '' ? key : `${at}.${key}`;
    if (isAuto(value)) {
      autoPaths.push(path);
    } else if (isRecord(value)) {
      const inner = splitAutoSeed(value as Record<string, unknown>, path);
      config[key] = inner.config;
      autoPaths.push(...inner.autoPaths);
    } else {
      config[key] = value;
    }
  }
  return { config, autoPaths };
}

/** The paths an instrument's own schema declares as starting auto. */
function schemaAutoPaths(instrument: Instrument): string[] {
  const schema = unruledConfigSchema(instrument);
  return schema ? autoPathsOf(schema) : [];
}

/** Append a new trial running `instrumentName`, at that instrument's default
 *  config — with `options.config` written over it — and the initial state
 *  that config produces. */
export function addTrial(
  trials: TrialRecord[],
  instruments: InstrumentList,
  instrumentName: string,
  options: AddTrialOptions = {},
): TrialRecord[] {
  const instrument = findInstrument(instruments, instrumentName);
  const seeded = splitAutoSeed(options.config as Record<string, unknown> | undefined);
  const autoPaths = [...new Set([...schemaAutoPaths(instrument), ...seeded.autoPaths])];
  const config = seedConfig(instrument.defaultConfig(), seeded.config);
  const state = instrument.initialState(config);
  const record: TrialRecord = {
    id: newId(),
    instrumentName,
    config,
    state,
    view: initialView(instrument),
    undoStack: { past: [], future: [] },
  };
  if (options.config) record.configSeed = seeded.config;
  if (seeded.autoPaths.length > 0) record.autoSeed = seeded.autoPaths;
  if (autoPaths.length > 0) record.auto = autoPaths;
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
    id: newId(),
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

/** Return a trial to what it opened on — its instrument's defaults under the
 *  seed `addTrial` was given — keeping its id and its place in the list. */
export function resetTrial(
  trials: TrialRecord[],
  id: string,
  instruments: InstrumentList,
): TrialRecord[] {
  const idx = trials.findIndex((w) => w.id === id);
  const current = trials[idx];
  if (!current) return trials;
  const instrument = findInstrument(instruments, current.instrumentName);
  const config = seedConfig(instrument.defaultConfig(), current.configSeed);
  const state = instrument.initialState(config);
  const autoPaths = [...new Set([...schemaAutoPaths(instrument), ...(current.autoSeed ?? [])])];
  const { auto: _unpinnedNow, ...kept } = current;
  const reset: TrialRecord = {
    ...kept,
    config,
    state,
    view: initialView(instrument),
  };
  if (autoPaths.length > 0) reset.auto = autoPaths;
  return [...trials.slice(0, idx), reset, ...trials.slice(idx + 1)];
}

/** Put a fresh trial running `instrumentName` where trial `id` is. It gets a
 *  new id, since the history, snapshots and marks keyed by the old one belong
 *  to what that trial was running, but keeps the width its sidebar was
 *  dragged to. */
export function swapTrial(
  trials: TrialRecord[],
  instruments: InstrumentList,
  id: string,
  instrumentName: string,
  options: AddTrialOptions = {},
): TrialRecord[] {
  const idx = trials.findIndex((w) => w.id === id);
  const current = trials[idx];
  if (!current) return trials;
  const [record] = addTrial([], instruments, instrumentName, options) as [TrialRecord];
  if (current.sidebarWidth !== undefined) record.sidebarWidth = current.sidebarWidth;
  return [...trials.slice(0, idx), record, ...trials.slice(idx + 1)];
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
