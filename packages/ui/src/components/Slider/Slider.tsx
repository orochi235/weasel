import { useMemo, type ReactElement } from 'react';
import { qty } from '@weasel-js/quantity';
import { endlessTrack } from '../../endless';
import { SliderBody } from './SliderBody';
import { READOUT } from './stops';
import type { SliderProps, Thumb } from './types';
import { useSpan } from './useSpan';

export type { BoundsCtx, SliderProps, SliderStop, Thumb, ThumbRenderCtx, ThumbShape, TrackCtx } from './types';

/**
 * Multi-thumb slider over a shared track. The thumb list is fully controlled:
 * every change, live or committed, arrives as a whole new array.
 *
 * Thumbs are draggable, and arrow/Home/End move the focused thumb — those
 * keystrokes fire `onInput` and `onChange` together, since there is no
 * in-flight state to buffer.
 */
export function Slider<T extends Thumb = Thumb>(props: SliderProps<T>): ReactElement {
  const { endless, display, renderReadout, onInput, onChange } = props;
  const span = useSpan(props);
  const { stopList } = span;
  // Evenly spaced stops are a stop apart whatever their values, so the added
  // one takes the last gap; a linear track takes a step.
  const gap = (a: number, b: number) => (span.even ? Math.abs(stopList[a].value - stopList[b].value) : props.step);
  const last = stopList.length - 1;
  const lower = endlessTrack(span.min, span.max, gap(0, Math.min(1, last)), endless);
  const upper = endlessTrack(span.min, span.max, gap(last, Math.max(0, last - 1)), endless);
  const track = { min: lower.min, max: upper.max };
  const fromTrack = (v: number) => (v > span.max ? upper.fromTrack(v) : lower.fromTrack(v));
  const word = (v: number) => qty(v, display ?? READOUT).text;
  const thumbs = useMemo(
    () => props.thumbs.map(t => (t.value === Infinity ? { ...t, value: track.max } : t.value === -Infinity ? { ...t, value: track.min } : t)),
    [props.thumbs, track.min, track.max],
  );
  // The infinity stops join whatever stops there are, so arrow keys and a
  // strict drag can land on them; they are labeled only among labeled stops.
  const stops = useMemo(() => {
    if (stopList.length === 0) return props.stops;
    const labeled = span.even || stopList.some(stop => stop.label !== undefined);
    const end = (value: number, sign: number) => (labeled ? { value, label: qty(sign * Infinity, display ?? READOUT).text } : { value });
    return [
      ...(track.min < span.min ? [end(track.min, -1)] : []),
      ...stopList,
      ...(track.max > span.max ? [end(track.max, 1)] : []),
    ];
  }, [span.even, stopList, props.stops, track.min, track.max, span.min, span.max, display]);
  if (endless === undefined) return <SliderBody {...props} thumbs={thumbs} />;
  const outward = (next: T[]) => next.map(t => ({ ...t, value: fromTrack(t.value) }));
  return (
    <SliderBody
      {...props}
      min={track.min}
      max={track.max}
      stops={stops}
      thumbs={thumbs}
      range={[span.min, span.max]}
      onInput={next => onInput(outward(next))}
      onChange={onChange && (next => onChange(outward(next)))}
      renderReadout={(t, i) => {
        const shown = { ...t, value: fromTrack(t.value) };
        return renderReadout ? renderReadout(shown, i) : word(shown.value);
      }}
      spokenAt={v => (Number.isFinite(fromTrack(v)) ? undefined : qty(fromTrack(v), display ?? READOUT).spoken)}
    />
  );
}
