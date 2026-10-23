import { useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { trackRun, type RunAlign, type TrackShape } from '@weasel-js/geom';
import { AlongContext } from '../Along/alongContext';
import { useItemLengths, useRunGap } from '../Along/useItemLengths';
import { RunBand, RunEnds, useRunRow, type RunItemPlace } from '../Along/useRunRow';
import { SwatchButton, swatchesIn, swatchKeyDown, useSwatchApply, type SwatchApply } from './SwatchButton';
import type { SwatchGridOption } from './SwatchGrid';
import { inwardSign, ringDepths, ringPlan, ringsOf, ringThicknesses, viableRings, type SwatchRing } from './ringPlan';
import s from './SwatchGrid.module.css';

/** One palette laid on rings: its swatches, a row of `columns` to a ring, after what leads its first ring. */
export interface SwatchRingGroup {
  key: string;
  label?: string;
  options: readonly SwatchGridOption[];
  value?: string | null;
  columns: number;
  /** First on the group's first ring, before its swatches: a heading, a picker. */
  lead?: ReactNode;
  /** After the lead, when there are no swatches. */
  empty?: ReactNode;
  className?: string;
}

/** Props of {@link SwatchRings}. */
export interface SwatchRingsProps {
  shape: TrackShape;
  align: RunAlign;
  groups: readonly SwatchRingGroup[];
  onChange: (value: string | null) => void;
  onAltChange?: (value: string | null) => void;
  className?: string;
}

/** What the rings are spaced by: a swatch's size across and the gap between two along a ring, read off the first
 *  swatch drawn, and how thick each palette's lead is. */
interface SwatchMetrics {
  size: number;
  gap: number;
  leads: readonly number[];
}

const sameMetrics = (a: SwatchMetrics, b: SwatchMetrics): boolean =>
  a.size === b.size && a.gap === b.gap && a.leads.join() === b.leads.join();

function useSwatchMetrics(root: RefObject<HTMLElement | null>): SwatchMetrics {
  const [metrics, setMetrics] = useState<SwatchMetrics>({ size: 0, gap: 0, leads: [] });
  // A lead like the palette picker changes thickness with no prop saying so, so every commit looks again.
  useLayoutEffect(() => {
    const measure = (): void => {
      const swatch = root.current?.querySelector<HTMLElement>('[data-swatch]');
      const ring = swatch?.parentElement;
      const leads = [...(root.current?.querySelectorAll(':scope > [role="group"]') ?? [])].map(
        (group) => group.querySelector<HTMLElement>('[data-ring-item="lead"]')?.offsetHeight ?? 0,
      );
      const next = { size: swatch?.offsetHeight ?? 0, gap: ring ? Number.parseFloat(getComputedStyle(ring).columnGap) || 0 : 0, leads };
      setMetrics((prev) => (sameMetrics(prev, next) ? prev : next));
    };
    measure();
  });
  return metrics;
}

/**
 * Palettes laid along a curved shape, each row of each on a ring of its own: the first on the shape, every next one a
 * row further in toward its center of curvature, palette after palette. Rings stop where the curve bends too tight to
 * keep two swatches apart; a palette's rows past there share its last ring, which scrolls along itself as any ring
 * too long for its run does.
 */
export function SwatchRings({ shape, align, groups, onChange, onAltChange, className }: SwatchRingsProps): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const { size, gap, leads } = useSwatchMetrics(root);
  // Keyed by its numbers, so the rings are rebuilt only when a palette's row count changes.
  const rowsKey = groups.map((g) => Math.max(1, Math.ceil(g.options.length / g.columns))).join();
  const rows = useMemo(() => rowsKey.split(',').map(Number), [rowsKey]);
  const { plan, rings } = useMemo(() => {
    // Room is judged with every row on a ring of its own; the rings laid are then the ones the plan keeps.
    const room = viableRings(shape, inwardSign(shape, trackRun(shape)), ringDepths(ringThicknesses(rows, leads, size), gap), size, gap);
    const kept = ringPlan(rows, room);
    return { plan: kept, rings: ringsOf(shape, ringDepths(ringThicknesses(kept, leads, size), gap)) };
  }, [shape, rows, leads, size, gap]);
  const apply = useSwatchApply(onChange, onAltChange);
  const firsts = plan.map((_, i) => plan.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div ref={root} className={className ? `${s.rings} ${className}` : s.rings}>
      <AlongContext.Provider value={null}>
        {groups.map((g, i) => (
          <RingGroup key={g.key} group={g} rings={rings.slice(firsts[i], firsts[i]! + plan[i]!)} align={align} apply={apply} />
        ))}
      </AlongContext.Provider>
    </div>
  );
}

/** What one item of a ring draws, given where the ring puts it. */
interface RingEntry {
  key: string;
  render: (place: RunItemPlace) => ReactElement;
}

function RingGroup({ group, rings, align, apply }: { group: SwatchRingGroup; rings: readonly SwatchRing[]; align: RunAlign; apply: SwatchApply }): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const { options, value, columns, lead, empty } = group;
  const current = value === undefined ? -1 : options.findIndex((o) => o.value === value);
  const tabStop = current >= 0 ? current : 0;
  const swatches = () => swatchesIn(root.current);

  const swatch = (i: number): RingEntry => ({
    key: String(i),
    render: (place) => (
      <SwatchButton
        key={options[i]!.value ?? `none-${i}`}
        option={options[i]!}
        tabStop={i === tabStop}
        current={i === current}
        apply={apply}
        onKeyDown={swatchKeyDown(i, options, columns, apply, swatches)}
        className={place.className}
        style={place.style}
        data={{ 'data-ring-item': String(i), 'data-clipped': place.clipped }}
      />
    ),
  });
  const extra = (key: 'lead' | 'empty', node: ReactNode): RingEntry => ({
    key,
    render: (place) => (
      <div key={key} className={`${place.className} ${s.ringExtra}`} data-ring-item={key} data-clipped={place.clipped} style={place.style}>
        {node}
      </div>
    ),
  });

  return (
    <div ref={root} className={group.className ? `${s.ringGroup} ${group.className}` : s.ringGroup} role="group" aria-label={group.label}>
      {rings.map((ring, k) => {
        const lo = k * columns;
        const hi = k === rings.length - 1 ? options.length : Math.min(options.length, lo + columns);
        const entries: RingEntry[] = [];
        if (k === 0 && lead != null) entries.push(extra('lead', lead));
        if (k === 0 && options.length === 0 && empty != null) entries.push(extra('empty', empty));
        for (let i = lo; i < hi; i++) entries.push(swatch(i));
        return <Ring key={k} ring={ring} align={align} entries={entries} index={k} />;
      })}
    </div>
  );
}

const ringKeyOf = (child: Element): string | null => child.getAttribute('data-ring-item');

function Ring({ ring, align, entries, index }: { ring: SwatchRing; align: RunAlign; entries: readonly RingEntry[]; index: number }): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const keys = entries.map((e) => e.key);
  const lengths = useItemLengths(root, keys, ringKeyOf);
  const gap = useRunGap(root);
  const row = useRunRow({ root, keyOf: ringKeyOf, run: ring.run, lengths: keys.map((k) => lengths.get(k) ?? 0), gap, align });
  return (
    <div ref={root} {...row.rootProps} className={s.ring} data-ring={index}>
      <RunBand row={row} shape={ring.shape} />
      {entries.map((e, i) => e.render(row.place(i)))}
      <RunEnds row={row} run={ring.run} />
    </div>
  );
}
