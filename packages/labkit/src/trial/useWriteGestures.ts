import { deepEqual } from '@weasel-js/registry';
import { type RefObject, useCallback, useRef } from 'react';
import type { AnnotationsApi } from '../annotations/types';
import type { TrialRecord } from '../state/types';
import { readTrialEdit } from './trialEdit';
import type { TrialHistorySource } from './trialHistory';
import type { TrialSnapshot } from './useTrialSnapshot';
import { GESTURE_MS, type WriteGesture } from './writeGesture';

/** What `useWriteGestures` reads. */
export interface WriteGesturesOptions {
  /** The gesture the trial's last config write began or continued, which these read and replace. */
  lastWriteRef: RefObject<WriteGesture | null>;
  trialId: string;
  stored: () => TrialRecord | undefined;
  snapshot: TrialSnapshot;
  ownHistory: () => TrialHistorySource | null;
  marks: RefObject<Pick<AnnotationsApi, 'undoStamp'> | null>;
}

/** How a trial's config writes group into gestures, each one undo step. */
export function useWriteGestures({
  lastWriteRef,
  trialId,
  stored,
  snapshot,
  ownHistory,
  marks,
}: WriteGesturesOptions) {
  const gestures = useRef(0);

  /** Any edit recorded since, on this trial's histories or its marks, ends the gesture. */
  const version = useCallback(
    (): string =>
      `${marks.current?.undoStamp() ?? ''}:${stored()?.history?.getVersion() ?? -1}:${ownHistory()?.undoStamp?.() ?? ''}`,
    [marks, stored, ownHistory],
  );

  /** The gesture the last write began, if a write to `path` now continues it. */
  const continuing = useCallback(
    (path: string): WriteGesture | null => {
      const last = lastWriteRef.current;
      // A clock set back since the last write (a machine waking to a corrected time) gives a negative gap: a new gesture.
      const gap = last === null ? Infinity : Date.now() - last.at;
      const same =
        last !== null &&
        last.path === path &&
        (last.open || (gap >= 0 && gap < GESTURE_MS)) &&
        last.version === version();
      return same ? last : null;
    },
    [lastWriteRef, version],
  );

  /** The key a write's step coalesces under: its gesture's, or a new one's. */
  const keyFor = useCallback(
    (same: WriteGesture | null): string =>
      same?.key ?? `labkit:config:${trialId}:${++gestures.current}`,
    [trialId],
  );

  /** Snapshots for a write to `path`, unless it continues gesture `same`, and makes that gesture the last. */
  const recordWrite = useCallback(
    (
      path: string,
      draft: boolean,
      same: WriteGesture | null,
      key: string,
      op?: Parameters<TrialSnapshot>[1],
    ): WriteGesture => {
      // The entry a gesture's first write recorded already holds the state
      // from before it, and reads the state to redo to when it is undone.
      let start = same ? same.start : null;
      if (!same) {
        const before = stored();
        const recorded = snapshot('config.change', op) || snapshot(`config.change:${path}`, op);
        start = recorded && !op && !ownHistory() && before ? readTrialEdit(before) : null;
      }
      const gesture = { path, at: Date.now(), version: version(), start, open: draft, key };
      lastWriteRef.current = gesture;
      return gesture;
    },
    [lastWriteRef, stored, snapshot, ownHistory, version],
  );

  /** A gesture back where it started has made no step: take back the one its first write recorded. */
  const takeBackIfUnchanged = useCallback((): void => {
    const start = lastWriteRef.current?.start;
    const now = stored();
    const history = now?.history;
    if (!start || !now || !history?.canUndo() || !deepEqual(readTrialEdit(now), start)) return;
    history.undo();
    history.dropRedo();
    lastWriteRef.current = null;
  }, [lastWriteRef, stored]);

  return { version, continuing, keyFor, recordWrite, takeBackIfUnchanged };
}
