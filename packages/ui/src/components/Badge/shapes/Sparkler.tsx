import type { ShapeModule } from '../types';
import { finiteOr, repeatCount, withDefaults } from './params';
import { DEG_TO_RAD, trimNumber } from '@weasel-js/geom';

/** What `shapeParams` takes on a `sparkler` badge. */
export interface BadgeSparklerShapeParams {
  points?: number;
  outerR?: number;
  innerR?: number;
  rotation?: number;
}

const DEFAULTS: Required<BadgeSparklerShapeParams> = {
  points: 16,
  outerR: 58,
  innerR: 50,
  rotation: -5,
};

function sparklerPath(points: number, outerR: number, innerR: number, rotation: number) {
  const cx = 50, cy = 50;
  const total = repeatCount(points, 3) * 2;
  const step = (Math.PI * 2) / total;
  const start = rotation * DEG_TO_RAD;
  let d = '';
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = start + i * step;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += (i === 0 ? 'M ' : ' L ') + trimNumber(x, 2) + ' ' + trimNumber(y, 2);
  }
  return d + ' Z';
}

const Sparkler: ShapeModule<BadgeSparklerShapeParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = withDefaults(DEFAULTS, params);
    const points = cfg.points;
    const outerR = finiteOr(cfg.outerR, DEFAULTS.outerR);
    const innerR = finiteOr(cfg.innerR, DEFAULTS.innerR);
    const rotation = finiteOr(cfg.rotation, DEFAULTS.rotation);
    const d = sparklerPath(points, outerR, innerR, rotation);
    const dFocus = sparklerPath(points, outerR + 4, innerR + 3, rotation);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && <path className="badge-focus" d={dFocus} />}
      </>
    );
  },
  insets: { top: 4, right: 4, bottom: 4, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Sparkler;
