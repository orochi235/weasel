import { useLatest } from '@weasel-js/core';
import { isDev } from '@weasel-js/react';
import { useCallback, useContext, useMemo, useRef } from 'react';
import { useStore } from 'zustand/react';
import { resolveAutoConfig } from '../config/autoConfig';
import { LabOverContext, writesOver } from '../config/over';
import { hasConfigPath, schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import type { Instrument } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { stateOp } from '../undo/stateOp';
import type { TrialHistorySource } from './trialHistory';
import { type TrialSnapshot, useTrialSnapshot } from './useTrialSnapshot';

/** A config write within this long of the last one to the same path belongs
 *  to the same gesture — a slider drag writes on every move. */
const GESTURE_MS = 500;

const NO_HISTORY = (): null => null;

/** What `useTrialWrites` takes. */
export interface TrialWritesOptions {
  store: LabStore;
  trialId: string;
  // biome-ignore lint/suspicious/noExplicitAny: instruments are stored contravariantly; see InstrumentList
  instrument: Instrument<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  schema: ResolvedConfig;
  /** The history the instrument handed over with `useTrialHistory`, if any.
   *  Absent means none. */
  ownHistory?: () => TrialHistorySource | null;
}

/** A trial's writes that its undo history hears. */
export interface TrialWrites {
  /** Record the trial's state and settings for undo, if its instrument
   *  snapshots on `event`. With a history of the instrument's own mounted,
   *  only a settings change is recorded, onto that history: the instrument's
   *  history is what covers its state. True when it recorded. */
  snapshot: TrialSnapshot;
  /** Write one config value: snapshots on `config.change` or
   *  `config.change:<path>`, one entry for a run of writes to one path, then runs
   *  the instrument's `onConfigChange` against the stored record. A path of
   *  the schema the config is drawn over goes to the lab's `over` instead,
   *  recorded the same way. */
  setConfig: (path: string, value: unknown) => void;
}

/** The one place a trial's config is written, for the settings panel, chrome
 *  contributions, and the instrument's own `ctx.setConfig` alike. */
export function useTrialWrites({
  store,
  trialId,
  instrument,
  schema,
  ownHistory = NO_HISTORY,
}: TrialWritesOptions): TrialWrites {
  const updateTrialState = useStore(store, (s) => s.updateTrialState);
  const updateTrialConfig = useStore(store, (s) => s.updateTrialConfig);
  const over = useLatest(useContext(LabOverContext));
  const lastWrite = useRef<{ path: string; at: number; version: number } | null>(null);
  // Undoing an entry ends the gesture that recorded it, on whichever history holds it.
  const { snapshot, stored } = useTrialSnapshot({
    store,
    trialId,
    instrument,
    ownHistory,
    onUndone: () => {
      lastWrite.current = null;
    },
  });

  /** Snapshots for a write to `path`, unless it continues the gesture the last one began. */
  const recordWrite = useCallback(
    (path: string, op?: Parameters<TrialSnapshot>[1]): void => {
      const version = (): number => stored()?.history?.getVersion() ?? -1;
      // The entry a gesture's first write recorded already holds the state
      // from before it, and reads the state to redo to when it is undone.
      const last = lastWrite.current;
      const sameGesture =
        last !== null &&
        last.path === path &&
        Date.now() - last.at < GESTURE_MS &&
        last.version === version();
      if (!sameGesture && !snapshot('config.change', op)) snapshot(`config.change:${path}`, op);
      lastWrite.current = { path, at: Date.now(), version: version() };
    },
    [stored, snapshot],
  );

  const setConfig = useCallback(
    (path: string, value: unknown): void => {
      if (writesOver(schema, path)) {
        const lab = over.current;
        if (!lab) return;
        const read = () => valueAtPath(over.current?.values, path);
        const write = (v: unknown) => over.current?.set(path, v);
        recordWrite(path, stateOp(structuredClone(read()), read, write));
        lab.set(path, value);
        return;
      }
      const before = stored();
      if (!before) return;
      if (
        isDev() &&
        !hasConfigPath(before.config as Record<string, unknown>, path) &&
        schemaNodeAtPath(schema.group, path) === undefined
      ) {
        console.warn(
          `[labkit] setConfig: unknown path "${path}" for instrument "${before.instrumentName}"`,
        );
      }
      recordWrite(path);
      updateTrialConfig(trialId, path, value);
      const after = stored();
      if (!instrument.onConfigChange || !after) return;
      const resolved = (r: TrialRecord): unknown =>
        resolveAutoConfig(schema, r.config, new Set(r.auto ?? []));
      const next = instrument.onConfigChange(resolved(after), resolved(before), after.state);
      updateTrialState(trialId, next as never);
    },
    [stored, schema, over, recordWrite, updateTrialConfig, updateTrialState, trialId, instrument],
  );

  return useMemo(() => ({ snapshot, setConfig }), [snapshot, setConfig]);
}
