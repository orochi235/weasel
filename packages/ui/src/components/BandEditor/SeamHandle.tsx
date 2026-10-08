import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from 'react';
import { qty, type Display, type Quantity } from '@weasel-js/quantity';
import s from './BandEditor.module.css';
import { clampSeamTo, seamBounds, setSeam, type Band } from './bands';
import { arrowStep, pct } from './track';

export interface SeamHandleProps<T> {
  index: number;
  /** The bands as committed, which every edit is measured from. */
  committed: Band<T>[];
  /** The bands as drawn right now, mid-drag or not. */
  bands: Band<T>[];
  min: number;
  max: number;
  display: Display;
  /** This seam's value as the consumer tagged it, if it did. */
  tagged: Quantity;
  toUnit: (value: number) => number;
  fromUnit: (unit: number) => number;
  /** Pointer position in track units, clamped and snapped. */
  pointerUnit: (clientX: number, altKey: boolean) => number;
  drag: (down: ReactPointerEvent<HTMLElement>, onMove: (ev: PointerEvent) => void, onEnd: () => void) => void;
  /** Live during a drag; `ghost` is where the seam started. */
  onInput: (next: Band<T>[], ghost: number) => void;
  onCommit: (next: Band<T>[]) => void;
}

/** The draggable line between bands `index` and `index + 1`. */
export function SeamHandle<T>(props: SeamHandleProps<T>): ReactElement {
  const { index, committed, bands, min, max, toUnit, fromUnit } = props;
  const [lo, hi] = seamBounds(bands, index, min, max);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (typeof e.button === 'number' && e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    let latest: Band<T>[] | null = null;
    props.drag(
      e,
      (ev) => {
        const to = clampSeamTo(committed, index, fromUnit(props.pointerUnit(ev.clientX, ev.altKey)), min, max);
        latest = setSeam(committed, index, to);
        props.onInput(latest, committed[index + 1].from);
      },
      () => {
        if (latest) props.onCommit(latest);
      },
    );
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const [keyLo, keyHi] = seamBounds(committed, index, min, max);
    let target: number;
    if (e.key === 'Home') target = keyLo;
    else if (e.key === 'End') target = keyHi;
    else {
      const delta = arrowStep(e);
      if (delta === null) return;
      target = fromUnit(toUnit(committed[index + 1].from) + delta);
    }
    e.preventDefault();
    const next = setSeam(committed, index, clampSeamTo(committed, index, target, min, max));
    if (next !== committed) props.onCommit(next);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      className={s.seam}
      style={{ '--be-at': pct(toUnit(bands[index + 1].from)) } as CSSProperties}
      aria-label={`Seam ${index + 1}`}
      aria-orientation="horizontal"
      aria-valuemin={lo}
      aria-valuemax={hi}
      aria-valuenow={bands[index + 1].from}
      aria-valuetext={qty(props.tagged, props.display).spoken}
      data-seam-index={index}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
