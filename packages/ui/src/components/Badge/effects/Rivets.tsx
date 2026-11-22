import { useId } from 'react';
import type { BaseSampler, EffectModule } from '../bases/types';
import { finiteParams } from '../shapes/params';
import type { BadgeCorner } from '../types';
import { lightCorner } from './lightCorner';

/** What an effect of type `rivets` takes as `params`. */
export interface BadgeRivetsEffectParams {
  /** Rivet radius in CSS px. */
  radius?: number;
  /** Inset in CSS px, along each axis, from where the outline crosses the diagonal running in from a corner of the box. */
  inset?: number;
  /** Light origin (drives which side of each rivet gets the highlight). */
  lightFrom?: BadgeCorner;
}

const DEFAULTS: Required<BadgeRivetsEffectParams> = { radius: 2.4, inset: 7, lightFrom: 'tl' };

const SAMPLES = 240;

/**
 * Where the line in from box corner `(cx, cy)` along `(ux, uy)` (each ±1) first meets the outline, as
 * the distance along each axis, all in CSS px: 0 when the corner is inside the body, `null` if it never does.
 */
function cornerEntry(sampler: BaseSampler, boxW: number, boxH: number, cx: number, cy: number, ux: number, uy: number): number | null {
  const pts = Array.from({ length: SAMPLES }, (_, i) => {
    const p = sampler.perimeterAt((i / SAMPLES) * sampler.totalCss);
    return { x: (p.x * boxW) / 100, y: (p.y * boxH) / 100 };
  });
  let best: number | null = null;
  let behind = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const a = pts[i], b = pts[(i + 1) % SAMPLES];
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = ux * ey - uy * ex;
    if (den === 0) continue;
    const ax = a.x - cx, ay = a.y - cy;
    const mu = (ax * uy - ay * ux) / den;
    if (mu < 0 || mu >= 1) continue;
    const lambda = (ax * ey - ay * ex) / den;
    if (lambda < 0) behind++;
    else if (best === null || lambda < best) best = lambda;
  }
  // An odd count of crossings behind the corner puts the corner inside the body, where the line enters at once.
  return behind % 2 === 1 ? 0 : best;
}

const Rivets: EffectModule<BadgeRivetsEffectParams> = {
  Component: ({ sampler, boxW, boxH, variant, params }) => {
    const clipId = useId();
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = finiteParams({ ...DEFAULTS, ...params }, DEFAULTS);
    const sx = 100 / boxW, sy = 100 / boxH;
    const rx = cfg.radius * sx;
    const ry = cfg.radius * sy;
    const lightFrom = lightCorner(cfg.lightFrom, 'rivets');
    const litDx = lightFrom[1] === 'l' ? -cfg.radius * 0.32 : cfg.radius * 0.32;
    const litDy = lightFrom[0] === 't' ? -cfg.radius * 0.32 : cfg.radius * 0.32;
    const positions: [number, number][] = [];
    for (const [cx, cy, ux, uy] of [[0, 0, 1, 1], [boxW, 0, -1, 1], [0, boxH, 1, -1], [boxW, boxH, -1, -1]]) {
      const entry = cornerEntry(sampler, boxW, boxH, cx, cy, ux, uy);
      if (entry === null) continue;
      const d = entry + cfg.inset;
      positions.push([(cx + ux * d) * sx, (cy + uy * d) * sy]);
    }
    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <path d={sampler.bodyPath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {positions.map(([cx, cy], i) => (
            <g key={i}>
              <ellipse className="badge-bevel-dark"        cx={cx} cy={cy} rx={rx} ry={ry} />
              <ellipse className="badge-bevel-medium-dark" cx={cx - litDx * 0.6 * sx} cy={cy - litDy * 0.6 * sy} rx={rx * 0.75} ry={ry * 0.75} />
              <ellipse className="badge-bevel-light"       cx={cx + litDx * sx} cy={cy + litDy * sy} rx={rx * 0.45} ry={ry * 0.45} />
            </g>
          ))}
        </g>
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Rivets;
