import type { InstrumentList } from '../instrument/types';
import { defaultStorage, noneAdapter } from '../state/adapters';
import { type OpenedLabStore, openLabStore } from '../state/openLabStore';
import { createRecordCache } from '../state/records';
import { createLabStore, type LabStore } from '../state/store';
import type { LabMode, StorageAdapter } from '../state/types';
import { addTrial as addTrialOp } from '../trial/trialOps';

export interface OpenedLab extends OpenedLabStore {
  marks: ReadonlyMap<string, unknown>;
}

/** What opening a lab reads from `<Lab>`'s props. */
export interface OpenLabOptions {
  instruments: InstrumentList;
  defaultInstrument: string;
  mode?: LabMode | undefined;
}

function seedDefaultTrial(
  store: LabStore,
  instruments: InstrumentList,
  defaultInstrument: string,
): void {
  if (store.getState().trials.length > 0) return;
  const record = addTrialOp([], instruments, defaultInstrument)[0];
  if (!record) return;
  store.getState().addTrial(record);
}

/** A lab with nothing to load renders at once. Its records hold
 *  `usePersistedState` values for the session and write nothing. */
export function openUnstoredLab({ instruments, defaultInstrument, mode }: OpenLabOptions): OpenedLab {
  const store = createLabStore({ initialMode: mode ?? 'auto', instruments });
  seedDefaultTrial(store, instruments, defaultInstrument);
  const records = createRecordCache({ storage: noneAdapter, prefix: '', writable: false });
  return { store, records, close: () => records.close(), marks: new Map() };
}

export async function openStoredLab(
  { instruments, defaultInstrument, mode }: OpenLabOptions,
  storageKey: string,
  storage: StorageAdapter | undefined,
): Promise<OpenedLab> {
  // The store reads the instruments' serializers and defaults while it is being
  // built, so they go in with it rather than being pushed onto it afterwards.
  const opened = await openLabStore({
    storageKey,
    storage: storage ?? (await defaultStorage()),
    initialMode: mode ?? 'auto',
    instruments,
  });
  seedDefaultTrial(opened.store, instruments, defaultInstrument);
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
