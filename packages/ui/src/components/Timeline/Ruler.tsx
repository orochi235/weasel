import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { openPointerSession, useLatest, type PointerSession } from '@weasel-js/core';
import s from './Timeline.module.css';
import { stepDecimals, type TickSet } from '../Plot2D/ticks';
import { createTimeScale, panWindow, TICK_SPACING_PX, tickTimes, toPercent, zoomWindow, type TimeWindow } from './timeScale';

/** One wheel notch's zoom factor. */
const ZOOM_STEP = 0.0015;

/** Props for {@link Ruler}. */
export interface RulerProps {
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
    return `${(ms / 1000).toFixed(whole ? 0 : Math.max(2, stepDecimals(step / 1000)))}s`;
  }
  return `${ms.toFixed(decimals)}ms`;
}

/** A time ruler: tick labels across `window`, a playhead line, scrubbing by pointer, and wheel pan and zoom. */
export function Ruler(props: RulerProps): ReactElement {
  const { window: win, bounds, playhead, onScrub, onWindowChange } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  // Re-render once the track is mounted so ticks lay out against its real
  // width — `trackRef.current` is null on the render that first attaches it.
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = (): void => setWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const widthOf = (): number => trackRef.current?.getBoundingClientRect().width ?? 0;
  const msAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return win.from;
    const scale = createTimeScale(win, rect.width);
    const raw = scale.toMs(clientX - rect.left);
    return Math.min(win.to, Math.max(win.from, raw));
  };

  // `capture: false`: the session tracks the pointer off the ruler on its own,
  // and capture would retarget pointerup and kill the click on non-native
  // children of the scrubbed track.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    onScrub(msAt(e.clientX));

    sessionRef.current?.cancel();
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
      onWindowChange(zoomWindow(win, msAt(e.clientX), Math.exp(e.deltaY * ZOOM_STEP), bounds));
      return;
    }
    const width = widthOf();
    const perPx = width === 0 ? 0 : (win.to - win.from) / width;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const next = panWindow(win, delta * perPx, bounds);
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

  const ticks = tickTimes(win, width, TICK_SPACING_PX);
  const pct = (ms: number): string => toPercent(win, ms);

  return (
    <div
      className={s.ruler}
      ref={trackRef}
      data-testid="timeline-ruler"
      onPointerDown={onPointerDown}
    >
      {ticks.values.map((t) => (
        <span
          key={t}
          className={s.tick}
          data-testid="timeline-tick"
          style={{ left: pct(t) }}
        >
          {formatMs(t, ticks)}
        </span>
      ))}
      <div
        className={s.playhead}
        data-testid="timeline-playhead"
        style={{ left: pct(playhead) }}
      />
    </div>
  );
}
