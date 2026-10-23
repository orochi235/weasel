import { useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { placeAlongRun, runLength, trackRun, trackSlice, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { AlongContext, type RunAlign } from '../Along/alongContext';
import { placeStyle } from '../Along/placeOnRun';
import { useItemLengths, useRunGap } from '../Bar/useItemLengths';
import { BAR_ITEM } from '../Bar/useBarOverflow';
import type { JogParts } from './Jog';
import s from './JogAlong.module.css';

/** Px the scrubber keeps along a run too short for it, as a straight Jog's does. */
const SCRUB_MIN = 80;

type PartKey = 'prev' | 'play' | 'next' | 'scrub' | 'readout' | 'caption';

/**
 * A Jog laid along a curved shape: buttons, readout and caption each centered on their spot and tipped to it, in reading
 * order. The scrubber takes the stretch of the run the rest leave, and follows it.
 */
export function JogAlong({ parts, shape, align, className }: { parts: JogParts; shape: TrackShape; align: RunAlign; className?: string | undefined }): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const run = useMemo(() => trackRun(shape), [shape]);
  const order: PartKey[] = ['prev', 'play', 'next', ...(parts.scrub ? ['scrub' as const] : []), 'readout', ...(parts.caption != null ? ['caption' as const] : [])];
  const drawn = order.filter((key) => key !== 'scrub');
  const lengths = useItemLengths(root, drawn);
  const gap = useRunGap(root);

  const rest = runLength(drawn.map((key) => lengths.get(key) ?? 0), gap) + (parts.scrub ? gap : 0);
  const scrubLength = Math.max(SCRUB_MIN, run.length - rest);
  const spots = placeAlongRun(run, order.map((key) => (key === 'scrub' ? scrubLength : lengths.get(key) ?? 0)), { gap, align });
  const at = (key: PartKey) => spots[order.indexOf(key)]!;
  const scrubs = parts.scrub !== null;
  const [lo, hi] = scrubs ? scrubStretch(run, at('scrub').center, scrubLength) : [0, 0];
  const scrubShape = useMemo(() => (scrubs ? trackSlice(shape, lo, hi) : undefined), [shape, scrubs, lo, hi]);

  const part = (key: PartKey, node: ReactNode) => (
    <span className={s.item} {...{ [BAR_ITEM]: key }} style={placeStyle(run.length > 0 ? at(key) : run.at(0.5))}>
      {node}
    </span>
  );

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
