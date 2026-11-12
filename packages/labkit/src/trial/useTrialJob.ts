import { useEffect, useState } from 'react';
import type { JobCapability, JobHandle } from '../job/types';
import { useJob } from '../job/useJob';
import type { LabStore } from '../state/store';
import { onTrialRestart } from '../state/trialRestarts';

const NO_JOB: JobCapability = { run: async function* () {}, onItem: (_i, st) => st };

/**
 * Trial `trialId`'s job, or undefined where its instrument declares none. A
 * Reset or a snapshot loaded over the trial drops the run in flight at once,
 * before it folds another item into the state that replaced its own, and an
 * `auto` job runs again on the new state.
 */
export function useTrialJob(args: {
  store: LabStore;
  trialId: string;
  capability: JobCapability | undefined;
  config: unknown;
  state: unknown;
}): JobHandle | undefined {
  const { store, trialId, capability, config, state } = args;
  const [epoch, setEpoch] = useState(0);
  // Hooks cannot be conditional, so a trial without the capability still calls
  // this — with a runner that yields nothing and is never started.
  const job = useJob({
    capability: capability ?? NO_JOB,
    config,
    state,
    setState: (next) => store.getState().updateTrialState(trialId, next),
    epoch,
  });
  const { cancel } = job;
  useEffect(
    () =>
      onTrialRestart(store, trialId, () => {
        cancel();
        setEpoch((n) => n + 1);
      }),
    [store, trialId, cancel],
  );
  return capability ? job : undefined;
}
