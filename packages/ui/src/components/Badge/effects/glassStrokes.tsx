import { trimNumber } from '@weasel-js/geom';
import type { BaseSampler } from '../bases/types';

const BEZEL_SAMPLES = 240;

type Pt = { x: number; y: number };

/**
 * Path data for each contiguous run of the perimeter whose outward normal points up (`ny < 0`):
 * normal-aware rather than bbox-aligned, so a bezel drawn on it works on any silhouette. A run
 * crossing s=0 comes back as one path.
 */
export function upwardRunPaths(sampler: BaseSampler): string[] {
  const total = sampler.totalCss;
  const runs: Pt[][] = [];
  let cur: Pt[] | null = null;
  for (let i = 0; i < BEZEL_SAMPLES; i++) {
    const s = (i / BEZEL_SAMPLES) * total;
    const pt = sampler.perimeterAt(s);
    if (pt.ny < 0) {
      if (!cur) {
        cur = [];
        runs.push(cur);
      }
      cur.push({ x: pt.x, y: pt.y });
    } else {
      cur = null;
    }
  }
  if (runs.length > 1) {
    const firstSample = sampler.perimeterAt(0);
    const lastSample = sampler.perimeterAt(((BEZEL_SAMPLES - 1) / BEZEL_SAMPLES) * total);
    if (firstSample.ny < 0 && lastSample.ny < 0) {
      const head = runs.shift()!;
      runs[runs.length - 1].push(...head);
    }
  }
  const paths: string[] = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    let d = `M ${trimNumber(run[0].x, 3)} ${trimNumber(run[0].y, 3)}`;
    for (let i = 1; i < run.length; i++) {
      d += ` L ${trimNumber(run[i].x, 3)} ${trimNumber(run[i].y, 3)}`;
    }
    paths.push(d);
  }
  return paths;
}

interface GlassStrokesProps {
  sampler: BaseSampler;
  boxW: number;
  boxH: number;
  bezelAlpha: number;
  /** CSS px. */
  bezelWidth: number;
  rimAlpha: number;
  /** CSS px. */
  rimWidth: number;
}

/** The glassy effects' top two passes: a white bezel along the upward-facing perimeter, then a dark rim all round. */
export function GlassStrokes({ sampler, boxW, boxH, bezelAlpha, bezelWidth, rimAlpha, rimWidth }: GlassStrokesProps) {
  // The badge SVG is 100×100 with preserveAspectRatio="none"; the larger inverse scale keeps
  // the stroke from getting too thin in either axis.
  const widthScale = Math.max(100 / boxW, 100 / boxH);
  return (
    <>
      {upwardRunPaths(sampler).map((d, i) => (
        <path
          key={`bz-${i}`}
          d={d}
          fill="none"
          stroke="white"
          strokeOpacity={bezelAlpha}
          strokeWidth={bezelWidth * widthScale}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      ))}
      <path
        d={sampler.bodyPath}
        fill="none"
        stroke="black"
        strokeOpacity={rimAlpha}
        strokeWidth={rimWidth * widthScale}
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: 'none' }}
      />
    </>
  );
}
