import { forwardRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Display } from '@weasel-js/quantity';
import type { ContinuousScale } from '@weasel-js/plot/scales';
import { QuantityText } from '../QuantityText';
import { Ruler, RulerMark, type RulerTick } from '../Ruler';
import s from './BandEditor.module.css';
import type { RangeEdge } from './bands';

/** A notch on the ruler. */
export type BandTick = RulerTick;

export interface BandRulerProps {
  /** The axis onto `[0, 1]`. */
  scale: ContinuousScale;
  ticks?: readonly BandTick[];
  /**
   * Labels a tick that has no `label` of its own; without it such a tick is
   * unlabeled. A `fraction` display with no `form` is drawn stacked here.
   */
  display?: Display;
  /** The range's ends, labeled, when they can be dragged. */
  ends?: { edge: RangeEdge; at: number; label: ReactNode }[];
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

/** A fraction stacks on the ruler unless its display asks for a form, since stacked is about half as wide. */
export function rulerDisplay(display: Display | undefined): Display | undefined {
  return display?.kind === 'fraction' && display.form === undefined
    ? { ...display, form: 'stacked' }
    : display;
}

/** `BandEditor`'s tick strip. Its box is the track every pointer position is measured against. */
export const BandRuler = forwardRef<HTMLDivElement, BandRulerProps>(function BandRuler(
  { scale, ticks, display, ends, onPointerDown },
  ref,
) {
  const tickDisplay = rulerDisplay(display);
  const labeled = ticks?.map((tick) => (tick.label !== undefined || tickDisplay === undefined
    ? tick
    : { ...tick, label: <QuantityText value={tick.at} display={tickDisplay} mute /> }));
  return (
    <Ruler ref={ref} scale={scale} ticks={labeled ?? []} className={s.ruler} data-band-ruler="" onPointerDown={onPointerDown}>
      {ends?.map((end) => (
        <RulerMark key={end.edge} at={end.at} label={end.label} side={end.edge === 'min' ? 'start' : 'end'} data-range-end={end.edge} />
      ))}
    </Ruler>
  );
});
