import { useCallback, useEffect, useRef, useState } from 'react';
import { historyKey, useLatest } from '@weasel-js/core';
import { createHistory, swapOp } from '@weasel-js/history';
import { initialSnapshot, loadLabSnapshot, saveLabSnapshot, type LabSnapshot } from './snapshot';

/** How long the lab must sit still before a run of changes becomes one undo step. */
const COALESCE_MS = 300;
const MAX_UNDO_STEPS = 200;

const same = (a: LabSnapshot, b: LabSnapshot): boolean => JSON.stringify(a) === JSON.stringify(b);

export type LabArgs = Parameters<typeof initialSnapshot>[1];

/** Fields to overwrite, or a function from the current snapshot to them. */
export type LabChange = Partial<LabSnapshot> | ((snap: LabSnapshot) => Partial<LabSnapshot>);

/**
 * Undo and redo over whole snapshots, on the platform's history keys. A scrub
 * or a drag is many changes; they collapse into one step once the lab has been
 * still for `COALESCE_MS`, or as soon as undo or redo is pressed.
 */
function useSnapshotHistory(snap: LabSnapshot, restore: (snap: LabSnapshot) => void): void {
  const [history] = useState(() => createHistory(null, { historyLimit: MAX_UNDO_STEPS }));
  /** Where the newest step ends: the lab as last recorded or restored. */
  const settled = useRef(snap);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useLatest({ snap, restore });

  const settle = useLatest(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    const before = settled.current;
    const after = latest.current.snap;
    if (same(before, after)) return;
    settled.current = after;
    history.recordEntry([swapOp({
      name: 'badge-lab.snapshot',
      label: 'edit',
      before,
      after,
      emit: (to) => {
        settled.current = to;
        latest.current.restore(to);
      },
    })], 'edit');
  });

  useEffect(() => {
    if (snap === settled.current) return;
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => settle.current(), COALESCE_MS);
  }, [snap, settle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = historyKey(e);
      if (!step) return;
      e.preventDefault();
      settle.current();
      history[step]();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (pending.current) clearTimeout(pending.current);
    };
  }, [history, settle]);
}

/** The lab's snapshot, kept in local storage and stepped through by undo and redo. */
export function useLabState(args: LabArgs): readonly [LabSnapshot, (change: LabChange) => void] {
  const [snap, setSnap] = useState<LabSnapshot>(() => initialSnapshot(loadLabSnapshot(), args));
  useEffect(() => {
    saveLabSnapshot(snap);
  }, [snap]);
  useSnapshotHistory(snap, setSnap);
  const change = useCallback((next: LabChange) => {
    setSnap((current) => ({ ...current, ...(typeof next === 'function' ? next(current) : next) }));
  }, []);
  return [snap, change];
}
