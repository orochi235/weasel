import {
  useLayoutEffect,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Display } from '@weasel-js/quantity';
import { QuantityText } from '../QuantityText';
import s from './BandEditor.module.css';
import type { RangeEdge } from './bands';
import { roundness, thinLabels, type LabelBox } from './thinLabels';
import { pct } from './track';

/** Clear space, in px, every shown label keeps from its neighbors. */
const LABEL_GAP_PX = 4;

/** A notch on the ruler. */
export interface BandTick {
  at: number;
  label?: ReactNode;
  /**
   * 0 (default) is a major tick. Where labels would crowd, a higher level gives
   * way first, then the less round value: 1/3 outlasts 1/12, 50 outlasts 40.
   */
  level?: number;
}

export interface RulerProps {
  trackRef: RefObject<HTMLDivElement | null>;
  ticks?: BandTick[];
  /**
   * Labels a tick that has no `label` of its own; without it such a tick is
   * unlabeled. A `fraction` display with no `form` is drawn stacked here.
   */
  display?: Display;
  /** The range's ends, labeled, when they can be dragged. Their labels are always shown. */
  ends?: { edge: RangeEdge; at: number; label: ReactNode }[];
  toUnit: (value: number) => number;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

/** A fraction stacks on the ruler unless its display asks for a form, since stacked is about half as wide. */
export function rulerDisplay(display: Display | undefined): Display | undefined {
  return display?.kind === 'fraction' && display.form === undefined
    ? { ...display, form: 'stacked' }
    : display;
}

function labelBox(el: Element, rank: number, at: number): LabelBox {
  const { left, right } = el.getBoundingClientRect();
  return { left, right, rank, roundness: roundness(at) };
}

/** Hides every tick label that would crowd an end's label or a label that outranks it; the notch stays. */
function thinTickLabels(root: HTMLElement): void {
  const labels: { el: Element; box: LabelBox }[] = [];
  for (const end of root.querySelectorAll('[data-range-end] > *')) labels.push({ el: end, box: labelBox(end, -Infinity, 0) });
  for (const tick of root.querySelectorAll<HTMLElement>('[data-tick-at]')) {
    const label = tick.firstElementChild;
    if (label) labels.push({ el: label, box: labelBox(label, Number(tick.dataset.tickLevel ?? 0), Number(tick.dataset.tickAt)) });
  }
  const shown = thinLabels(labels.map((l) => l.box), LABEL_GAP_PX);
  labels.forEach(({ el }, i) => el.toggleAttribute('data-crowded', !shown[i]));
}

/** `BandEditor`'s tick strip. Its box is the track every pointer position is measured against. */
export function Ruler({ trackRef, ticks, display, ends, toUnit, onPointerDown }: RulerProps): ReactElement {
  const tickDisplay = rulerDisplay(display);
  // Collision is a matter of rendered text width, so it is read from layout after every render rather than computed.
  useLayoutEffect(() => {
    if (trackRef.current) thinTickLabels(trackRef.current);
  });
  useLayoutEffect(() => {
    const root = trackRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => thinTickLabels(root));
    observer.observe(root);
    return () => observer.disconnect();
  }, [trackRef]);

  return (
    <div className={s.ruler} ref={trackRef} data-band-ruler="" onPointerDown={onPointerDown}>
      {ticks?.map((tick, i) => (
        <span
          key={i}
          className={s.tick}
          data-tick-at={tick.at}
          data-tick-level={tick.level}
          style={{ '--be-at': pct(toUnit(tick.at)) } as CSSProperties}
        >
          {(tick.label !== undefined || tickDisplay !== undefined) && (
            <span className={s.tickLabel}>{tick.label ?? <QuantityText value={tick.at} display={tickDisplay} mute />}</span>
          )}
        </span>
      ))}
      {ends?.map((end) => (
        <span
          key={end.edge}
          className={[s.tick, s.endTick, end.edge === 'max' ? s.maxTick : null].filter(Boolean).join(' ')}
          data-range-end={end.edge}
          style={{ '--be-at': pct(toUnit(end.at)) } as CSSProperties}
        >
          <span className={[s.tickLabel, end.edge === 'min' ? s.startLabel : s.endLabel].join(' ')}>{end.label}</span>
        </span>
      ))}
    </div>
  );
}
