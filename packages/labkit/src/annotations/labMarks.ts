import type { RecordCache } from '@weasel-js/storage';
import { useCallback, useSyncExternalStore } from 'react';
import type { Instrument, InstrumentList } from '../instrument/types';
import { valueRecord } from '../state/labRecords';

/** The command View → Marks runs. */
export const MARKS_COMMAND = 'lab.marks';

const MARKS_RECORD = valueRecord(null, 'labkit.marks');

/** Whether any of these instruments takes marks, which is when a lab offers the Marks switch. */
export const takesMarks = (instruments: InstrumentList): boolean =>
  instruments.some((i) => i.annotations != null);

/** `instrument` as the lab's Marks switch leaves it: hidden marks take what `annotations` brings with them. */
export const withMarks = (instrument: Instrument, shown: boolean): Instrument =>
  shown || instrument.annotations == null ? instrument : { ...instrument, annotations: undefined };

/**
 * Whether the lab shows marks: `initial` until someone flips it, then their choice, kept in the lab's records so a
 * stored lab reopens the way it was left.
 */
export function useLabMarks(records: RecordCache, initial: boolean): [boolean, (shown: boolean) => void] {
  const subscribe = useCallback(
    (notify: () => void) =>
      records.subscribe((changes) => {
        if (changes.some((c) => c.name === MARKS_RECORD)) notify();
      }),
    [records],
  );
  const read = (): boolean => {
    const kept = records.get(MARKS_RECORD);
    return typeof kept === 'boolean' ? kept : initial;
  };
  const shown = useSyncExternalStore(subscribe, read, read);
  const set = useCallback((next: boolean) => records.set(MARKS_RECORD, next), [records]);
  return [shown, set];
}
