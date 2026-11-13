import { stableStringify } from '@weasel-js/core';
import {
  createRecordCache,
  noneAdapter,
  type RecordCache,
  type StorageAdapter,
} from '@weasel-js/storage';
import type { InstrumentList } from '../instrument/types';
import { valueRecord } from '../state/labRecords';
import { defaultStorage } from '../state/labStorage';
import { type OpenedLabStore, openLabStore } from '../state/openLabStore';
import { createLabStore, type LabStore } from '../state/store';
import type { LabMode } from '../state/types';
import { addTrial as addTrialOp } from '../trial/trialOps';

export interface OpenedLab extends OpenedLabStore {
  marks: ReadonlyMap<string, unknown>;
}

/** What opening a lab reads from `<Lab>`'s props. */
export interface OpenLabOptions {
  instruments: InstrumentList;
  defaultInstrument: string;
  opening?: readonly string[] | undefined;
  mode?: LabMode | undefined;
}

/** The trial a presented lab opens on. `config` is overlaid on the
 *  instrument's defaults the way `addTrial`'s is, so Reset returns to it;
 *  `state` and `view` replace what that config would give. */
export interface PresentationSeed<TC = Record<string, unknown>, TS = unknown, TV = unknown> {
  /** Default: the lab's `defaultInstrument`. */
  instrument?: string;
  config?: Partial<TC>;
  state?: TS;
  view?: TV;
}

/** Where a lab stored under `storageKey` keeps its presentation, apart from
 *  the full lab: an embed shares its origin's storage with the lab it shows. */
export function presentStorageKey(storageKey: string): string {
  return `${storageKey}:present`;
}

const SEED_RECORD = valueRecord(null, 'lk-present-seed');

/** Open a presented lab's one trial on `seed`, unless the store already holds
 *  a trial opened on this same seed — a returning visitor keeps theirs until
 *  the seed itself changes. */
function seedPresentedTrial(
  store: LabStore,
  records: RecordCache,
  { instruments, defaultInstrument }: OpenLabOptions,
  seed: PresentationSeed,
): void {
  const instrument = seed.instrument ?? defaultInstrument;
  const fingerprint = stableStringify({ ...seed, instrument });
  const trials = store.getState().trials;
  if (instruments.length === 0 || (trials.length > 0 && records.get(SEED_RECORD) === fingerprint))
    return;
  const record = addTrialOp([], instruments, instrument, { config: seed.config })[0];
  if (!record) return;
  store.setState({ trials: [] });
  store.getState().addTrial({
    ...record,
    ...('state' in seed ? { state: seed.state } : {}),
    ...('view' in seed ? { view: seed.view } : {}),
  });
  records.set(SEED_RECORD, fingerprint);
}

function seedDefaultTrials(
  store: LabStore,
  { instruments, defaultInstrument, opening }: OpenLabOptions,
): void {
  if (instruments.length === 0 || store.getState().trials.length > 0) return;
  let trials: ReturnType<typeof addTrialOp> = [];
  for (const name of opening ?? [defaultInstrument]) trials = addTrialOp(trials, instruments, name);
  for (const record of trials) store.getState().addTrial(record);
}

/** A lab with nothing to load renders at once. Its records hold
 *  `usePersistedState` values for the session and write nothing. With a
 *  `seed`, the lab is presented and opens on it. */
export function openUnstoredLab(options: OpenLabOptions, seed?: PresentationSeed): OpenedLab {
  const { instruments, mode } = options;
  const store = createLabStore({ initialMode: mode ?? 'auto', instruments });
  const records = createRecordCache({ storage: noneAdapter, prefix: '', writable: false });
  if (seed) seedPresentedTrial(store, records, options, seed);
  else seedDefaultTrials(store, options);
  return { store, records, close: () => records.close(), marks: new Map() };
}

/** The labs open now on each storage, by storage key. */
const openLabs = new WeakMap<StorageAdapter, Map<string, Set<RecordCache>>>();

/** Note `records` open as lab `storageKey` on `storage`, until the returned close. */
function heldOpen(
  storage: StorageAdapter,
  storageKey: string,
  records: RecordCache,
  close: () => Promise<boolean>,
): () => Promise<boolean> {
  const byKey = openLabs.get(storage) ?? new Map<string, Set<RecordCache>>();
  openLabs.set(storage, byKey);
  const live = byKey.get(storageKey) ?? new Set<RecordCache>();
  byKey.set(storageKey, live);
  live.add(records);
  return () => {
    live.delete(records);
    if (live.size === 0) byKey.delete(storageKey);
    return close();
  };
}

/** Send what every lab open as `storageKey` on `storage` has queued: one that a remount replaces
 *  in the same commit closes only after its successor has begun to read. */
async function flushOpen(storage: StorageAdapter, storageKey: string): Promise<void> {
  const live = openLabs.get(storage)?.get(storageKey);
  if (live) await Promise.all([...live].map((records) => records.flush()));
}

export async function openStoredLab(
  options: OpenLabOptions,
  storageKey: string,
  storage: StorageAdapter | undefined,
  seed?: PresentationSeed,
): Promise<OpenedLab> {
  const { instruments, mode } = options;
  const adapter = storage ?? (await defaultStorage());
  await flushOpen(adapter, storageKey);
  // The store reads the instruments' serializers and defaults while it is being
  // built, so they go in with it rather than being pushed onto it afterwards.
  const stored = await openLabStore({
    storageKey,
    storage: adapter,
    initialMode: mode ?? 'auto',
    instruments,
  });
  const opened = {
    ...stored,
    close: heldOpen(adapter, storageKey, stored.records, stored.close),
  };
  if (seed) seedPresentedTrial(opened.store, opened.records, options, seed);
  else seedDefaultTrials(opened.store, options);
  const marks = new Map<string, unknown>();
  await Promise.all(
    opened.store.getState().trials.map(async (trial) => {
      const kept = instruments.find((i) => i.name === trial.instrumentName)?.annotations?.storage;
      if (!kept) return;
      try {
        marks.set(trial.id, await kept.load());
      } catch (error) {
        console.warn(`[labkit] could not load the marks of trial "${trial.id}"`, error);
        marks.set(trial.id, null);
      }
    }),
  );
  return { ...opened, marks };
}
