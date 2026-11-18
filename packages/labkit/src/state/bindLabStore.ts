import type { RecordCache } from '@weasel-js/storage';
import { serializeTrials } from './helpers';
import { remoteState } from './labRecordReads';
import { trialRecord } from './labRecords';
import { type UnsavedState, writeStoreChanges, writeUnsaved } from './labRecordWrites';
import { ownUndoOf } from './ownUndo';
import type { LabStore } from './store';
import type { TrialRecord } from './types';
import { onUndoSteps } from './watchTrialHistories';

export interface BindOptions {
  orders: Map<string, number>;
  /** What the store holds that the records do not: written once, at binding. */
  unsaved?: UnsavedState;
}

/** Keep `store` and `records` in step, both ways. Returns the unbinding. */
export function bindLabStore(
  store: LabStore,
  records: RecordCache,
  options: BindOptions,
): () => void {
  const orderOf = new Map(options.orders);
  const hooks = () => store.getState().instrumentHooks();
  let applyingRemote = false;

  const writeTrial = (trial: TrialRecord): void => {
    const [serialized] = serializeTrials([trial], hooks().serializers, (id) =>
      ownUndoOf(store, id),
    );
    records.set(trialRecord(trial.id), { ...serialized, order: orderOf.get(trial.id) });
  };
  const offSteps = onUndoSteps(store, (trial) => {
    if (!applyingRemote) writeTrial(trial);
  });

  const offStore = store.subscribe((state, prev) => {
    if (!applyingRemote) writeStoreChanges(records, state, prev, orderOf, writeTrial);
  });

  const offRecords = records.subscribe((changes) => {
    const remote = changes.filter((c) => c.origin === 'remote');
    if (remote.length === 0) return;
    const next = remoteState(store.getState(), hooks, records, remote, orderOf);
    applyingRemote = true;
    try {
      store.setState(next);
    } finally {
      applyingRemote = false;
    }
  });

  if (options.unsaved) {
    writeUnsaved(records, store.getState(), options.unsaved, orderOf, writeTrial);
  }

  return () => {
    offStore();
    offRecords();
    offSteps();
  };
}
