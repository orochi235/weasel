import type { RecordCache } from '@weasel-js/storage';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Instrument, InstrumentList } from '../instrument/types';
import { useLabCommandsOptional } from '../lab/LabContext';
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

/** A lab's marks: whether they show, its Marks switch, and a hold that shows them past the switch. */
export interface LabMarks {
  /** Whether marks show: the switch is on, or something holds them. */
  shown: boolean;
  set: (shown: boolean) => void;
  hold: () => () => void;
}

/**
 * Whether the lab shows marks: `initial` until someone flips it, then their choice, kept in the lab's records so a
 * stored lab reopens the way it was left. A hold shows them whatever the switch says, until it is released, and is
 * never stored.
 */
export function useLabMarks(records: RecordCache, initial: boolean): LabMarks {
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
  const switched = useSyncExternalStore(subscribe, read, read);
  const set = useCallback((next: boolean) => records.set(MARKS_RECORD, next), [records]);
  const [holds, setHolds] = useState(0);
  const hold = useCallback(() => {
    setHolds((n) => n + 1);
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      setHolds((n) => n - 1);
    };
  }, []);
  return { shown: switched || holds > 0, set, hold };
}

/**
 * Show the surrounding lab's marks while `held` is true, whatever its Marks switch says: for a panel whose work
 * needs them, such as a report that marks up the trial before a screenshot. Outside a lab it does nothing.
 */
export function useHoldMarks(held: boolean): void {
  const hold = useLabCommandsOptional()?.holdMarks;
  useEffect(() => (held && hold ? hold() : undefined), [held, hold]);
}
