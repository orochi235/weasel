import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { openPointerSession, useLatest, type PointerSession } from '@weasel-js/core';
import s from './Timeline.module.css';
import { decimalsOf, linearScale, type TickSet } from '@weasel-js/plot/scales';
import { sliderAt, spanMap, spanPan, spanZoom } from '@weasel-js/ui-input';
import { Ruler, RulerMark, type RulerSpacing } from '../Ruler';
import { MIN_SPAN_MS, TICK_SPACING_PX, type TimeWindow } from './timeScale';
import { isPrimaryPress } from '@weasel-js/gestures';

/** One wheel notch's zoom factor. */
const ZOOM_STEP = 0.0015;

/** Props for {@link TimeRuler}. */
export interface TimeRulerProps {
  /** The span of time the ruler shows. */
  window: TimeWindow;
  /** The full extent the window may cover — normally `{ from: 0, to: duration }`. */
  bounds: TimeWindow;
  /** Where the playhead line sits, in ms. */
  playhead: number;
  /** Called with the time under the pointer while the ruler is pressed or dragged. */
  onScrub: (t: number) => void;
  /** Called with the new window when the wheel pans, or Ctrl+wheel zooms, within `bounds`. */
  onWindowChange: (w: TimeWindow) => void;
}

/** A tick's label, with the decimals ticks `step` ms apart need to differ. */
function formatMs(ms: number, { step, decimals }: TickSet): string {
  if (ms >= 1000) {
    const whole = Math.abs(ms / 1000 - Math.round(ms / 1000)) < 1e-9;
    return `${(ms / 1000).toFixed(whole ? 0 : Math.max(2, decimalsOf(step / 1000)))}s`;
  }
  return `${ms.toFixed(decimals)}ms`;
}

const TIME_TICKS: RulerSpacing = { minSpacing: TICK_SPACING_PX, format: formatMs };

/** A {@link Ruler} over time: a playhead line, scrubbing by pointer, and wheel pan and zoom. */
export function TimeRuler(props: TimeRulerProps): ReactElement {
  const { window: win, bounds, playhead, onScrub, onWindowChange } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  const scale = useMemo(() => linearScale({ domain: [win.from, win.to], range: [0, 1] }), [win.from, win.to]);

  const widthOf = (): number => trackRef.current?.getBoundingClientRect().width ?? 0;
  const msAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return win.from;
    return sliderAt((clientX - rect.left) / rect.width, { min: win.from, max: win.to, ...spanMap(win) });
  };

  // `capture: false`: the session tracks the pointer off the ruler on its own,
  // and capture would retarget pointerup and kill the click on non-native
  // children of the scrubbed track.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isPrimaryPress(e) || sessionRef.current?.active) return;
    onScrub(msAt(e.clientX));

    const end = (): void => { sessionRef.current = null; };
    sessionRef.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => { onScrub(msAt(ev.clientX)); },
      onEnd: end,
      onCancel: end,
    }, { capture: false });
  };

  const onWheel = useLatest((e: WheelEvent): void => {
    if (e.ctrlKey) {
      e.preventDefault();
      onWindowChange(spanZoom(win, msAt(e.clientX), Math.exp(e.deltaY * ZOOM_STEP), bounds, MIN_SPAN_MS));
      return;
    }
    const width = widthOf();
    const perPx = width === 0 ? 0 : (win.to - win.from) / width;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const next = spanPan(win, delta * perPx, bounds);
    // At either end the wheel goes back to scrolling the page.
    if (next.from === win.from && next.to === win.to) return;
    e.preventDefault();
    onWindowChange(next);
  });
  // Not a React `onWheel`: React's wheel listeners are passive and cannot keep
  // the page from zooming or scrolling under the ruler.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const listener = (e: WheelEvent): void => onWheel.current(e);
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, [onWheel]);

  return (
    <Ruler
      ref={trackRef}
      className={s.ruler}
      look="line"
      scale={scale}
      ticks={TIME_TICKS}
      data-testid="timeline-ruler"
      onPointerDown={onPointerDown}
    >
      <RulerMark at={playhead} cursor data-testid="timeline-playhead" />
    </Ruler>
  );
}
