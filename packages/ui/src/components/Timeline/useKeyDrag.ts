import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { openPointerSession, pastDragThreshold, type PointerSession } from '@weasel-js/core';
import { useKitSetting } from '@weasel-js/react';
import { sliderAt, spanMap } from '@weasel-js/ui-logic';
import { useSnapRadiusPx } from '../../snap';
import type { TimeWindow } from './timeScale';

/** What a lane's pointer reads: its track, the window laid across it, and the keys on it. */
export interface KeyDragArgs {
  trackRef: RefObject<HTMLDivElement | null>;
  window: TimeWindow;
  /** Where the row's own time starts on the ruler. */
  offset: number;
  /** Ruler times a dragged key is pulled onto. */
  snapTimes: readonly number[];
  /** The row's key times, in its own time. */
  times: readonly number[];
  onSelect: (keyIndex: number) => void;
  onKeyInput: (keyIndex: number, toMs: number) => void;
  onKeyCommit: (keyIndex: number, toMs: number) => void;
}

/**
 * A lane as a slider track windowed onto the timeline: `msAt` is the row's own time under a pointer, and
 * `onKeyPointerDown` drags a key along it, pulled onto `snapTimes` unless Alt is held. `drag` is where the dragged
 * key would land, held here so a drag previews whether or not the consumer wires `onKeyInput`.
 */
export function useKeyDrag(a: KeyDragArgs) {
  const { trackRef, window: win, offset, snapTimes, times, onSelect, onKeyInput, onKeyCommit } = a;
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);
  const [drag, setDrag] = useState<{ keyIndex: number; t: number } | null>(null);
  const snapRadiusPx = useSnapRadiusPx();
  const dragPx = useKitSetting('gestures.dragPx');

  const place = (clientX: number): { f: number; width: number } => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? { f: (clientX - rect.left) / rect.width, width: rect.width } : { f: 0, width: 0 };
  };
  // The track reads ruler times, which `snapTimes` are; the row's keys are measured from its own start.
  const track = { min: offset, max: Infinity, ...spanMap(win) };
  const msAt = (clientX: number): number => sliderAt(place(clientX).f, track) - offset;

  const onKeyPointerDown = (i: number) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(i);

    const at = (ev: { clientX: number; altKey: boolean }): number => {
      const { f, width } = place(ev.clientX);
      // An empty window puts every time at one place, where every stop would be in reach.
      const free = ev.altKey || !(win.to > win.from);
      const pull = width === 0 ? 0 : snapRadiusPx / width;
      return sliderAt(f, { ...track, stops: snapTimes, pull, free }) - offset;
    };

    setDrag({ keyIndex: i, t: times[i] });

    // A press that never travels is a click: it selects and moves nothing.
    const start = { clientX: e.clientX, clientY: e.clientY };
    let dragging = false;
    const traveled = (ev: PointerEvent): boolean => (dragging ||= pastDragThreshold(start, ev, dragPx));

    const end = (): void => {
      setDrag(null);
      sessionRef.current = null;
    };
    // No pointer capture — see `Ruler`, same idiom across the timeline.
    sessionRef.current?.cancel();
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        if (!traveled(ev)) return;
        setDrag({ keyIndex: i, t: at(ev) });
        onKeyInput(i, at(ev));
      },
      onEnd: (ev) => {
        if (traveled(ev)) onKeyCommit(i, at(ev));
        end();
      },
      onCancel: end,
    }, { capture: false });
  };

  return { drag, msAt, onKeyPointerDown };
}
