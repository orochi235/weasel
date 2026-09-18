import { useContext } from 'react';
import { useStore } from 'zustand/react';
import { useResolvedConfig } from '../config/useResolvedConfig';
import { LabStoreContext, TrialIdContext } from './context';
import type { TrialStateHandle } from './types';

/** An instrument's own state and config, plus setters. Reads the surrounding
 *  trial id, so an instrument never has to know which trial it is
 *  running in. Throws outside a lab store and trial. */
export function useTrialState<TS = unknown, TC = unknown>(): TrialStateHandle<TS, TC> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useTrialState must be used inside <LabStoreProvider>');

  const trialId = useContext(TrialIdContext);
  if (!trialId) throw new Error('[labkit] useTrialState must be used inside <TrialIdProvider>');

  const record = useStore(ctx.store, (s) => s.trials.find((w) => w.id === trialId));

  if (!record) throw new Error(`[labkit] No trial found with id "${trialId}"`);

  const updateTrialState = useStore(ctx.store, (s) => s.updateTrialState);
  const updateTrialConfig = useStore(ctx.store, (s) => s.updateTrialConfig);
  // The store's own copy, not `useConfigSchema`: that reads `LabContext`, and
  // this hook only has the store's.
  const instrumentHooks = useStore(ctx.store, (s) => s.instrumentHooks);
  const schema = instrumentHooks().configSchemas[record.instrumentName];
  const { config, auto } = useResolvedConfig<TC>(schema, record.config as TC, record.auto);

  return {
    state: record.state as TS,
    config,
    raw: record.config as TC,
    auto,
    setState: (next) => updateTrialState(trialId, next as Parameters<typeof updateTrialState>[1]),
    setConfig: (path, value) => updateTrialConfig(trialId, path, value),
  };
}
