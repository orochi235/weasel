import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { arrowMove } from '@weasel-js/quantity';
import { useLatest } from '@weasel-js/react';
import type { Track } from '@weasel-js/animator';
import { samePath, type KeyEdit, type KeySelection } from './keys';
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
 * Either is dropped once its track changes by an edit the timeline did not send through `send`, which may have moved
 * its index onto another key; a key selection so dropped is reported as `null`. `inspected` is the selection as it reads
 * in a key drag's preview, once the tracks show it: the preview can re-sort the dragged key to another index.
 */
export function useKeyAndSegment(
  given: KeySelection | null | undefined, tracks: readonly Track[], onSelectionChange?: (sel: KeySelection | null) => void,
) {
  const [held, setHeld] = useHeld<KeySelection | null>(given, null, onSelectionChange);
  const [keyPin, setKeyPin] = useState<{ id: string; reads: string } | null>(null);
  const [segment, setSegment] = useState<{ sel: KeySelection; reads: string } | null>(null);
  // The tracks this timeline last sent out: a track reading as it does there changed by the timeline's own edit.
  const [sent, setSent] = useState<readonly Track[] | null>(null);
  const [previewed, setPreviewed] = useState<KeyEdit | null>(null);
  const [givenKey, setGivenKey] = useState(selectionKey(given));
  const nextGivenKey = selectionKey(given);
  if (nextGivenKey !== givenKey) {
    setGivenKey(nextGivenKey);
    if (given) setSegment(null);
  }
  /** How the track at `path` reads now, or `null` when something other than the timeline changed it from `reads`. */
  const readsOwn = (path: readonly number[], reads: string): string | null => {
    const now = trackReading(tracks, path);
    return now === reads || (sent !== null && trackReading(sent, path) === now) ? now : null;
  };

  let stale: string | null = null;
  if (held) {
    const id = selectionKey(held);
    const now = keyPin?.id === id ? readsOwn(held.trackPath, keyPin.reads) : trackReading(tracks, held.trackPath);
    if (now === null) stale = id;
    else if (keyPin?.id !== id || keyPin.reads !== now) setKeyPin({ id, reads: now });
  } else if (keyPin) setKeyPin(null);
  if (segment) {
    const now = readsOwn(segment.sel.trackPath, segment.reads);
    if (now === null) setSegment(null);
    else if (now !== segment.reads) setSegment({ ...segment, reads: now });
  }
  const drop = useLatest(() => setHeld(null));
  useEffect(() => { if (stale !== null) drop.current(); }, [stale, drop]);
  const selection = stale === null ? held : null;
  const pv = previewed?.selection;
  const inspected = selection && pv && samePath(pv.trackPath, selection.trackPath)
    && trackReading(tracks, pv.trackPath) === trackReading(previewed.tracks, pv.trackPath) ? pv : selection;

  /** Selects `sel`, as it reads in `after` when the same edit changes the tracks. */
  const selectKey = (sel: KeySelection | null, after: readonly Track[] = tracks): void => {
    setHeld(sel);
    setKeyPin(sel ? { id: selectionKey(sel), reads: trackReading(after, sel.trackPath) } : null);
    setSegment(null);
    setPreviewed(null);
  };
  const selectSegment = (sel: KeySelection): void => {
    setSegment({ sel, reads: trackReading(tracks, sel.trackPath) });
    if (selection) setHeld(null);
  };
  const dropSegment = (): void => setSegment(null);
  const send = (next: readonly Track[]): void => setSent(next);
  return { selection, inspected, segmentSelection: segment?.sel ?? null, selectKey, selectSegment, dropSegment, send, preview: setPreviewed };
}

/** Which nested rows are open, by `LaneRow.fold`. Folding one drops a key or segment selection on a row under it. */
export function useFolds(sel: {
  selection: KeySelection | null;
  segmentSelection: KeySelection | null;
  selectKey: (sel: KeySelection | null) => void;
  dropSegment: () => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (row: { fold: string; key: string }): void => {
    const { fold, key } = row;
    const folding = expanded.has(fold);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fold)) next.delete(fold); else next.add(fold);
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

/** A track's kind, label, and key or event times: what an index into it is read against. */
function trackReading(tracks: readonly Track[], path: readonly number[]): string {
  const track = trackAtPath(tracks, path);
  if (!track) return '';
  const times = track.kind === 'sampled' ? track.keys.map((k) => k.t) : track.kind === 'event' ? track.events.map((e) => e.t) : [];
  return `${track.kind}:${track.label ?? ''}:${times.join(',')}`;
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
