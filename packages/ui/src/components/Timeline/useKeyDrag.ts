import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/routing';
import { useKitSetting, useLatest } from '@weasel-js/react';
import { sliderAt, spanMap } from '@weasel-js/ui-input';
import { useSnapRadiusPx } from '../../snap';
import type { TimeWindow } from './timeScale';
import { isPrimaryPress, pastDragThreshold } from '@weasel-js/gestures';
import { alongTrack } from '../../alongTrack';

/** What a lane's pointer reads: its track, the window laid across it, and the keys on it. */
export interface KeyDragArgs {
  trackRef: RefObject<HTMLDivElement | null>;
  window: TimeWindow;
  /** Where the row's own time starts on the ruler. */
  offset: number;
  /** The ruler time no key moves past, the end of what the ruler can show. Default `Infinity`. */
  limit?: number;
  /** Ruler times a dragged key is pulled onto, as they are when it is pressed. */
  snapTimes: readonly number[];
  /** The row's key times, in its own time. */
  times: readonly number[];
  onSelect: (keyIndex: number) => void;
  onKeyInput: (keyIndex: number, toMs: number) => void;
  onKeyChange: (keyIndex: number, toMs: number) => void;
  /** A drag was canceled: put its preview back. */
  onRevert?: () => void;
  /** A drag was canceled, after its preview was put back. */
  onCancel?: () => void;
  /** False: a press selects the key and moves nothing. Default true. */
  drags?: boolean;
}

/**
 * A lane as a slider track windowed onto the timeline: `msAt` is the row's own time under a pointer, and
 * `onKeyPointerDown` drags a key along it, pulled onto `snapTimes` unless Alt is held. `drag` is where the dragged
 * key would land, held here so a drag previews whether or not the consumer wires `onKeyInput`, with the key times it
 * began from.
 */
export function useKeyDrag(a: KeyDragArgs) {
  const { trackRef, window: win, offset, limit = Infinity, snapTimes, times, onSelect, onKeyInput, onKeyChange, onRevert, onCancel, drags = true } = a;
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);
  const [drag, setDrag] = useState<{ keyIndex: number; t: number; times: readonly number[] } | null>(null);
  const snapRadiusPx = useSnapRadiusPx();
  const dragPx = useKitSetting('gestures.dragPx');

  const place = (clientX: number): { f: number; width: number } => alongTrack(trackRef.current, clientX) ?? { f: 0, width: 0 };
  // The track reads ruler times, which `snapTimes` are; the row's keys are measured from its own start.
  const track = { min: offset, max: Math.max(offset, limit), ...spanMap(win) };
  const msAt = (clientX: number): number => sliderAt(place(clientX).f, track) - offset;
  // Read as the pointer moves, so a window changed mid-drag places the key where its ghost is drawn. The stops are the
  // ones at press: a consumer echoing the preview back would otherwise add the dragged key's own last time to them.
  const at = useLatest((ev: { clientX: number; altKey: boolean }, stops: readonly number[]): number => {
    const { f, width } = place(ev.clientX);
    // An empty window puts every time at one place, where every stop would be in reach.
    const free = ev.altKey || !(win.to > win.from);
    const pull = width === 0 ? 0 : snapRadiusPx / width;
    return sliderAt(f, { ...track, stops, pull, free }) - offset;
  });

  const onKeyPointerDown = (i: number) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isPrimaryPress(e)) return;
    e.stopPropagation();
    // A key drag belongs to the finger that started it: a second finger's press selects nothing and drags nothing.
    if (sessionRef.current?.active) return;
    onSelect(i);
    if (!drags) return;

    setDrag({ keyIndex: i, t: times[i], times });
    const stops = snapTimes;

    // A press that never travels is a click: it selects and moves nothing.
    const start = { clientX: e.clientX, clientY: e.clientY };
    let dragging = false;
    let previewed = false;
    const traveled = (ev: PointerEvent): boolean => (dragging ||= pastDragThreshold(start, ev, dragPx));

    const end = (): void => {
      setDrag(null);
      sessionRef.current = null;
    };
    // No pointer capture — see `Ruler`, same idiom across the timeline.
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        if (!traveled(ev)) return;
        const t = at.current(ev, stops);
        setDrag({ keyIndex: i, t, times });
        previewed = true;
        onKeyInput(i, t);
      },
      // A drag released back on its own time changes nothing, so a preview it sent is put back as for a cancel.
      onEnd: (ev) => {
        const t = traveled(ev) ? at.current(ev, stops) : times[i];
        if (t !== times[i]) onKeyChange(i, t);
        else if (previewed) { onRevert?.(); onCancel?.(); }
        end();
      },
      // The consumer previewed the move through `onKeyInput`; a drag that ends without a release puts it back.
      onCancel: () => {
        end();
        if (!dragging) return;
        onRevert?.();
        onCancel?.();
      },
    }, { capture: false, escape: true });
  };

  return { drag, msAt, onKeyPointerDown };
}
