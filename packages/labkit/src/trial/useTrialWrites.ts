import { createHistory, type Op } from '@weasel-js/core';
import { isDev } from '@weasel-js/react';
import { useCallback, useContext, useMemo, useRef } from 'react';
import { useStore } from 'zustand/react';
import { resolveAutoConfig } from '../config/autoConfig';
import { LabOverContext, writesOver } from '../config/over';
import { hasConfigPath, schemaNodeAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import type { Instrument } from '../instrument/types';
import { undoCapability } from '../instrument/undo';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { stateOp } from '../undo/stateOp';
import {
  readTrialEdit,
  readTrialSettings,
  type TrialEdit,
  type TrialSettings,
  writeTrialEdit,
} from './trialEdit';
import type { TrialHistorySource } from './trialHistory';

/** A config write within this long of the last one to the same path belongs
 *  to the same gesture — a slider drag writes on every move. */
const GESTURE_MS = 500;

/** What a trial snapshots on when its instrument names no events. */
const DEFAULT_SNAPSHOT_ON = ['state.change', 'config.change'];

const NO_HISTORY = (): null => null;

const isConfigEvent = (event: string): boolean =>
  event === 'config.change' || event.startsWith('config.change:');

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
  snapshot: (event: string) => boolean;
  /** Write one config value: snapshots on `config.change` or
   *  `config.change:<path>`, one entry for a run of writes to one path, then runs
   *  the instrument's `onConfigChange` against the stored record. A path of
   *  the schema the config is drawn over goes to the lab's `over` instead. */
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
  const setTrialHistory = useStore(store, (s) => s.setTrialHistory);
  const undoCap = undoCapability(instrument);
  const undoEvents = useMemo(() => new Set(undoCap?.snapshotOn ?? DEFAULT_SNAPSHOT_ON), [undoCap]);
  const maxDepth = undoCap?.maxDepth ?? 50;
  const setOver = useContext(LabOverContext)?.set;

  // Read from the store, not the render: a caller may write several times
  // before the next render, and each write has to build on the one before.
  const stored = useCallback(
    (): TrialRecord | undefined => store.getState().trials.find((t) => t.id === trialId),
    [store, trialId],
  );

  const lastWrite = useRef<{ path: string; at: number; version: number } | null>(null);
  // Undoing an entry ends the gesture that recorded it, on whichever history holds it.
  const endsGesture = useCallback(
    (op: Op): Op => ({
      ...op,
      invert: () => {
        lastWrite.current = null;
        return op.invert();
      },
    }),
    [],
  );

  const snapshot = useCallback(
    (event: string): boolean => {
      if (!undoCap || !undoEvents.has(event)) return false;
      const current = stored();
      if (!current) return false;
      const own = ownHistory();
      if (own) {
        if (!isConfigEvent(event)) return false;
        const read = (): TrialSettings | undefined => {
          const record = stored();
          return record ? readTrialSettings(record) : undefined;
        };
        const write = (settings: TrialSettings) => writeTrialEdit(store, trialId, settings);
        own.record(endsGesture(stateOp(structuredClone(readTrialSettings(current)), read, write)), event);
        return true;
      }
      let history = current.history;
      if (!history) {
        history = createHistory(null, { historyLimit: maxDepth });
        setTrialHistory(trialId, history);
      }
      const read = (): TrialEdit | undefined => {
        const record = stored();
        return record ? readTrialEdit(record) : undefined;
      };
      const write = (edit: TrialEdit) => writeTrialEdit(store, trialId, edit);
      history.recordEntry(
        [endsGesture(stateOp(structuredClone(readTrialEdit(current)), read, write))],
        event,
      );
      return true;
    },
    [
      undoCap,
      undoEvents,
      maxDepth,
      stored,
      ownHistory,
      store,
      trialId,
      setTrialHistory,
      endsGesture,
    ],
  );

  const setConfig = useCallback(
    (path: string, value: unknown): void => {
      if (writesOver(schema, path)) {
        setOver?.(path, value);
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
      const version = (): number => stored()?.history?.getVersion() ?? -1;
      // The entry a gesture's first write recorded already holds the state
      // from before it, and reads the state to redo to when it is undone.
      const last = lastWrite.current;
      const sameGesture =
        last !== null &&
        last.path === path &&
        Date.now() - last.at < GESTURE_MS &&
        last.version === version();
      if (!sameGesture && !snapshot('config.change')) snapshot(`config.change:${path}`);
      updateTrialConfig(trialId, path, value);
      lastWrite.current = { path, at: Date.now(), version: version() };
      const after = stored();
      if (!instrument.onConfigChange || !after) return;
      const resolved = (r: TrialRecord): unknown =>
        resolveAutoConfig(schema, r.config, new Set(r.auto ?? []));
      const next = instrument.onConfigChange(resolved(after), resolved(before), after.state);
      updateTrialState(trialId, next as never);
    },
    [stored, schema, setOver, snapshot, updateTrialConfig, updateTrialState, trialId, instrument],
  );

  return useMemo(() => ({ snapshot, setConfig }), [snapshot, setConfig]);
}
