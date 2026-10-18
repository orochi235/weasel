import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { clamp } from '@weasel-js/geom';
import { qty, snapToStep } from '@weasel-js/quantity';
import { QuantityText } from '../QuantityText';
import { ReadoutsBelow } from './ReadoutsBelow';
import s from './Slider.module.css';
import { crossEnd } from './crossEnd';
import { keyMoveOf } from './keyMove';
import { READOUT, clampOrdered, defaultStep, fractionToPosition, resolveBounds, stepStops } from './stops';
import type { SliderProps, Thumb } from './types';
import { useScale, useSpan } from './useSpan';
import { useBoxes } from './useBoxes';
import { useThumbDrags } from './useThumbDrags';

/** The slider proper, in track values: {@link Slider} maps an endless end's
 *  ±Infinity onto the end stop and back, and speaks it through `spokenAt`. */
export function SliderBody<T extends Thumb = Thumb>(
  props: SliderProps<T> & {
    spokenAt?: (v: number, thumb: T) => string | undefined;
    /** The finite range, where the track runs past it to an endless end's stop. */
    range?: readonly [number, number];
  },
): ReactElement {
  const { thumbs, onInput, onChange, step, constraint, trackHeight, density, ariaLabel, className } = props;

  const span = useSpan(props);
  const { stopList, stops, min, max } = span;
  const strict = props.snap === 'strict' && stops.length > 0;

  const trackRef = useRef<HTMLDivElement | null>(null);
  // The value span. Every pointer is measured against it, and thumbs, ticks
  // and stop labels are laid out inside it, so they agree by construction.
  const railRef = useRef<HTMLDivElement | null>(null);
  const scale = useScale(span, strict, step);
  const { valueToFraction, valueAt } = scale;
  const { beginThumbDrag, beginShiftAllDrag, dragged } = useThumbDrags<T>({ props, span, scale, railRef });
  const thumbEls = useRef<(HTMLDivElement | null)[]>([]);
  // The track first, then each thumb.
  const boxes = useBoxes(() => [trackRef.current, ...thumbs.map((_, i) => thumbEls.current[i] ?? null)], thumbs.length);


  const onThumbPointerDown = (index: number) => (e: ReactPointerEvent) => {
    // Only bail on explicit non-primary buttons (button > 0). jsdom's PointerEvent
    // leaves `button` undefined; treat that as primary so tests can drive drags.
    if (typeof e.button === 'number' && e.button > 0) return;
    // preventDefault below suppresses the focus the press would otherwise
    // give the thumb, and the arrow keys are on the thumb.
    (e.currentTarget as HTMLElement).focus?.();
    e.preventDefault();
    e.stopPropagation();
    const origin = e.currentTarget as HTMLElement;
    if (e.shiftKey && props.allowShiftAll) {
      beginShiftAllDrag(origin, e, e.clientX);
    } else {
      beginThumbDrag(origin, e, index);
    }
  };

  const onThumbContextMenu = (index: number) => (e: ReactMouseEvent) => {
    if (!props.onRemoveThumb) return;
    e.preventDefault();
    const accepted = props.onRemoveThumb(index);
    if (!accepted) return;
    const next = thumbs.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
    onInput(next);
    onChange?.(next);
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof e.button === 'number' && e.button > 0) return;
    const trackClick = props.trackClick ?? (thumbs.length === 1 ? 'move-nearest' : 'none');
    const wantsMove = trackClick === 'move-nearest' && thumbs.length > 0;
    if (!props.onAddThumb && !wantsMove) return;
    // If the event originated on a thumb, the thumb's own handler ran first; this is a track click.
    if ((e.target as HTMLElement).closest(`.${s.thumb}`)) return;
    e.preventDefault();
    const track = trackRef.current;
    const rail = railRef.current;
    if (!track || !rail) return;
    const rect = rail.getBoundingClientRect();
    const v = valueAt((e.clientX - rect.left) / rect.width, rect.width);

    if (props.onAddThumb) {
      const created = props.onAddThumb(v);
      if (!created) return;
      const next = [...thumbs.map(t => ({ ...t })), created] as T[];
      onInput(next);
      onChange?.(next);
      return;
    }

    let index = 0;
    for (let i = 1; i < thumbs.length; i++) {
      if (Math.abs(thumbs[i].value - v) < Math.abs(thumbs[index].value - v)) index = i;
    }
    const next = thumbs.map(t => ({ ...t })) as T[];
    const [bLo, bHi] = resolveBounds(next[index], { thumbs: next, index }, min, max);
    let moved = clamp(v, bLo, bHi);
    if (constraint === 'ordered') moved = clampOrdered(moved, next, index, min, max, step);
    next[index] = { ...next[index], value: moved };
    onInput(next);
    // preventDefault above suppresses the focus the press would give; the arrow keys are on the thumb.
    track.querySelectorAll<HTMLElement>(`.${s.thumb}`)[index]?.focus();
    beginThumbDrag(track, e, index, next);
  };

  const onThumbKeyDown = (index: number) => (e: ReactKeyboardEvent) => {
    const move = keyMoveOf(e);
    if (!move) return;
    const range = props.range ?? [min, max];
    const stepSize = defaultStep(step, range[0], range[1]);
    e.preventDefault();
    const next = thumbs.map(t => ({ ...t }));
    const [bLo, bHi] = resolveBounds(next[index], { thumbs: next, index }, min, max);
    const lo = Math.max(min, bLo);
    const hi = Math.min(max, bHi);
    let v: number;
    if (move === 'home') v = lo;
    else if (move === 'end') v = hi;
    else if (props.keyStep) v = props.keyStep(next[index], move, index);
    // With stops, a keystroke moves by whole stops rather than by value.
    else if (stops.length > 0) v = stepStops(stops, next[index].value, move > 0 ? 1 : -1, Math.abs(move));
    else {
      const delta = move * stepSize;
      v = crossEnd(next[index].value, delta, stepSize, range, [min, max]) ?? snapToStep(next[index].value + delta, step, min);
    }
    v = clamp(v, lo, hi);
    if (constraint === 'ordered') v = clampOrdered(v, next, index, lo, hi, step);
    next[index] = { ...next[index], value: v };
    onInput(next);
    onChange?.(next);
  };

  const placement = props.readoutPlacement ?? 'none';
  const renderReadout = props.renderReadout;
  const display = props.display;

  const slim = density === 'slim';
  const rootVars: Record<string, string> = {};
  if (slim) {
    rootVars['--rp-track-height'] = 'var(--wzl-slider-track-h)';
    rootVars['--rp-thumb-size'] = 'var(--wzl-slider-thumb-size)';
  }
  // An explicit trackHeight wins: a caller who named a number meant it.
  if (trackHeight !== undefined) rootVars['--rp-track-height'] = `${trackHeight}px`;

  const labelMode = props.stopLabels ?? 'all';
  const lastStop = stopList.length - 1;
  const labeledStops = labelMode === 'none'
    ? []
    : stopList
        .map((stop, i) => ({ stop, i }))
        .filter(({ stop, i }) => stop.label !== undefined && (labelMode === 'all' || i === 0 || i === lastStop));
  // Inside the track so it shares the track's width, not the row's — an inline
  // readout beside the track would otherwise shift every label off its stop.
  const stopLabelRow = labeledStops.length > 0 && (
    <div className={s.stopLabels} data-slider-stop-labels aria-hidden="true">
      {labeledStops.map(({ stop, i }) => (
        <span
          key={stop.value}
          className={s.stopLabel}
          data-slider-stop-label
          data-selected={thumbs.some(t => t.value === stop.value) ? 'true' : undefined}
          data-edge={i === 0 ? 'start' : i === lastStop ? 'end' : undefined}
          style={{ left: `${valueToFraction(stop.value) * 100}%` }}
        >
          {stop.label}
        </span>
      ))}
    </div>
  );
  const rootClass = [s.root, slim && s.slim, props.thumbFit === 'overhang' && s.overhang, stopLabelRow && s.withStopLabels, className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      style={Object.keys(rootVars).length > 0 ? (rootVars as CSSProperties) : undefined}
    >
      <div className={s.row}>
      <div className={s.track} ref={trackRef} onPointerDown={onTrackPointerDown}>
        {props.renderTrack && (
          <div className={s.trackInner}>
            {props.renderTrack({
              trackWidth: boxes[0]?.width ?? 0,
              valueToFraction,
              fractionToPosition,
            })}
          </div>
        )}
        <div className={s.rail} ref={railRef} data-slider-rail>
        {(props.showStops ?? true) && stops.length > 0 && (
          <div className={s.ticks} data-slider-ticks aria-hidden="true">
            {stops.map(v => {
              const f = valueToFraction(v);
              return (
                <span
                  key={v}
                  className={s.tick}
                  data-slider-tick
                  data-fraction={String(f)}
                  style={{ left: `${f * 100}%` }}
                />
              );
            })}
          </div>
        )}
        {stopLabelRow}
        {thumbs.map((thumb, i) => {
          const isNotched = thumb.shape === 'notched';
          const customRender = typeof thumb.shape === 'object' && thumb.shape !== null ? thumb.shape.render : null;
          const isActive = dragged === i;
          const cls = [s.thumb, isNotched && s.notched, isActive && s.thumbActive].filter(Boolean).join(' ');
          return (
            <div
              key={i}
              ref={(el) => { thumbEls.current[i] = el; }}
              role="slider"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={thumb.value}
              aria-valuetext={thumb.valueText ?? props.spokenAt?.(thumb.value, thumb) ?? (display ? qty(thumb.value, display).spoken : undefined)}
              aria-label={[ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
              className={cls}
              style={{ left: `${valueToFraction(thumb.value) * 100}%` }}
              onPointerDown={onThumbPointerDown(i)}
              onKeyDown={onThumbKeyDown(i)}
              onContextMenu={onThumbContextMenu(i)}
            >
              {customRender ? customRender({ width: boxes[i + 1]?.width ?? 0, height: boxes[i + 1]?.height ?? 0, isActive }) : (thumb.label ?? '')}
            </div>
          );
        })}
        </div>
      </div>
      {placement === 'inline-after' && (
        <span data-readout="inline" className={s.readoutInline}>
          {thumbs.map((t, i) => (
            <span key={i}>{i > 0 ? ' / ' : ''}{renderReadout ? renderReadout(t, i) : <QuantityText value={t.value} display={display ?? READOUT} mute />}</span>
          ))}
        </span>
      )}
      </div>
      {placement === 'below-thumb' && (
        <ReadoutsBelow
          readouts={thumbs.map((t, i) => ({
            fraction: valueToFraction(t.value),
            content: renderReadout ? renderReadout(t, i) : <QuantityText value={t.value} display={display ?? READOUT} mute />,
          }))}
        />
      )}
    </div>
  );
}
