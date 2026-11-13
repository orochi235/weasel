import { useLatest } from '@weasel-js/core';
import { isDev } from '@weasel-js/react';
import { deepEqual } from '@weasel-js/registry';
import { useCallback, useContext, useMemo, useRef } from 'react';
import { useStore } from 'zustand/react';
import type { AnnotationsApi } from '../annotations/types';
import { isAuto } from '../config/auto';
import { resolveAutoConfig } from '../config/autoConfig';
import { LabOverContext, writesOver } from '../config/over';
import { hasConfigPath, schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import type { Instrument } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { stateOp } from '../undo/stateOp';
import { readTrialEdit, type TrialEdit } from './trialEdit';
import type { MountedTrialHistory } from './trialHistory';
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
  /** The history the instrument handed over with `useTrialHistory`, if any,
   *  which these writes record onto, save and restore. Absent means none. */
  mounted?: Pick<MountedTrialHistory, 'current' | 'history'>;
  /** The trial's marks, whose edits end a gesture as the trial's own do. Absent means none. */
  marks?: Pick<AnnotationsApi, 'undoStamp'> | null;
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
   *  recorded the same way. A write after drafts to the same path is the value
   *  their edit settled on: it joins their entry, and ends it. */
  setConfig: (path: string, value: unknown) => void;
  /** Write a value an edit is passing through, as `setConfig` does, into an entry
   *  that stays open, however long the edit pauses, until a `setConfig` to the
   *  same path settles it or another edit intervenes: a slider's drag is one step. */
  draftConfig: (path: string, value: unknown) => void;
}

/** Whether writing `value` at `path` would leave `record` as it is. A write that changes nothing records nothing,
 *  as an edit that would change nothing does nothing. */
function changesNothing(record: TrialRecord, path: string, value: unknown): boolean {
  const unpinned = record.auto?.includes(path) ?? false;
  return isAuto(value) ? unpinned : !unpinned && deepEqual(valueAtPath(record.config, path), value);
}

function warnUnknownPath(record: TrialRecord, schema: ResolvedConfig, path: string): void {
  if (
    isDev() &&
    !hasConfigPath(record.config as Record<string, unknown>, path) &&
    schemaNodeAtPath(schema.group, path) === undefined
  ) {
    console.warn(
      `[labkit] setConfig: unknown path "${path}" for instrument "${record.instrumentName}"`,
    );
  }
}

/** The one place a trial's config is written, for the settings panel, chrome
 *  contributions, and the instrument's own `ctx.setConfig` alike. */
export function useTrialWrites({
  store,
  trialId,
  instrument,
  schema,
  mounted,
  marks,
}: TrialWritesOptions): TrialWrites {
  const ownHistory = mounted?.current ?? NO_HISTORY;
  const marksNow = useLatest(marks ?? null);
  const updateTrialState = useStore(store, (s) => s.updateTrialState);
  const updateTrialConfig = useStore(store, (s) => s.updateTrialConfig);
  const over = useLatest(useContext(LabOverContext));
  /** The gesture the last write began or continued. `start` is the record as the gesture found it, where its step
   *  is the trial's own snapshot, which a gesture ending where it started can take back. `open` while drafts run,
   *  which no pause ends. */
  const lastWrite = useRef<{
    path: string;
    at: number;
    version: string;
    start: TrialEdit | null;
    open: boolean;
  } | null>(null);
  // Undoing an entry ends the gesture that recorded it, on whichever history holds it.
  const { snapshot, stored } = useTrialSnapshot({
    store,
    trialId,
    instrument,
    ownHistory,
    mounted: mounted?.history ?? null,
    onUndone: () => {
      lastWrite.current = null;
    },
  });

  /** Snapshots for a write to `path`, unless it continues the gesture the last one began. */
  const recordWrite = useCallback(
    (path: string, draft: boolean, op?: Parameters<TrialSnapshot>[1]): boolean => {
      // Any edit recorded since, on this trial's histories or its marks, ends the gesture.
      const version = (): string =>
        `${marksNow.current?.undoStamp() ?? ''}:${stored()?.history?.getVersion() ?? -1}:${ownHistory()?.undoStamp?.() ?? ''}`;
      // The entry a gesture's first write recorded already holds the state
      // from before it, and reads the state to redo to when it is undone.
      const last = lastWrite.current;
      // A clock set back since the last write (a machine waking to a corrected time) gives a negative gap: a new gesture.
      const gap = last === null ? Infinity : Date.now() - last.at;
      const sameGesture =
        last !== null &&
        last.path === path &&
        (last.open || (gap >= 0 && gap < GESTURE_MS)) &&
        last.version === version();
      let start = sameGesture ? last.start : null;
      if (!sameGesture) {
        const before = stored();
        const recorded = snapshot('config.change', op) || snapshot(`config.change:${path}`, op);
        start = recorded && !op && !ownHistory() && before ? readTrialEdit(before) : null;
      }
      lastWrite.current = { path, at: Date.now(), version: version(), start, open: draft };
      return sameGesture;
    },
    [stored, snapshot, ownHistory, marksNow],
  );

  /** A gesture back where it started has made no step: take back the one its first write recorded. */
  const takeBackIfUnchanged = useCallback((): void => {
    const start = lastWrite.current?.start;
    const now = stored();
    const history = now?.history;
    if (!start || !now || !history?.canUndo() || !deepEqual(readTrialEdit(now), start)) return;
    history.undo();
    history.dropRedo();
    lastWrite.current = null;
  }, [stored]);

  /** A settled write to `path` ends the drafts that ran there before it. */
  const settle = useCallback((path: string, draft: boolean): void => {
    if (!draft && lastWrite.current?.open && lastWrite.current.path === path)
      lastWrite.current = null;
  }, []);

  const apply = useCallback(
    (path: string, value: unknown, draft: boolean): void => {
      if (writesOver(schema, path)) {
        const lab = over.current;
        if (!lab) return;
        const read = () => valueAtPath(over.current?.values, path);
        if (!isAuto(value) && deepEqual(read(), value)) return;
        const put = (v: unknown) => over.current?.set(path, v);
        recordWrite(path, draft, stateOp(structuredClone(read()), read, put));
        lab.set(path, value);
        return;
      }
      const before = stored();
      if (!before || changesNothing(before, path, value)) return;
      warnUnknownPath(before, schema, path);
      const continued = recordWrite(path, draft);
      updateTrialConfig(trialId, path, value);
      const after = stored();
      if (instrument.onConfigChange && after) {
        const resolved = (r: TrialRecord): unknown =>
          resolveAutoConfig(schema, r.config, new Set(r.auto ?? []));
        const next = instrument.onConfigChange(resolved(after), resolved(before), after.state);
        updateTrialState(trialId, next as never);
      }
      if (continued) takeBackIfUnchanged();
    },
    [
      stored,
      schema,
      over,
      recordWrite,
      takeBackIfUnchanged,
      updateTrialConfig,
      updateTrialState,
      trialId,
      instrument,
    ],
  );

  const write = useCallback(
    (path: string, value: unknown, draft: boolean): void => {
      apply(path, value, draft);
      settle(path, draft);
    },
    [apply, settle],
  );
  const setConfig = useCallback(
    (path: string, value: unknown): void => write(path, value, false),
    [write],
  );
  const draftConfig = useCallback(
    (path: string, value: unknown): void => write(path, value, true),
    [write],
  );

  return useMemo(() => ({ snapshot, setConfig, draftConfig }), [snapshot, setConfig, draftConfig]);
}
