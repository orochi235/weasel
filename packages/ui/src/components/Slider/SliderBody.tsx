import { useRef, type CSSProperties, type ReactElement } from 'react';
import { QuantityText } from '../QuantityText';
import { ReadoutsBelow } from './ReadoutsBelow';
import s from './Slider.module.css';
import { SliderStopLabels, SliderTicks, labeledStopsOf } from './SliderMarks';
import { SliderThumb } from './SliderThumb';
import { lineGeometry } from './sliderGeometry';
import { READOUT, fractionToPosition } from './stops';
import { onThumbKeyDown } from './thumbKeys';
import type { SliderProps, Thumb } from './types';
import { useBoxes } from './useBoxes';
import { useLatestHandlers } from './useLatestHandlers';
import { useSliderPointer } from './useSliderPointer';
import { useScale, useSpan } from './useSpan';
import { useThumbDrags } from './useThumbDrags';

/** The custom properties a density or an explicit track height sets on the root. */
function rootVarsOf(density: SliderProps['density'], trackHeight: number | undefined): CSSProperties | undefined {
  const vars: Record<string, string> = {};
  if (density === 'slim') {
    vars['--rp-track-height'] = 'var(--wzl-slider-track-h)';
    vars['--rp-thumb-size'] = 'var(--wzl-slider-thumb-size)';
  }
  // An explicit trackHeight wins: a caller who named a number meant it.
  if (trackHeight !== undefined) vars['--rp-track-height'] = `${trackHeight}px`;
  return Object.keys(vars).length > 0 ? (vars as CSSProperties) : undefined;
}

/** The slider proper, in track values: {@link Slider} maps an endless end's
 *  ±Infinity onto the end stop and back, and speaks it through `spokenAt`. */
export function SliderBody<T extends Thumb = Thumb>(
  props: SliderProps<T> & {
    spokenAt?: (v: number, thumb: T) => string | undefined;
    /** The finite range, where the track runs past it to an endless end's stop. */
    range?: readonly [number, number];
  },
): ReactElement {
  const { thumbs, step, constraint, density, className } = props;

  const span = useSpan(props);
  const { stopList, stops, min, max } = span;
  const strict = props.snap === 'strict' && stops.length > 0;

  const trackRef = useRef<HTMLDivElement | null>(null);
  // The value span. Every pointer is measured against it, and thumbs, ticks
  // and stop labels are laid out inside it, so they agree by construction.
  const railRef = useRef<HTMLDivElement | null>(null);
  const geometry = useRef(lineGeometry(() => railRef.current)).current;
  const scale = useScale(span, strict, step);
  const { valueToFraction, valueAt } = scale;
  const drags = useThumbDrags<T>({ props, span, scale, geometry });
  const { onInput, onChange } = useLatestHandlers(props);
  const thumbEls = useRef<(HTMLDivElement | null)[]>([]);
  // The track first, then each thumb.
  const boxes = useBoxes(() => [trackRef.current, ...thumbs.map((_, i) => thumbEls.current[i] ?? null)], thumbs.length);

  const pointer = useSliderPointer<T>({ thumbs, props, min, max, trackRef, geometry, valueAt, onInput: props.onInput, drags });
  const keyDown = onThumbKeyDown<T>({ thumbs, stops, min, max, step, constraint, keyStep: props.keyStep, range: props.range, onInput: props.onInput, onChange: props.onChange });

  const placement = props.readoutPlacement ?? 'none';
  const { renderReadout, display } = props;
  const readoutOf = (t: T, i: number) => (renderReadout ? renderReadout(t, i) : <QuantityText value={t.value} display={display ?? READOUT} mute />);

  const slim = density === 'slim';
  const labeled = labeledStopsOf(stopList, props.stopLabels ?? 'all');
  const rootClass = [s.root, slim && s.slim, props.thumbFit === 'overhang' && s.overhang, labeled.length > 0 && s.withStopLabels, className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} style={rootVarsOf(density, props.trackHeight)}>
      <div className={s.row}>
      <div className={s.track} ref={trackRef} onPointerDown={pointer.onTrackPointerDown}>
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
        {(props.showStops ?? true) && stops.length > 0 && <SliderTicks stops={stops} valueToFraction={valueToFraction} geometry={geometry} />}
        {labeled.length > 0 && (
          <SliderStopLabels labeled={labeled} last={stopList.length - 1} selected={thumbs.map(t => t.value)} valueToFraction={valueToFraction} geometry={geometry} />
        )}
        {thumbs.map((thumb, i) => (
          <SliderThumb<T>
            key={i}
            thumb={thumb}
            fraction={valueToFraction(thumb.value)}
            geometry={geometry}
            min={min}
            max={max}
            ariaLabel={props.ariaLabel}
            display={display}
            spoken={props.spokenAt?.(thumb.value, thumb)}
            active={drags.dragged === i}
            box={{ width: boxes[i + 1]?.width ?? 0, height: boxes[i + 1]?.height ?? 0 }}
            elRef={(el) => { thumbEls.current[i] = el; }}
            onPointerDown={pointer.onThumbPointerDown(i)}
            onKeyDown={keyDown(i)}
            onContextMenu={pointer.onThumbContextMenu(i)}
          />
        ))}
        </div>
      </div>
      {placement === 'inline-after' && (
        <span data-readout="inline" className={s.readoutInline}>
          {thumbs.map((t, i) => (
            <span key={i}>{i > 0 ? ' / ' : ''}{readoutOf(t, i)}</span>
          ))}
        </span>
      )}
      </div>
      {placement === 'below-thumb' && (
        <ReadoutsBelow readouts={thumbs.map((t, i) => ({ fraction: valueToFraction(t.value), content: readoutOf(t, i) }))} />
      )}
    </div>
  );
}
