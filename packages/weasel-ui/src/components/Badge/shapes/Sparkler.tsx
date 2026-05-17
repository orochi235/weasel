import type { ShapeModule } from '../types';

export interface SparklerParams {
  points?: number;
  outerR?: number;
  innerR?: number;
  rotation?: number;
}

const DEFAULTS: Required<SparklerParams> = {
  points: 16,
  outerR: 58,
  innerR: 50,
  rotation: -5,
};

function sparklerPath(points: number, outerR: number, innerR: number, rotation: number) {
  const cx = 50, cy = 50;
  const total = points * 2;
  const step = (Math.PI * 2) / total;
  const start = (rotation * Math.PI) / 180;
  let d = '';
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = start + i * step;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + ' Z';
}

const Sparkler: ShapeModule<SparklerParams> = {
  Component: ({ variant, focused, params }) => {
    const { points, outerR, innerR, rotation } = { ...DEFAULTS, ...params };
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
