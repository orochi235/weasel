import { type MutableRefObject, useCallback, useMemo, useRef } from 'react';
import { useTrialClockSetup } from '../clock/useTrialClockSetup';
import type { Instrument } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';

/** A trial's clock (`useTrialClockSetup`), gated on the trial's root element, which `root` is for the trial to
 *  attach; and `ticks`, its frames as a canvas reads them, while it has one. */
export function useTrialClock(args: {
  instrument: Instrument;
  config: unknown;
  record: TrialRecord;
  store: LabStore;
}): ReturnType<typeof useTrialClockSetup> & {
  root: MutableRefObject<HTMLElement | null>;
  ticks: ((fn: () => void) => () => void) | undefined;
} {
  const root = useRef<HTMLElement | null>(null);
  const target = useCallback(() => root.current, []);
  const { handle, provided } = useTrialClockSetup({ ...args, target });
  const ticks = useMemo(
    () => (handle ? (fn: () => void) => handle.onFrame(() => fn()) : undefined),
    [handle],
  );
  return { root, handle, provided, ticks };
}
