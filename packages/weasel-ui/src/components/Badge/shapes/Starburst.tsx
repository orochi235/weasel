import type { ShapeModule } from '../types';

function starburstPath(points = 12, outerR = 48, innerR = 36, rotation = -7) {
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

const d = starburstPath();
const dFocus = starburstPath(12, 52, 39, -7);

const Starburst: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d={dFocus} />}
    </>
  ),
  insets: { top: 14, right: 14, bottom: 14, left: 14 },
  stretches: false,
  defaultAspect: 1,
};

export default Starburst;
