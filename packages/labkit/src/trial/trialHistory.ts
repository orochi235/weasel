import type { History, Op } from '@weasel-js/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/**
 * An undo history an instrument keeps itself, which the trial's undo and redo
 * then step instead of its own snapshots of `state`. `<TrialSceneCanvas>`
 * hands over a weasel scene's.
 */
export interface TrialHistorySource {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): unknown;
  redo(): unknown;
  /** When the step `undo` would take back was recorded, in `Date.now()`
   *  milliseconds; `undefined` with none. With this and `redoStamp`, the
   *  trial orders the instrument's steps against its marks by time; without,
   *  its Undo takes back marks first. */
  undoStamp?(): number | undefined;
  /** When the step `redo` would make again was first recorded. */
  redoStamp?(): number | undefined;
  /** Drop every step `redo` could make again, keeping the undo steps: the
   *  trial calls it when a change lands on its marks. Without it, and without
   *  `undoStamp`, a new change on either side leaves the other's redo in
   *  place, so Redo can make a step again over a later change. */
  dropRedo?(): void;
  /** Drop every step, both ways: the trial calls it when it starts its undo
   *  afresh, on Reset or a snapshot loaded over it. Without it, the settings
   *  entries the trial recorded here stay on the stack and write nothing. */
  clear?(): void;
  /** Called whenever `canUndo` or `canRedo` may have changed. */
  subscribe(listener: () => void): () => void;
  /** Take an entry the trial records itself — a settings change — onto this
   *  stack, already applied, so one undo order covers both. */
  record(op: Op, label: string): void;
}

/** Reports a history mounted; the returned function reports it gone. */
export type MountTrialHistory = (source: TrialHistorySource) => () => void;

/** The history slot of the trial around the caller, or `null` outside one. */
export const TrialHistoryContext = createContext<MountTrialHistory | null>(null);

/**
 * Hands the trial around the caller a history of the instrument's own. While
 * it is mounted, the trial's Undo and Redo buttons and their keys step it,
 * settings changes are recorded onto it, and the trial stops snapshotting
 * `state` — the instrument's history is what covers it. Pass `null` to hand
 * nothing over; outside a trial it does nothing.
 */
export function useTrialHistory(source: TrialHistorySource | null): void {
  const mount = useContext(TrialHistoryContext);
  useEffect(() => {
    if (!mount || !source) return;
    return mount(source);
  }, [mount, source]);
}

const NO_SUBSCRIBE = () => () => {};

/**
 * The trial's side of {@link useTrialHistory}: the slot to provide, and the
 * history most recently mounted in it, re-rendering the caller as that
 * history's undo and redo availability changes.
 */
export function useMountedHistory(): {
  mount: MountTrialHistory;
  history: TrialHistorySource | null;
  /** The one mounted now, ahead of the render that shows it — a write in the
   *  same commit as the mount must already see it. */
  current: () => TrialHistorySource | null;
} {
  const [mounted, setMounted] = useState<readonly TrialHistorySource[]>([]);
  const live = useRef<readonly TrialHistorySource[]>([]);
  const mount = useCallback<MountTrialHistory>((source) => {
    live.current = [...live.current, source];
    setMounted(live.current);
    return () => {
      live.current = live.current.filter((s) => s !== source);
      setMounted(live.current);
    };
  }, []);
  const current = useCallback(() => live.current.at(-1) ?? null, []);
  const history = mounted.at(-1) ?? null;
  const subscribe = useMemo(
    () => (history ? (listener: () => void) => history.subscribe(listener) : NO_SUBSCRIBE),
    [history],
  );
  useSyncExternalStore(subscribe, () =>
    history ? `${history.canUndo()}:${history.canRedo()}` : '',
  );
  return { mount, history, current };
}

/** `history`, re-rendering the caller whenever it changes. */
export function useHistoryVersion(history: History | undefined): History | undefined {
  useSyncExternalStore(history?.subscribe ?? NO_SUBSCRIBE, () => history?.getVersion() ?? 0);
  return history;
}
