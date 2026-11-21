import { useState } from 'react';
import type { Track } from '@weasel-js/animator';
import type { KeySelection } from './keys';
import { trackAtPath } from './lanes';
import { spanClamp } from '@weasel-js/ui-input';
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

/** The time window a timeline shows: `given` when controlled, else its own, which is the whole duration until zoomed
 *  and is kept inside a duration that shrinks under it. */
export function useTimeWindow(given: TimeWindow | undefined, duration: number, onWindowChange?: (w: TimeWindow) => void) {
  // Null until the user zooms in, so the window follows a duration that changes.
  const [own, setOwn] = useState<TimeWindow | null>(null);
  const bounds: TimeWindow = { from: 0, to: duration };
  const setWindow = (w: TimeWindow): void => {
    if (given === undefined) setOwn(w.from <= 0 && w.to >= duration ? null : w);
    onWindowChange?.(w);
  };
  return { win: given ?? (own ? spanClamp(own, bounds) : bounds), bounds, setWindow };
}

/**
 * A timeline's selected key, held unless `given`, and its selected segment, always held here. A key and a segment are
 * one selection: taking either gives up the other, and a key selection arriving through `given` drops the segment.
 */
export function useKeyAndSegment(
  given: KeySelection | null | undefined, tracks: readonly Track[], onSelectionChange?: (sel: KeySelection | null) => void,
) {
  const [selection, setSelection] = useHeld<KeySelection | null>(given, null, onSelectionChange);
  // By key index, so it is dropped once its track's key times change and the index may name another segment.
  const [segment, setSegment] = useState<{ sel: KeySelection; times: string } | null>(null);
  const [givenKey, setGivenKey] = useState(selectionKey(given));
  const nextGivenKey = selectionKey(given);
  if (nextGivenKey !== givenKey) {
    setGivenKey(nextGivenKey);
    if (given) setSegment(null);
  }
  if (segment && keyTimesAt(tracks, segment.sel.trackPath) !== segment.times) setSegment(null);

  const selectKey = (sel: KeySelection | null): void => {
    setSelection(sel);
    setSegment(null);
  };
  const selectSegment = (sel: KeySelection): void => {
    setSegment({ sel, times: keyTimesAt(tracks, sel.trackPath) });
    if (selection) setSelection(null);
  };
  const dropSegment = (): void => setSegment(null);
  return { selection, segmentSelection: segment?.sel ?? null, selectKey, selectSegment, dropSegment };
}

const selectionKey = (sel: KeySelection | null | undefined): string =>
  (sel ? `${sel.trackPath.join('.')}:${sel.keyIndex}` : String(sel));

function keyTimesAt(tracks: readonly Track[], path: readonly number[]): string {
  const track = trackAtPath(tracks, path);
  return track?.kind === 'sampled' ? track.keys.map((k) => k.t).join(',') : '';
}
