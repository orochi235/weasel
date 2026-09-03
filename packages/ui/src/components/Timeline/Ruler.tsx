import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement, type WheelEvent as ReactWheelEvent } from 'react';
import s from './Timeline.module.css';
import { createTimeScale, panWindow, tickTimes, toPercent, zoomWindow, type TimeWindow } from './timeScale';

/** Minimum gap between ruler ticks, in px. */
const TICK_SPACING_PX = 64;

/** One wheel notch's zoom factor. */
const ZOOM_STEP = 0.0015;

export interface RulerProps {
  window: TimeWindow;
  /** The full extent the window may cover — normally `{ from: 0, to: duration }`. */
  bounds: TimeWindow;
  playhead: number;
  onScrub: (t: number) => void;
  onWindowChange: (w: TimeWindow) => void;
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)}s`;
  return `${Math.round(ms)}ms`;
}

export function Ruler(props: RulerProps): ReactElement {
  const { window: win, bounds, playhead, onScrub, onWindowChange } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { endDragRef.current?.(); }, []);

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

  // Document listeners, never setPointerCapture: capture retargets pointerup and
  // kills the click on non-native children. See BandEditor, same idiom.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    onScrub(msAt(e.clientX));

    const move = (ev: PointerEvent): void => { onScrub(msAt(ev.clientX)); };
    const end = (): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      endDragRef.current = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    endDragRef.current = end;
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>): void => {
    if (e.ctrlKey) {
      onWindowChange(zoomWindow(win, msAt(e.clientX), Math.exp(e.deltaY * ZOOM_STEP), bounds));
    } else {
      const width = widthOf();
      const perPx = width === 0 ? 0 : (win.to - win.from) / width;
      onWindowChange(panWindow(win, e.deltaY * perPx, bounds));
    }
  };

  const ticks = tickTimes(win, width, TICK_SPACING_PX);
  const pct = (ms: number): string => toPercent(win, ms);

  return (
    <div
      className={s.ruler}
      ref={trackRef}
      data-testid="timeline-ruler"
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {ticks.map((t) => (
        <span
          key={t}
          className={s.tick}
          data-testid="timeline-tick"
          style={{ left: pct(t) }}
        >
          {formatMs(t)}
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
