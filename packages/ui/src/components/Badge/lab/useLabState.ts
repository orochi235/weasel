import { useCallback, useEffect, useRef, useState } from 'react';
import { historyKey, useLatest } from '@weasel-js/core';
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
 * still for `COALESCE_MS`.
 */
function useSnapshotHistory(snap: LabSnapshot, restore: (snap: LabSnapshot) => void): void {
  const undoStack = useRef<LabSnapshot[]>([snap]);
  const redoStack = useRef<LabSnapshot[]>([]);
  const restoring = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useLatest({ snap, restore });

  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      const top = undoStack.current[undoStack.current.length - 1];
      if (top && same(top, snap)) return;
      undoStack.current.push(snap);
      if (undoStack.current.length > MAX_UNDO_STEPS) undoStack.current.shift();
      redoStack.current = [];
    }, COALESCE_MS);
  }, [snap]);

  useEffect(() => {
    const recordPending = () => {
      if (!pending.current) return;
      clearTimeout(pending.current);
      pending.current = null;
      const top = undoStack.current[undoStack.current.length - 1];
      if (top && same(top, latest.current.snap)) return;
      undoStack.current.push(latest.current.snap);
      redoStack.current = [];
    };
    const apply = (to: LabSnapshot) => {
      restoring.current = true;
      latest.current.restore(to);
    };
    const undo = () => {
      recordPending();
      if (undoStack.current.length < 2) return;
      const undone = undoStack.current.pop();
      if (undone) redoStack.current.push(undone);
      apply(undoStack.current[undoStack.current.length - 1]);
    };
    const redo = () => {
      const next = redoStack.current.pop();
      if (!next) return;
      undoStack.current.push(next);
      apply(next);
    };
    const onKey = (e: KeyboardEvent) => {
      const step = historyKey(e);
      if (!step) return;
      e.preventDefault();
      if (step === 'undo') undo();
      else redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [latest]);
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
