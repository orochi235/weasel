import type { ShapeModule } from '../types';
import { DEG_TO_RAD, lerp, trimNumber } from '@weasel-js/geom';

/** What `shapeParams` takes on a `starburst` badge. */
export interface BadgeStarburstShapeParams {
  points?: number;
  outerR?: number;
  innerR?: number;
  rotation?: number;
  erosion?: number;
}

const DEFAULTS: Required<BadgeStarburstShapeParams> = {
  points: 12,
  outerR: 48,
  innerR: 36,
  rotation: -7,
  erosion: 0,
};

function starburstPath(points: number, outerR: number, innerR: number, rotationDeg: number, erosion: number) {
  const cx = 50, cy = 50;
  const total = points * 2;
  const step = (Math.PI * 2) / total;
  const start = rotationDeg * DEG_TO_RAD;
  const rnd = Math.max(0, Math.min(erosion, 1));
  const pts: [number, number][] = [];
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = start + i * step;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  if (rnd <= 0) {
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      d += (i === 0 ? 'M ' : ' L ') + trimNumber(pts[i][0], 2) + ' ' + trimNumber(pts[i][1], 2);
    }
    return d + ' Z';
  }
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const t = rnd * 0.45;
    const enterX = lerp(curr[0], prev[0], t);
    const enterY = lerp(curr[1], prev[1], t);
    const exitX = lerp(curr[0], next[0], t);
    const exitY = lerp(curr[1], next[1], t);
    if (i === 0) d += `M ${trimNumber(enterX, 2)} ${trimNumber(enterY, 2)}`;
    else d += ` L ${trimNumber(enterX, 2)} ${trimNumber(enterY, 2)}`;
    d += ` Q ${trimNumber(curr[0], 2)} ${trimNumber(curr[1], 2)} ${trimNumber(exitX, 2)} ${trimNumber(exitY, 2)}`;
  }
  return d + ' Z';
}

const Starburst: ShapeModule<BadgeStarburstShapeParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = starburstPath(cfg.points, cfg.outerR, cfg.innerR, cfg.rotation, cfg.erosion);
    const dFocus = starburstPath(cfg.points, cfg.outerR + 4, cfg.innerR + 3, cfg.rotation, cfg.erosion);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && <path className="badge-focus" d={dFocus} />}
      </>
    );
  },
  insets: { top: 8, right: 8, bottom: 8, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Starburst;
