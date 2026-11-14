import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useElementSize } from '@weasel-js/core';
import { formatNumber, linearScale, type ContinuousScale, type TickSet } from '@weasel-js/plot/scales';
import s from './Ruler.module.css';
import { roundness, thinLabels, type LabelBox } from './thinLabels';

/** Clear space, in px, every shown label keeps from its neighbors. */
const LABEL_GAP_PX = 4;

/** A notch on a {@link Ruler}. */
export interface RulerTick {
  /** Where it sits, in the scale's domain. */
  at: number;
  label?: ReactNode;
  /**
   * 0 (default) is a major tick. Where labels would crowd, a higher level gives
   * way first, then the less round value: 1/3 outlasts 1/12, 50 outlasts 40.
   */
  level?: number;
}

/** Ticks a {@link Ruler} places itself, on the finest 1/2/5 step that keeps them `minSpacing` px apart. */
export interface RulerSpacing {
  /** Smallest gap between neighboring ticks, in px. */
  minSpacing: number;
  /** Ticks closer than this to either end are dropped, in px. Default 0. */
  inset?: number;
  /** A tick's label. Default the value written as plainly as the step allows. */
  format?: (value: number, ticks: TickSet) => ReactNode;
}

/** Props for {@link Ruler}. */
export interface RulerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** From the domain onto the ruler's length, as `[0, 1]`. */
  scale: ContinuousScale;
  /**
   * The ticks, or how to space them. Spaced ticks are even in value, so a
   * scale that is not linear gives its ticks as a list.
   */
  ticks?: readonly RulerTick[] | RulerSpacing;
  /**
   * `'notch'` (default) draws a short notch at the bottom with its label
   * centered above; `'line'` draws a line from the top with its label beside it.
   * A notch reaches `--wzl-ruler-reach` past the bottom edge.
   */
  look?: 'notch' | 'line';
  /** Marks on the ruler: {@link RulerMark}s, or anything else. */
  children?: ReactNode;
}

const ScaleContext = createContext<ContinuousScale | null>(null);

const place = (scale: ContinuousScale, at: number): string => `${scale.map(at) * 100}%`;

function labelBox(el: Element, rank: number, at: number): LabelBox {
  const { left, right } = el.getBoundingClientRect();
  return { left, right, rank, roundness: roundness(at) };
}

/** Hides every tick label that would crowd a mark's label or a label that outranks it; the notch stays. */
function thinTickLabels(root: HTMLElement): void {
  const labels: { el: Element; box: LabelBox }[] = [];
  for (const mark of root.querySelectorAll<HTMLElement>(':scope > [data-ruler-mark] > [data-ruler-label]')) {
    labels.push({ el: mark, box: labelBox(mark, -Infinity, Number(mark.parentElement!.dataset.rulerMark)) });
  }
  for (const tick of root.querySelectorAll<HTMLElement>(':scope > [data-tick-at]')) {
    const label = tick.firstElementChild;
    if (label) labels.push({ el: label, box: labelBox(label, Number(tick.dataset.tickLevel ?? 0), Number(tick.dataset.tickAt)) });
  }
  const shown = thinLabels(labels.map((l) => l.box), LABEL_GAP_PX);
  labels.forEach(({ el }, i) => {
    if (el.hasAttribute('data-crowded') === shown[i]) el.toggleAttribute('data-crowded', !shown[i]);
  });
}

const isList = (ticks: RulerProps['ticks']): ticks is readonly RulerTick[] => Array.isArray(ticks);

function spacedTicks(scale: ContinuousScale, length: number, spacing: RulerSpacing): RulerTick[] {
  const set = linearScale({ domain: scale.domain, range: [0, length] }).spacedTicks(spacing);
  const format = spacing.format ?? ((v: number) => formatNumber(v, set.step));
  return set.values.map((at) => ({ at, label: format(at, set) }));
}

/**
 * A strip of ticks along one scale. Where tick labels would crowd, the less
 * important give way and leave their notch unlabeled; a {@link RulerMark}'s
 * label is always shown. Children are drawn over the ticks.
 */
export const Ruler = forwardRef<HTMLDivElement, RulerProps>(function Ruler(props, ref) {
  const { scale, ticks, look = 'notch', className, children, ...rest } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [ref]);
  const { width } = useElementSize(rootRef);
  // Collision is a matter of rendered text width, so it is read from layout after every render rather than computed.
  useLayoutEffect(() => {
    if (rootRef.current) thinTickLabels(rootRef.current);
  });

  const shown = ticks === undefined ? [] : isList(ticks) ? ticks : spacedTicks(scale, width, ticks);

  return (
    <div {...rest} ref={setRoot} className={[s.ruler, s[look], className].filter(Boolean).join(' ')}>
      {shown.map((tick, i) => (
        <span key={i} className={s.tick} data-tick-at={tick.at} data-tick-level={tick.level} style={{ left: place(scale, tick.at) }}>
          {tick.label !== undefined && <span className={s.label}>{tick.label}</span>}
        </span>
      ))}
      <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>
    </div>
  );
});

/** Props for {@link RulerMark}. */
export interface RulerMarkProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Where it sits, in the ruler's domain. */
  at: number;
  /** Always shown; tick labels near it give way. */
  label?: ReactNode;
  /** The mark closes the ruler at this end: it is drawn just inside it, and its label hangs inward. */
  side?: 'start' | 'end';
  /** A full-height accent line, as a playhead or a pointer reading is drawn, rather than an emphasized tick. */
  cursor?: boolean;
}

/** A point marked on the {@link Ruler} it is a child of: a range's end, a playhead. */
export function RulerMark({ at, label, side, cursor, className, style, ...rest }: RulerMarkProps): ReactElement {
  const scale = useContext(ScaleContext);
  if (!scale) throw new Error('RulerMark must be a child of a Ruler');
  return (
    <span
      {...rest}
      className={[s.tick, cursor ? s.cursor : s.mark, className].filter(Boolean).join(' ')}
      data-ruler-mark={at}
      data-side={side}
      style={{ ...style, left: place(scale, at) }}
    >
      {label !== undefined && <span className={s.label} data-ruler-label="">{label}</span>}
    </span>
  );
}
