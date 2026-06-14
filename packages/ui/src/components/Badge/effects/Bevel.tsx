import { useId } from 'react';
import type { EffectModule } from '../bases/types';

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface BevelEffectParams {
  /** Bevel band width in CSS px. */
  bevelWidth?: number;
  /** Which corner the light originates from (drives the highlight/shadow distribution across edges). */
  lightFrom?: Corner;
}

const DEFAULTS: Required<BevelEffectParams> = { bevelWidth: 6, lightFrom: 'tl' };

type Side = 'top' | 'right' | 'bottom' | 'left';

function sideForNormal(nx: number, ny: number): Side {
  return Math.abs(ny) > Math.abs(nx)
    ? (ny < 0 ? 'top' : 'bottom')
    : (nx < 0 ? 'left' : 'right');
}

function bevelClasses(lightFrom: Corner): Record<Side, string> {
  const isTop = lightFrom[0] === 't';
  const isLeft = lightFrom[1] === 'l';
  return {
    top:    isTop  ? 'badge-bevel-light'        : 'badge-bevel-dark',
    bottom: isTop  ? 'badge-bevel-dark'         : 'badge-bevel-light',
    left:   isLeft ? 'badge-bevel-medium-light' : 'badge-bevel-medium-dark',
    right:  isLeft ? 'badge-bevel-medium-dark'  : 'badge-bevel-medium-light',
  };
}

const SAMPLES = 240;

const Bevel: EffectModule<BevelEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = { ...DEFAULTS, ...params };
    const clipId = useId();
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    const cls = bevelClasses(cfg.lightFrom);
    const total = sampler.totalCss;

    // Sample outer + inset rings; tag each sample with the side it belongs to.
    const outer: { x: number; y: number; side: Side }[] = [];
    const inner: { x: number; y: number }[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const pt = sampler.perimeterAt((i / SAMPLES) * total);
      outer.push({ x: pt.x, y: pt.y, side: sideForNormal(pt.nx, pt.ny) });
      inner.push({
        x: pt.x - pt.nx * cfg.bevelWidth * sx,
        y: pt.y - pt.ny * cfg.bevelWidth * sy,
      });
    }

    // Group consecutive samples sharing a side into runs (wrap-aware).
    interface Run { side: Side; idxs: number[] }
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (let i = 0; i < SAMPLES; i++) {
      const side = outer[i].side;
      if (!cur || cur.side !== side) {
        cur = { side, idxs: [i] };
        runs.push(cur);
      } else {
        cur.idxs.push(i);
      }
    }
    // Merge first and last runs if they wrap and share a side.
    if (runs.length > 1 && runs[0].side === runs[runs.length - 1].side) {
      runs[runs.length - 1].idxs = runs[runs.length - 1].idxs.concat(runs[0].idxs);
      runs.shift();
    }

    const pathFor = (run: Run): string => {
      const outerPts = run.idxs.map((i) => outer[i]);
      const innerPts = run.idxs.map((i) => inner[i]).reverse();
      const pts = [...outerPts, ...innerPts];
      if (pts.length === 0) return '';
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
            <path key={i} className={cls[run.side]} d={pathFor(run)} />
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Bevel;
