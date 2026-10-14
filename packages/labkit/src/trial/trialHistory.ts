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
 * An undo history an instrument keeps itself — a weasel `Scene` is one as it
 * stands — which the trial's undo and redo then step instead of its own
 * snapshots of `state`.
 */
export interface TrialHistorySource {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): unknown;
  redo(): unknown;
  /** Called whenever `canUndo` or `canRedo` may have changed. */
  subscribe(listener: () => void): () => void;
}

/** Reports a history mounted; the returned function reports it gone. */
export type MountTrialHistory = (source: TrialHistorySource) => () => void;

/** The history slot of the trial around the caller, or `null` outside one. */
export const TrialHistoryContext = createContext<MountTrialHistory | null>(null);

/**
 * Hands the trial around the caller a history of the instrument's own. While
 * it is mounted, the trial's Undo and Redo buttons and their keys step it, and
 * `setState` stops snapshotting — that stack would never be stepped. The
 * buttons still come from declaring `undo` on the instrument. Pass `null` to
 * hand nothing over; outside a trial it does nothing.
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
  /** Whether one is mounted now, ahead of the render that shows it — a write
   *  in the same commit as the mount must already see it. */
  holds: () => boolean;
} {
  const [mounted, setMounted] = useState<readonly TrialHistorySource[]>([]);
  const count = useRef(0);
  const mount = useCallback<MountTrialHistory>((source) => {
    count.current += 1;
    setMounted((list) => [...list, source]);
    return () => {
      count.current -= 1;
      setMounted((list) => list.filter((s) => s !== source));
    };
  }, []);
  const holds = useCallback(() => count.current > 0, []);
  const history = mounted.at(-1) ?? null;
  const subscribe = useMemo(
    () => (history ? (listener: () => void) => history.subscribe(listener) : NO_SUBSCRIBE),
    [history],
  );
  useSyncExternalStore(subscribe, () =>
    history ? `${history.canUndo()}:${history.canRedo()}` : '',
  );
  return { mount, history, holds };
}
