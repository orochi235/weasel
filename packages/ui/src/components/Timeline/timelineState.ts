import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { arrowMove } from '@weasel-js/quantity';
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

/** Which nested rows are open, by row key. Folding one drops a key or segment selection on a row under it. */
export function useFolds(sel: {
  selection: KeySelection | null;
  segmentSelection: KeySelection | null;
  selectKey: (sel: KeySelection | null) => void;
  dropSegment: () => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string): void => {
    const folding = expanded.has(key);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    if (!folding) return;
    const under = (s: KeySelection | null): boolean => s !== null && s.trackPath.join('.').startsWith(`${key}.`);
    if (under(sel.selection)) sel.selectKey(null);
    else if (under(sel.segmentSelection)) sel.dropSegment();
  };
  return { expanded, toggle };
}

const selectionKey = (sel: KeySelection | null | undefined): string =>
  (sel ? `${sel.trackPath.join('.')}:${sel.keyIndex}` : String(sel));

function keyTimesAt(tracks: readonly Track[], path: readonly number[]): string {
  const track = trackAtPath(tracks, path);
  return track?.kind === 'sampled' ? track.keys.map((k) => k.t).join(',') : '';
}

/**
 * Refuses key edits from the keyboard while a press on the lanes is held: the drag's release commits against the tracks
 * it began from, and would undo them. `onPointerDownCapture` goes on the lanes, `onKeyDownCapture` on the root.
 */
export function useKeyEditsHeldByPress() {
  // Each pointer pressed on the lanes and not yet let go, so a second finger lifting leaves the first one's drag held.
  const pressed = useRef(new Set<number>());
  const onPointerDownCapture = (e: ReactPointerEvent): void => {
    if (e.button !== 0) return;
    const id = e.pointerId;
    pressed.current.add(id);
    const release = (ev: PointerEvent): void => {
      if (ev.pointerId !== id || (ev.type === 'pointermove' && ev.buttons !== 0)) return;
      pressed.current.delete(id);
      for (const type of ['pointerup', 'pointercancel', 'pointermove'] as const) window.removeEventListener(type, release, true);
    };
    // Capture, so the press lets go before the drag's own release commits.
    for (const type of ['pointerup', 'pointercancel', 'pointermove'] as const) window.addEventListener(type, release, true);
  };
  const onKeyDownCapture = (e: ReactKeyboardEvent): void => {
    if (pressed.current.size === 0) return;
    if (e.target !== e.currentTarget && !(e.target as Element).closest?.('[data-lane-key]')) return;
    if (arrowMove(e.key, e.shiftKey) || e.key === 'Delete' || e.key === 'Backspace') e.stopPropagation();
  };
  return { onPointerDownCapture, onKeyDownCapture };
}
