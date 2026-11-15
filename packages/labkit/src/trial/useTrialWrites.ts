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
import type { TrialConfigChangeHandler } from './trialConfigChange';
import type { MountedTrialHistory } from './trialHistory';
import { type TrialSnapshot, useTrialSnapshot } from './useTrialSnapshot';
import { useWriteGestures } from './useWriteGestures';
import { settledGesture, type WriteGesture } from './writeGesture';

const NO_HISTORY = (): null => null;
const NO_HANDLERS = (): readonly TrialConfigChangeHandler[] => [];

/** What `useTrialWrites` takes. */
export interface TrialWritesOptions {
  store: LabStore;
  trialId: string;
  // biome-ignore lint/suspicious/noExplicitAny: instruments are stored contravariantly; see InstrumentList
  instrument: Instrument<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  schema: ResolvedConfig;
  /** The history the instrument handed over with `useTrialHistory`, if any,
   *  which these writes record onto, save and restore. Absent means none. */
  mounted?: Pick<MountedTrialHistory, 'current' | 'history'> &
    Partial<Pick<MountedTrialHistory, 'changes'>>;
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
   *  the instrument's `onConfigChange` against the stored record and its
   *  `useTrialConfigChange` handlers, inside one step of the instrument's own
   *  history where it has one that batches. A path of
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
  const changes = mounted?.changes?.handlers ?? NO_HANDLERS;
  const ownHistory = mounted?.current ?? NO_HISTORY;
  const marksNow = useLatest(marks ?? null);
  const updateTrialState = useStore(store, (s) => s.updateTrialState);
  const updateTrialConfig = useStore(store, (s) => s.updateTrialConfig);
  const over = useLatest(useContext(LabOverContext));
  const lastWrite = useRef<WriteGesture | null>(null);
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

  const { version, continuing, keyFor, recordWrite, takeBackIfUnchanged } = useWriteGestures({
    lastWriteRef: lastWrite,
    trialId,
    stored,
    snapshot,
    ownHistory,
    marks: marksNow,
  });

  const apply = useCallback(
    (path: string, value: unknown, draft: boolean): void => {
      if (writesOver(schema, path)) {
        const lab = over.current;
        if (!lab) return;
        const read = () => valueAtPath(over.current?.values, path);
        if (!isAuto(value) && deepEqual(read(), value)) return;
        const put = (v: unknown) => over.current?.set(path, v);
        const same = continuing(path);
        recordWrite(path, draft, same, keyFor(same), stateOp(structuredClone(read()), read, put));
        lab.set(path, value);
        return;
      }
      const before = stored();
      if (!before || changesNothing(before, path, value)) return;
      warnUnknownPath(before, schema, path);
      const same = continuing(path);
      const key = keyFor(same);
      const made: { gesture?: WriteGesture } = {};
      const run = (): void => {
        made.gesture = recordWrite(path, draft, same, key);
        updateTrialConfig(trialId, path, value);
        const after = stored();
        if (!after) return;
        const resolved = (r: TrialRecord): unknown =>
          resolveAutoConfig(schema, r.config, new Set(r.auto ?? []));
        if (instrument.onConfigChange) {
          const next = instrument.onConfigChange(resolved(after), resolved(before), after.state);
          updateTrialState(trialId, next as never);
        }
        const handlers = changes();
        if (handlers.length === 0) return;
        const config = resolved(after);
        const prev = resolved(before);
        for (const handler of handlers) handler(config, prev);
      };
      const own = ownHistory();
      if (own?.batch) own.batch('config.change', run, { coalesceKey: key });
      else run();
      // The step this write made is its gesture's own, which the next write to the path continues. A write made
      // inside it has replaced the gesture, which then ends here.
      if (made.gesture && lastWrite.current === made.gesture) {
        lastWrite.current = { ...made.gesture, version: version() };
      }
      if (same) takeBackIfUnchanged();
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
      changes,
      keyFor,
      version,
      continuing,
      ownHistory,
    ],
  );

  const write = useCallback(
    (path: string, value: unknown, draft: boolean): void => {
      apply(path, value, draft);
      lastWrite.current = settledGesture(lastWrite.current, path, draft);
    },
    [apply],
  );
  return useMemo(
    () => ({
      snapshot,
      setConfig: (path: string, value: unknown) => write(path, value, false),
      draftConfig: (path: string, value: unknown) => write(path, value, true),
    }),
    [snapshot, write],
  );
}
