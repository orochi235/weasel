import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from 'react';
import { qty, type Display, type Quantity } from '@weasel-js/quantity';
import s from './BandEditor.module.css';
import { edgeReach, scaleEdges, unitEdges, type Band, type RangeEdge } from './bands';
import type { BandScale } from './scale';
import { arrowStep, pct } from './track';

/** A rescale of the whole range: the new ends and the bands refitted between them. */
export type RangeEdit<T> = { range: [number, number]; bands: Band<T>[] };

export interface RangeEdgeHandleProps<T> {
  edge: RangeEdge;
  /** The bands and range as committed, which every edit is measured from. */
  committed: Band<T>[];
  min: number;
  max: number;
  /** Where this end is drawn right now: mid-drag, not yet `min` / `max`. */
  at: number;
  limits?: readonly [number, number];
  scale: BandScale;
  display: Display;
  /** This end's value as the consumer tagged it, if it did. */
  tagged?: Quantity;
  /** Track position as drawn, `[0, 1]`. */
  toUnit: (value: number) => number;
  /** Pointer position in track units of the committed axis, unclamped and snapped. */
  pointerUnit: (clientX: number, altKey: boolean) => number;
  drag: (down: ReactPointerEvent<HTMLElement>, onMove: (ev: PointerEvent) => void, onEnd: () => void) => void;
  onInput: (edit: RangeEdit<T>) => void;
  onCommit: (edit: RangeEdit<T>) => void;
}

/**
 * One end of a `BandEditor`'s range. Dragging it rescales the whole sequence
 * with the other end held, in track units of the axis the drag started on —
 * so on a log scale a locked band keeps its ratio, on a linear one its span.
 */
export function RangeEdgeHandle<T>(props: RangeEdgeHandleProps<T>): ReactElement {
  const { edge, committed, min, max, at, limits, scale, display } = props;
  const edges = unitEdges(committed, scale, min, max);
  const locked = committed.map((b) => b.locked === true);
  const toBase = (v: number): number => {
    if (!Number.isFinite(v)) return v;
    const u = scale.toUnit(v, min, max);
    return Number.isNaN(u) ? -Infinity : u;
  };
  const unitLimits: [number, number] | undefined = limits && [toBase(limits[0]), toBase(limits[1])];
  // A limit reached exactly reads back as the limit, not its round trip through track units.
  const fromBase = (u: number): number =>
    limits && unitLimits && u === unitLimits[0] ? limits[0]
      : limits && unitLimits && u === unitLimits[1] ? limits[1]
        : scale.fromUnit(u, min, max);
  const [reachLo, reachHi] = edgeReach(edges, locked, edge, unitLimits);

  const fit = (to: number): RangeEdit<T> | null => {
    const next = scaleEdges(edges, locked, edge, to, unitLimits);
    if (!next) return null;
    const range: [number, number] = edge === 'min' ? [fromBase(next[0]), max] : [min, fromBase(next[next.length - 1])];
    const bands = committed.map((b, i) => ({ ...b, from: i === 0 ? range[0] : fromBase(next[i]) }));
    return { range, bands };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (typeof e.button === 'number' && e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    let latest: RangeEdit<T> | null = null;
    props.drag(
      e,
      (ev) => {
        const edit = fit(props.pointerUnit(ev.clientX, ev.altKey));
        if (!edit) return;
        latest = edit;
        props.onInput(edit);
      },
      () => {
        if (latest) props.onCommit(latest);
      },
    );
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    let to: number;
    if (e.key === 'Home' && Number.isFinite(reachLo)) to = reachLo;
    else if (e.key === 'End' && Number.isFinite(reachHi)) to = reachHi;
    else {
      const delta = arrowStep(e);
      if (delta === null) return;
      to = (edge === 'min' ? 0 : 1) + delta;
    }
    e.preventDefault();
    const edit = fit(to);
    if (edit) props.onCommit(edit);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      className={[s.seam, s.edge].join(' ')}
      style={{ '--be-at': pct(props.toUnit(at)) } as CSSProperties}
      aria-label={edge === 'min' ? 'Range start' : 'Range end'}
      aria-orientation="horizontal"
      aria-valuemin={Number.isFinite(reachLo) ? fromBase(reachLo) : undefined}
      aria-valuemax={Number.isFinite(reachHi) ? fromBase(reachHi) : undefined}
      aria-valuenow={at}
      aria-valuetext={qty(props.tagged ?? at, display).spoken}
      data-range-edge={edge}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
