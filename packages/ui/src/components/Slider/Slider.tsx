import { useMemo, type ReactElement } from 'react';
import { endlessTrack, qty, type Quantity } from '@weasel-js/quantity';
import { QuantityText } from '../QuantityText';
import { useFieldLocale } from '../../useFieldLocale';
import { SliderBody } from './SliderBody';
import { READOUT } from './stops';
import { retagThumb, sameThumbValues, thumbDisplay, untagThumb, type PlainThumb } from './tagged';
import type { SliderProps, Thumb } from './types';
import { useSpan } from './useSpan';
import { useEditDraft } from '../../useEditDraft';

export type { BoundsCtx, SliderProps, SliderRegionCtx, SliderStop, Thumb, ThumbRenderCtx, ThumbShape, TrackCtx } from './types';

/**
 * Multi-thumb slider over a shared track. The thumb list is controlled, and every change arrives as a whole new
 * array through the edit protocol (`docs/conventions.md`, "Edit callbacks"). Thumbs are draggable, and
 * arrow/Home/End move the focused thumb.
 *
 * It lies along a curve when given a `shape` or placed inside an `Along`: thumbs, ticks, stop labels and
 * readouts follow the shape, and values run along it, min at its start, so a counterclockwise arc reads as a
 * counterclockwise dial. `aria-orientation` is left off on a curve.
 *
 * Under a computed `direction` of `rtl`, straight or curved, its values run from the other end. ArrowRight moves a
 * thumb right on screen: where values run right to left, it steps down and ArrowLeft up, as a native range input's do.
 *
 * A thumb's `value` may be tagged: it is placed by its amount, shown and
 * spoken through its own display where it carries one, and handed back with
 * its unit and display around the new number.
 */
export function Slider<T extends Thumb<Quantity>>(props: SliderProps<T>): ReactElement;
// Last, so `Parameters<typeof Slider>` and `ComponentProps` read the props of a slider of bare numbers.
export function Slider<T extends Thumb = Thumb>(props: SliderProps<T>): ReactElement;
export function Slider<T extends Thumb<Quantity> = Thumb>(props: SliderProps<T>): ReactElement {
  const { endless, display, renderReadout, renderRegion, keyStep, onAddThumb } = props;
  const edit = useEditDraft<T[]>(props.thumbs as T[], props, sameThumbValues);
  const { onInput, onChange, onCancel } = edit;
  const span = useSpan(props);
  const locale = useFieldLocale();
  const { stopList } = span;
  // Evenly spaced stops are a stop apart whatever their values, so the added
  // one takes the last gap; a linear track takes a step.
  const gap = (a: number, b: number) => (span.even ? Math.abs(stopList[a].value - stopList[b].value) : props.step);
  const last = stopList.length - 1;
  const lower = endlessTrack(span.min, span.max, gap(0, Math.min(1, last)), endless);
  const upper = endlessTrack(span.min, span.max, gap(last, Math.max(0, last - 1)), endless);
  const track = { min: lower.min, max: upper.max };
  const fromTrack = (v: number) => (v > span.max ? upper.fromTrack(v) : lower.fromTrack(v));
  const tagged = edit.shown.some(t => typeof t.value !== 'number');
  const thumbs = useMemo(
    () => edit.shown.map(untagThumb).map(t => (t.value === Infinity ? { ...t, value: track.max } : t.value === -Infinity ? { ...t, value: track.min } : t)),
    [edit.shown, track.min, track.max],
  );
  // The infinity stops join whatever stops there are, so arrow keys and a
  // strict drag can land on them; they are labeled only among labeled stops.
  const stops = useMemo(() => {
    if (stopList.length === 0) return props.stops;
    const labeled = span.even || stopList.some(stop => stop.label !== undefined);
    const end = (value: number, sign: number) => (labeled ? { value, label: qty(sign * Infinity, display ?? READOUT, { locale }).text } : { value });
    return [
      ...(track.min < span.min ? [end(track.min, -1)] : []),
      ...stopList,
      ...(track.max > span.max ? [end(track.max, 1)] : []),
    ];
  }, [span.even, stopList, props.stops, track.min, track.max, span.min, span.max, display, locale]);
  const plain = props as unknown as SliderProps<PlainThumb>;
  const handlers = { onInput, onChange, onCancel } as unknown as Pick<SliderProps<PlainThumb>, 'onInput' | 'onChange' | 'onCancel'>;
  if (endless === undefined && !tagged) return <SliderBody {...plain} {...handlers} thumbs={thumbs} />;
  const shown = (t: PlainThumb): T => retagThumb<T>(endless === undefined ? t : { ...t, value: fromTrack(t.value) });
  const outward = (next: PlainThumb[]) => next.map(shown);
  return (
    <SliderBody<PlainThumb>
      {...plain}
      onCancel={onCancel}
      {...(endless === undefined ? {} : { min: track.min, max: track.max, stops, range: [span.min, span.max] as const })}
      thumbs={thumbs}
      onInput={next => onInput(outward(next))}
      onChange={next => onChange(outward(next))}
      keyStep={keyStep && ((t, steps, i) => keyStep(shown(t), steps, i))}
      onAddThumb={onAddThumb && (at => { const made = onAddThumb(at); return made && untagThumb(made); })}
      renderRegion={renderRegion && endless !== undefined ? (r => renderRegion({ ...r, from: fromTrack(r.from), to: fromTrack(r.to) })) : renderRegion}
      renderReadout={(t, i) => (renderReadout ? renderReadout(shown(t), i) : <QuantityText value={shown(t).value} display={display ?? READOUT} locale={locale} mute />)}
      spokenAt={(v, t) => {
        const at = endless === undefined ? v : fromTrack(v);
        const own = thumbDisplay(t);
        if (own !== undefined) return qty(at, own, { locale }).spoken;
        return Number.isFinite(at) ? undefined : qty(at, display ?? READOUT, { locale }).spoken;
      }}
    />
  );
}
