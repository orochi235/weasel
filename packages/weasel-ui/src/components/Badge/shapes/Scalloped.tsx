import type { ShapeModule } from '../types';

function scallopedPath(perSide = 4) {
  const W = 100, H = 100;
  const segW = W / perSide;
  const segH = H / perSide;
  const sweep = 0;
  let d = `M 0 0`;
  for (let i = 0; i < perSide; i++) {
    const x = (i + 1) * segW;
    d += ` A ${segW / 2} ${segW / 2} 0 0 ${sweep} ${x} 0`;
  }
  for (let i = 0; i < perSide; i++) {
    const y = (i + 1) * segH;
    d += ` A ${segH / 2} ${segH / 2} 0 0 ${sweep} ${W} ${y}`;
  }
  for (let i = 0; i < perSide; i++) {
    const x = W - (i + 1) * segW;
    d += ` A ${segW / 2} ${segW / 2} 0 0 ${sweep} ${x} ${H}`;
  }
  for (let i = 0; i < perSide; i++) {
    const y = H - (i + 1) * segH;
    d += ` A ${segH / 2} ${segH / 2} 0 0 ${sweep} 0 ${y}`;
  }
  return d + ' Z';
}

const d = scallopedPath();

const Scalloped: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />
      )}
    </>
  ),
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: true,
};

export default Scalloped;
