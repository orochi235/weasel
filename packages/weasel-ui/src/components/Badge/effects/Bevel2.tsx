import { useId } from 'react';
import type { EffectModule } from '../bases/types';

export type Corner2 = 'tl' | 'tr' | 'bl' | 'br';

export interface Bevel2EffectParams {
  /** Bevel band width in CSS px. */
  bevelWidth?: number;
  /** Which corner the light originates from. */
  lightFrom?: Corner2;
}

const DEFAULTS: Required<Bevel2EffectParams> = { bevelWidth: 6, lightFrom: 'tl' };

const SAMPLES = 240;

// Six shade buckets from brightest to darkest. Each maps to a CSS class.
const SHADE_CLASSES = [
  'badge-bevel-light',         // brightest (normal points straight at light)
  'badge-bevel-medium-light',
  'badge-bevel-medium-light',
  'badge-bevel-medium-dark',
  'badge-bevel-medium-dark',
  'badge-bevel-dark',          // darkest (normal points away from light)
];

function lightDirFor(corner: Corner2): { lx: number; ly: number } {
  const lx = corner[1] === 'l' ? -1 : 1;
  const ly = corner[0] === 't' ? -1 : 1;
  const len = Math.SQRT2;
  return { lx: lx / len, ly: ly / len };
}

const Bevel2: EffectModule<Bevel2EffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = { ...DEFAULTS, ...params };
    const clipId = useId();
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const total = sampler.totalCss;
    const { lx, ly } = lightDirFor(cfg.lightFrom);

    const outer: { x: number; y: number; bucket: number }[] = [];
    const inner: { x: number; y: number }[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const pt = sampler.perimeterAt((i / SAMPLES) * total);
      // dot(n, lightDir) where light points FROM the corner OUTWARD: surfaces whose
      // outward normal aligns with -light (facing the light source) are brightest.
      const d = -(pt.nx * lx + pt.ny * ly);
      // d ∈ [-1, 1]. Map to [0, SHADE_CLASSES.length).
      const t = Math.max(0, Math.min((d + 1) / 2, 0.9999));
      const bucket = Math.floor(t * SHADE_CLASSES.length);
      outer.push({ x: pt.x, y: pt.y, bucket });
      inner.push({
        x: pt.x - pt.nx * cfg.bevelWidth * sx,
        y: pt.y - pt.ny * cfg.bevelWidth * sy,
      });
    }

    interface Run { bucket: number; idxs: number[] }
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (let i = 0; i < SAMPLES; i++) {
      const bucket = outer[i].bucket;
      if (!cur || cur.bucket !== bucket) {
        cur = { bucket, idxs: [i] };
        runs.push(cur);
      } else {
        cur.idxs.push(i);
      }
    }
    if (runs.length > 1 && runs[0].bucket === runs[runs.length - 1].bucket) {
      runs[runs.length - 1].idxs = runs[runs.length - 1].idxs.concat(runs[0].idxs);
      runs.shift();
    }

    const pathFor = (run: Run): string => {
      // Each band overlaps its neighbours by one sample on each side so the seams between
      // shade buckets render without gaps.
      const first = run.idxs[0];
      const last = run.idxs[run.idxs.length - 1];
      const prev = (first - 1 + SAMPLES) % SAMPLES;
      const next = (last + 1) % SAMPLES;
      const expandedIdxs = [prev, ...run.idxs, next];
      const outerPts = expandedIdxs.map((i) => outer[i]);
      const innerPts = expandedIdxs.map((i) => inner[i]).reverse();
      const pts = [...outerPts, ...innerPts];
      let d = `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x.toFixed(3)} ${pts[i].y.toFixed(3)}`;
      }
      return d + ' Z';
    };

    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {runs.map((run, i) => (
            <path key={i} className={SHADE_CLASSES[run.bucket]} d={pathFor(run)} />
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Bevel2;
