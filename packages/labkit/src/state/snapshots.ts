import { newId } from './helpers';
import type { InstrumentHooks, SavedSnapshot, TrialRecord } from './types';

/** A snapshot of `trial` named `name`, saved after every one in `saved`. */
export function snapshotOf(
  trial: TrialRecord,
  name: string,
  hooks: InstrumentHooks,
  saved: readonly SavedSnapshot[],
): SavedSnapshot {
  const reg = hooks.serializers[trial.instrumentName];
  const lastAt = saved.reduce((m, sn) => (sn.savedAt > m ? sn.savedAt : m), 0);
  return {
    id: newId(),
    name,
    trialId: trial.id,
    instrumentName: trial.instrumentName,
    config: structuredClone(trial.config),
    state: reg?.serialize ? reg.serialize(trial.state) : structuredClone(trial.state),
    auto: [...(trial.auto ?? [])],
    ...(trial.clock ? { clock: { ...trial.clock } } : {}),
    savedAt: Math.max(Date.now(), lastAt + 1),
  };
}

/** `trial` with `snapshot` loaded over it. */
export function loadedFrom(trial: TrialRecord, snapshot: SavedSnapshot, hooks: InstrumentHooks): TrialRecord {
  const reg = hooks.serializers[snapshot.instrumentName];
  const state = reg?.deserialize ? reg.deserialize(snapshot.state, snapshot.config) : snapshot.state;
  const loaded: TrialRecord = { ...trial, state, config: snapshot.config };
  // A fresh object each load, so the trial's clock tells it from its own writes.
  if (snapshot.clock) loaded.clock = { ...snapshot.clock };
  if (snapshot.auto === undefined) return loaded;
  delete loaded.auto;
  if (snapshot.auto.length > 0) loaded.auto = [...snapshot.auto];
  return loaded;
}
