import type { ReactNode } from 'react';
import type { TrackRun, TrackShape } from '@weasel-js/geom';
import type { Display, Endless, Quantity } from '@weasel-js/quantity';

/**
 * Passed to a custom thumb renderer: the thumb box in CSS px as it is laid
 * out, and whether this thumb is the one being dragged. The box is 0 by 0 on
 * the render before the first layout, which is never painted.
 */
export type ThumbRenderCtx = {
  width: number;
  height: number;
  isActive: boolean;
};

/**
 * A thumb's appearance: a `tab` spanning the track (the default), a `dot`
 * centered on it, a `notched` pentagon, or a custom renderer.
 */
export type ThumbShape =
  | 'tab'
  | 'dot'
  | 'notched'
  | { render: (ctx: ThumbRenderCtx) => ReactNode };

/**
 * One handle on a {@link Slider}. `bounds` narrows the range this particular
 * thumb may move within, either fixed or computed from the current thumb
 * list.
 *
 * `value` is a bare number, or with `Thumb<Tagged>` a tagged one, which every
 * edit hands back with its unit and display.
 */
export type Thumb<F extends Quantity = number> = {
  value: F;
  label?: string;
  shape?: ThumbShape;
  bounds?: [number, number] | ((ctx: BoundsCtx) => [number, number]);
  /**
   * Spoken form of `value`, published as `aria-valuetext`. Required by ARIA
   * whenever `value` is not the quantity the user is choosing — an index into
   * a value list, a log-scaled position — since `aria-valuenow` alone then
   * announces a number that means nothing.
   */
  valueText?: string;
};

/**
 * Passed to a thumb's `bounds` function: the full thumb list and this thumb's
 * index in it, so a bound can be expressed relative to its neighbors. Each
 * `value` here is the bare amount, whatever the thumb was given.
 */
export type BoundsCtx = {
  thumbs: readonly Thumb[];
  index: number;
};

/**
 * Passed to `renderTrack`: the track's width in CSS px, a mapping from a
 * slider value to its 0..1 position along the value span, and the CSS
 * position (a `calc()` against the painted box's width) of a 0..1 fraction of
 * that span. A painter places everything that must line up with the thumbs
 * through `fractionToPosition`: under `thumbFit: 'inside'` the span stops half
 * a thumb short of each end of the track.
 *
 * `shape` is the value span as a run in the painted layer's px, in reading
 * order: `shape.at(valueToFraction(v))` is where a thumb at `v` sits, on a
 * line or a curve. On a curve its `shape`, `from` and `to` place the span on
 * the whole band, which runs past it under `thumbFit: 'inside'`. On a curve `trackWidth` is the run's length, and
 * `fractionToPosition` means nothing; a painter there draws through `shape`.
 */
export type TrackCtx = {
  shape: TrackRun;
  trackWidth: number;
  valueToFraction: (v: number) => number;
  fractionToPosition: (f: number) => string;
};

/** A {@link Slider} stop that carries a label, drawn under the track at the stop. */
export type SliderStop = {
  value: number;
  label?: ReactNode;
};

/**
 * Props for {@link Slider}.
 *
 * `onInput` fires continuously through a drag; `onChange` fires once when it
 * ends and is the one to write to history.
 *
 * `stops` are attractors: a drag that passes within a few pixels of one lands
 * on it, and the arrow keys move stop to stop. `step` still quantizes the
 * values between them. Each one is drawn on the track as a mark; pass
 * `showStops: false` for a track whose own paint already reads as the stops.
 * A stop given as a {@link SliderStop} with a `label` gets that label drawn
 * under it; `stopLabels` narrows the row to the two ends or turns it off.
 *
 * `snap: 'strict'` makes every stop a detent the thumb must rest on: drags and
 * track presses land on the nearest one, and `step` no longer applies.
 * `spacing: 'even'` places the stops at equal intervals, runs the track from
 * the first stop to the last, and maps values linearly within each gap. Both
 * need stops; with fewer than two, `'even'` falls back to linear.
 *
 * `trackClick: 'move-nearest'` makes a press on bare track send the closest
 * thumb there, focus it, and continue as a drag. It is the default for a
 * single thumb. With several it defaults to `'none'`; `onAddThumb`, where it
 * is set, keeps the track press.
 *
 * `keyStep` takes over the arrow and Page keys, for a track whose values are
 * not what the user counts in (a logarithmic one, say): it returns where a
 * thumb lands `steps` key presses away. Home and End still go to the ends.
 *
 * `constraint: 'ordered'` keeps thumbs from crossing each other. Supplying
 * `onAddThumb` makes a click on empty track create a thumb, and supplying
 * `onRemoveThumb` lets a right-click or a drag off the track remove one —
 * both callbacks can decline by returning `null`/`false`. `allowShiftAll`
 * makes shift-drag translate every thumb together.
 *
 * `thumbFit: 'inside'`, the default, runs the value span half a thumb short of
 * each end of the track, so a thumb at `min` or `max` sits flush with the
 * track's edge. `'overhang'` runs the span edge to edge and centers an end
 * thumb on the edge.
 */
export type SliderProps<T extends Thumb<Quantity> = Thumb> = {
  thumbs: readonly T[];
  onInput: (next: T[]) => void;
  onChange?: (next: T[]) => void;
  min: number;
  max: number;
  step?: number;
  /** The value `steps` key presses from `thumb`: 1 or -1 for an arrow key, 10
   *  or -10 with shift or for a Page key. The result is still held to the
   *  track, the thumb's bounds, and `constraint`. */
  keyStep?: (thumb: T, steps: number, index: number) => number;
  stops?: readonly (number | SliderStop)[];
  showStops?: boolean;
  stopLabels?: 'all' | 'ends' | 'none';
  snap?: 'magnetic' | 'strict';
  spacing?: 'linear' | 'even';
  trackClick?: 'none' | 'move-nearest';
  constraint?: 'free' | 'ordered';
  onAddThumb?: (atValue: number) => T | null;
  onRemoveThumb?: (index: number) => boolean;
  allowShiftAll?: boolean;
  renderTrack?: (ctx: TrackCtx) => ReactNode;
  thumbFit?: 'inside' | 'overhang';
  /** The track to lie along, in the coordinates of the slider's containing
   *  block; it wins over an enclosing `Along`'s. A line keeps the straight
   *  layout, and its coordinates are not read. */
  shape?: TrackShape;
  /** The track's height: a number in px, or a CSS length such as `var(--wzl-slider-track-h)`. */
  trackHeight?: number | string;
  /** The thumb's width, and a dot's height: a number in px, or a CSS length. */
  thumbSize?: number | string;
  /** The shape of every thumb that names none of its own. Default `tab`. */
  thumbShape?: ThumbShape;
  renderReadout?: (thumb: T, index: number) => ReactNode;
  /** How a thumb's value shows in the default readout and is spoken as its
   *  `aria-valuetext` when the thumb gives no `valueText` of its own. Default:
   *  three decimals shown, nothing spoken beyond `aria-valuenow`. */
  display?: Display;
  /** Where each thumb's value shows. On a curved track `'inline-after'` is drawn as `'below-thumb'`, there being no row beside a curve. */
  readoutPlacement?: 'none' | 'inline-after' | 'below-thumb';
  /** Which end gets a stop for infinity, one `step` beyond `min` or `max`
   *  (under `spacing: 'even'`, one stop beyond the first or last): a thumb
   *  there reports `Infinity` (`-Infinity` below `min`), and a thumb given
   *  ±Infinity sits there. Its readout and spoken text are `display`'s word
   *  for infinity — `endless(unit('ms'), 'never')` — else `∞`. */
  endless?: Endless;
  ariaLabel?: string;
  className?: string;
};
