import { useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { runLength, trackRun, trackSlice, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { AlongContext, type RunAlign } from '../Along/alongContext';
import { useItemLengths, useRunGap } from '../Along/useItemLengths';
import { useRunRow } from '../Along/useRunRow';
import type { JogParts } from './Jog';
import s from './JogAlong.module.css';

/** Px the scrubber keeps along a run too short for it, as a straight Jog's does. */
const SCRUB_MIN = 80;

/** The attribute a Jog part lies on its run under. */
const JOG_PART = 'data-jog-part';

type PartKey = 'prev' | 'play' | 'next' | 'scrub' | 'readout' | 'caption';

const jogKeyOf = (child: Element): string | null => child.getAttribute(JOG_PART);

/**
 * A Jog laid along a curved shape: buttons, readout and caption each centered on their spot and tipped to it, in reading
 * order. The scrubber takes the stretch of the run the rest leave, and follows it.
 */
export function JogAlong({ parts, shape, align, className }: { parts: JogParts; shape: TrackShape; align: RunAlign; className?: string | undefined }): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const run = useMemo(() => trackRun(shape), [shape]);
  const scrubs = parts.scrub !== null;
  const order: PartKey[] = ['prev', 'play', 'next', ...(scrubs ? ['scrub' as const] : []), 'readout', ...(parts.caption != null ? ['caption' as const] : [])];
  const drawn = order.filter((key) => key !== 'scrub');
  const lengths = useItemLengths(root, drawn, jogKeyOf);
  const gap = useRunGap(root);

  const rest = runLength(drawn.map((key) => lengths.get(key) ?? 0), gap) + (scrubs ? gap : 0);
  const scrubLength = Math.max(SCRUB_MIN, run.length - rest);
  const row = useRunRow({ root, keyOf: jogKeyOf, run, lengths: order.map((key) => (key === 'scrub' ? scrubLength : lengths.get(key) ?? 0)), gap, align, overflow: 'center' });
  const [lo, hi] = scrubs ? scrubStretch(run, row.place(order.indexOf('scrub')).at * run.length, scrubLength) : [0, 0];
  const scrubShape = useSlice(scrubs ? shape : undefined, lo, hi);

  const part = (key: PartKey, node: ReactNode) => {
    const { className: item, style } = row.place(order.indexOf(key));
    return (
      <span className={item} {...{ [JOG_PART]: key }} style={style}>
        {node}
      </span>
    );
  };

  return (
    <div ref={root} className={[s.root, className].filter(Boolean).join(' ')} data-shape={shape.kind}>
      <AlongContext.Provider value={null}>
        {part('prev', parts.prev)}
        {part('play', parts.play)}
        {part('next', parts.next)}
        {parts.scrub?.(scrubShape)}
        {part('readout', parts.readout)}
        {parts.caption != null && part('caption', parts.caption)}
      </AlongContext.Provider>
    </div>
  );
}

/** The stretch `lo..hi` of `shape`, one identity while those hold, so the scrubber does not re-measure every render. */
function useSlice(shape: TrackShape | undefined, lo: number, hi: number): TrackShape | undefined {
  return useMemo(() => (shape ? trackSlice(shape, lo, hi) : undefined), [shape, lo, hi]);
}

/** The shape fractions, low then high, of a stretch `length` long centered `center` along `run`. Rounded, so a re-render
 *  that moves nothing hands the scrubber the same shape. */
function scrubStretch(run: TrackRun, center: number, length: number): [number, number] {
  if (run.length <= 0) return [0.5, 0.5];
  const f = (d: number) => {
    const g = Math.min(1, Math.max(0, d / run.length));
    return Math.round((run.reversed ? run.to - g * (run.to - run.from) : run.from + g * (run.to - run.from)) * 1e6) / 1e6;
  };
  const a = f(center - length / 2);
  const b = f(center + length / 2);
  return a <= b ? [a, b] : [b, a];
}
