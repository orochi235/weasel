import { useLayoutEffect, useState, type RefObject } from 'react';
import { formatTick, linearScale, tickDecimals, type TickFormatCtx } from '@weasel-js/scale';
import type { TickSettings } from './Plot2D';
import s from './Plot2D.module.css';

export type Axis = 'x' | 'y';

const TICK_SPACING_PX: Record<Axis, number> = { x: 64, y: 24 };
const TICK_INSET_PX: Record<Axis, number> = { x: 16, y: 4 };
const LABEL_GAP_PX = 4;

export interface ResolvedTick {
  value: number;
  /** Plot-space position along the axis. */
  at: number;
  label: string;
}

/** The ticks `settings` asks for along `axis`: the values it gives within `range`, else generated ones, labeled. */
export function resolveTicks(
  settings: TickSettings,
  axis: Axis,
  range: readonly [number, number],
  pixels: number,
  toPlot: (v: number) => number,
): ResolvedTick[] {
  let values: number[];
  let ctx: TickFormatCtx;
  if (settings.values) {
    const lo = Math.min(range[0], range[1]);
    const hi = Math.max(range[0], range[1]);
    const eps = (hi - lo) * 1e-9;
    values = settings.values.filter((v) => v >= lo - eps && v <= hi + eps);
    const gaps = values.slice(1).map((v, i) => v - values[i]);
    const even = gaps.length > 0 && gaps.every((g) => Math.abs(g - gaps[0]) <= Math.abs(gaps[0]) * 1e-9);
    ctx = { decimals: tickDecimals(values), step: even ? gaps[0] : 0 };
  } else {
    const set = linearScale({ domain: range, range: [0, pixels] }).spacedTicks({
      minSpacing: settings.minSpacing ?? TICK_SPACING_PX[axis],
      inset: settings.inset ?? TICK_INSET_PX[axis],
    });
    values = set.values;
    ctx = { decimals: set.decimals, step: set.step };
  }
  const format = settings.format ?? formatTick;
  return values.map((value) => ({ value, at: toPlot(value), label: format(value, ctx) }));
}

/**
 * The width of the widest label under `labelsRef`, measured whenever `labels` changes while `measuring`, and again
 * once web fonts land. An inside y column is right-aligned against it, which only the rendered text can say.
 */
export function useLabelWidth(labelsRef: RefObject<SVGGElement | null>, measuring: boolean, labels: readonly ResolvedTick[]): number {
  const [width, setWidth] = useState(0);
  const key = measuring ? labels.map((t) => t.label).join('\n') : '';
  useLayoutEffect(() => {
    if (!measuring) return;
    const measure = (): void => {
      let widest = 0;
      for (const el of labelsRef.current?.querySelectorAll('text') ?? []) {
        if (typeof el.getComputedTextLength === 'function') widest = Math.max(widest, el.getComputedTextLength());
      }
      setWidth((prev) => (prev === widest ? prev : widest));
    };
    measure();
    let live = true;
    // A web font landing after the first measure changes every width.
    document.fonts?.ready.then(() => { if (live) measure(); });
    return () => { live = false; };
  }, [measuring, key, labelsRef]);
  return width;
}

interface TicksProps {
  axis: Axis;
  list: ResolvedTick[];
  settings: TickSettings | false | null | undefined;
  width: number;
  height: number;
}

/** A line across the plot at each tick on `axis`, unless its settings turn them off. */
export function TickLines({ axis, list, settings, width, height }: TicksProps) {
  if (!settings || settings.lines === false || list.length === 0) return null;
  return (
    <g>
      {list.map((t) => (
        <line
          key={`t${axis}-${t.value}`}
          data-plot-element="tick"
          data-axis={axis}
          className={s.tick}
          {...(axis === 'x'
            ? { x1: t.at, x2: t.at, y1: 0, y2: height }
            : { x1: 0, x2: width, y1: t.at, y2: t.at })}
        />
      ))}
    </g>
  );
}

type LabelPlace = { x?: number; y?: number; textAnchor: 'start' | 'middle' | 'end'; dominantBaseline?: 'central' | 'hanging' };

/** Where an axis's labels sit across it: inside or outside the edge they label, `gap` px off it. */
function labelPlace(axis: Axis, outside: boolean, gap: number, height: number, yLabelWidth: number): LabelPlace {
  if (axis === 'y') {
    return outside
      ? { x: -gap, textAnchor: 'end', dominantBaseline: 'central' }
      : yLabelWidth > 0
        ? { x: gap + yLabelWidth, textAnchor: 'end', dominantBaseline: 'central' }
        : { x: gap, textAnchor: 'start', dominantBaseline: 'central' };
  }
  return outside
    ? { y: height + gap, textAnchor: 'middle', dominantBaseline: 'hanging' }
    : { y: height - gap, textAnchor: 'middle' };
}

/** The label of each tick on `axis`, placed as its settings say. */
export function TickLabels({ axis, list, settings, height, yLabelWidth, groupRef }: TicksProps & {
  /** The y column's widest label, which an inside column right-aligns against; 0 before it is measured. */
  yLabelWidth: number;
  groupRef?: RefObject<SVGGElement | null>;
}) {
  if (!settings || list.length === 0) return null;
  const placement = settings.labels ?? 'inside';
  if (placement === false) return null;
  const place = labelPlace(axis, placement === 'outside', settings.gap ?? LABEL_GAP_PX, height, yLabelWidth);
  return (
    <g ref={groupRef} className={s.tickLabels} aria-hidden="true">
      {list.map((t) => (
        <text
          key={`l${axis}-${t.value}`}
          data-plot-element="tick-label"
          data-axis={axis}
          data-placement={placement}
          className={s.tickLabel}
          x={axis === 'x' ? t.at : place.x}
          y={axis === 'y' ? t.at : place.y}
          textAnchor={place.textAnchor}
          dominantBaseline={place.dominantBaseline}
        >
          {t.label}
        </text>
      ))}
    </g>
  );
}
