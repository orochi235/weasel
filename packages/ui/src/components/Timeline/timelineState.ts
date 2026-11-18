import { useState } from 'react';
import type { KeySelection } from './keys';
import type { TimeWindow } from './timeScale';

/** A value held here unless `given` is, reporting each change to `onChange` either way. */
export function useHeld<T>(given: T | undefined, initial: T, onChange?: (next: T) => void): [T, (next: T) => void] {
  const [own, setOwn] = useState<T>(initial);
  const set = (next: T): void => {
    if (given === undefined) setOwn(next);
    onChange?.(next);
  };
  return [given !== undefined ? given : own, set];
}

/** The time window a timeline shows: `given` when controlled, else its own, which is the whole duration until zoomed. */
export function useTimeWindow(given: TimeWindow | undefined, duration: number, onWindowChange?: (w: TimeWindow) => void) {
  // Null until the user zooms in, so the window follows a duration that changes.
  const [own, setOwn] = useState<TimeWindow | null>(null);
  const bounds: TimeWindow = { from: 0, to: duration };
  const setWindow = (w: TimeWindow): void => {
    if (given === undefined) setOwn(w.from <= 0 && w.to >= duration ? null : w);
    onWindowChange?.(w);
  };
  return { win: given ?? own ?? bounds, bounds, setWindow };
}

/**
 * A timeline's selected key, held unless `given`, and its selected segment, always held here. A key and a segment are
 * one selection: taking either gives up the other.
 */
export function useKeyAndSegment(given: KeySelection | null | undefined, onSelectionChange?: (sel: KeySelection | null) => void) {
  const [selection, setSelection] = useHeld<KeySelection | null>(given, null, onSelectionChange);
  // By key index, so an edit that renumbers a track's keys drops it.
  const [segmentSelection, setSegmentSelection] = useState<KeySelection | null>(null);
  const selectKey = (sel: KeySelection | null): void => {
    setSelection(sel);
    setSegmentSelection(null);
  };
  const selectSegment = (sel: KeySelection): void => {
    setSegmentSelection(sel);
    if (selection) setSelection(null);
  };
  const dropSegment = (): void => setSegmentSelection(null);
  return { selection, segmentSelection, selectKey, selectSegment, dropSegment };
}
