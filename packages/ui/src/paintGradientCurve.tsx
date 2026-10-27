import { useId, type ReactElement } from 'react';
import { trackShapeD, type TrackRun } from '@weasel-js/geom';
import type { TrackCtx } from './components/Slider';
import type { GradientTrackOpts } from './paintGradientTrack';
import s from './paintGradientTrack.module.css';

type Hatch = Required<NonNullable<GradientTrackOpts['hatch']>>;

/** How far each segment runs on under the next, in px, so no antialiased seam shows between them. */
const OVERLAP = 0.5;

/** The stretch of the run's shape between run fractions `a` and `b`, as path data. */
function stretchD(run: TrackRun, a: number, b: number): string {
  const [lo, hi] = [run.toShape(a), run.toShape(b)].sort((x, y) => x - y) as [number, number];
  return trackShapeD(run.shape, Math.max(0, lo), Math.min(1, hi));
}

/** Where the run's whole shape — the band — starts and ends, in run fractions. */
function bandEnds(run: TrackRun): [number, number] {
  const span = run.to - run.from;
  const g = (f: number) => run.reversed ? (run.to - f) / span : (f - run.from) / span;
  return [g(0), g(1)].sort((x, y) => x - y) as [number, number];
}

/**
 * A gradient track on a curve: the band stroked in one segment per sample, each a linear ramp along its chord between
 * the samples at its ends, with the end colors carried over the band past the value span.
 */
export function GradientCurve({ ctx, gradient, samples, activeRange, hatch }: {
  ctx: TrackCtx;
  gradient: (t: number) => string;
  samples: number;
  activeRange: [number, number] | undefined;
  hatch: Hatch;
}): ReactElement {
  const id = useId();
  const run = ctx.shape;
  if (run.from === run.to) return <svg className={s.curve} aria-hidden="true" />;
  const [bandLo, bandHi] = bandEnds(run);
  const seam = run.length > 0 ? OVERLAP / run.length : 0;
  const color = Array.from({ length: samples + 1 }, (_, i) => gradient(i / samples));

  const ramps = color.slice(1).map((end, i) => {
    const a = run.at(i / samples).point;
    const b = run.at((i + 1) / samples).point;
    const d = stretchD(run, i / samples, Math.min(1, (i + 1) / samples + seam));
    return { id: `${id}r${i}`, a, b, from: color[i]!, to: end, d };
  });
  const ends = [
    bandLo < 0 && { d: stretchD(run, bandLo, seam), stroke: color[0]! },
    bandHi > 1 && { d: stretchD(run, 1 - seam, bandHi), stroke: color[samples]! },
  ].filter((e) => e !== false);

  const low = activeRange ? ctx.valueToFraction(activeRange[0]) : 0;
  const high = activeRange ? ctx.valueToFraction(activeRange[1]) : 1;
  const dimmed = [low > 0 && stretchD(run, bandLo, low), high < 1 && stretchD(run, high, bandHi)].filter((d) => d !== false);
  const pattern = `${id}h`;

  return (
    <svg className={s.curve} aria-hidden="true">
      <defs>
        {ramps.map((r) => (
          <linearGradient key={r.id} id={r.id} gradientUnits="userSpaceOnUse" x1={r.a.x} y1={r.a.y} x2={r.b.x} y2={r.b.y}>
            <stop offset={0} stopColor={r.from} />
            <stop offset={1} stopColor={r.to} />
          </linearGradient>
        ))}
        {dimmed.length > 0 && (
          // CSS measures a gradient's angle from straight up; SVG rotates from the x axis.
          <pattern id={pattern} patternUnits="userSpaceOnUse" width={hatch.stripe + hatch.gap} height={1} patternTransform={`rotate(${hatch.angleDeg - 90})`}>
            <rect className={s.stripe} x={hatch.stripe} width={hatch.gap} height={1} />
          </pattern>
        )}
      </defs>
      {ends.map((e) => <path key={e.d} className={s.stroke} d={e.d} stroke={e.stroke} />)}
      {ramps.map((r) => <path key={r.id} className={s.stroke} d={r.d} stroke={`url(#${r.id})`} />)}
      {dimmed.map((d) => <path key={`h${d}`} className={s.stroke} d={d} stroke={`url(#${pattern})`} data-hatch="" />)}
      {dimmed.map((d) => <path key={`d${d}`} className={`${s.stroke} ${s.dim}`} d={d} strokeOpacity={hatch.dim / 100} data-dim="" />)}
    </svg>
  );
}
