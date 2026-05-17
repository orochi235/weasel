import type { ShapeModule } from '../types';

export interface ScallopedParams {
  bumpsPerSide?: number;
}

const DEFAULTS: Required<ScallopedParams> = { bumpsPerSide: 4 };

function scallopedPath(perSide: number) {
  const n = Math.max(2, Math.floor(perSide));
  const W = 100, H = 100;
  const segW = W / n;
  const segH = H / n;
  const sweep = 0;
  let d = `M 0 0`;
  for (let i = 0; i < n; i++) {
    const x = (i + 1) * segW;
    d += ` A ${segW / 2} ${segW / 2} 0 0 ${sweep} ${x} 0`;
  }
  for (let i = 0; i < n; i++) {
    const y = (i + 1) * segH;
    d += ` A ${segH / 2} ${segH / 2} 0 0 ${sweep} ${W} ${y}`;
  }
  for (let i = 0; i < n; i++) {
    const x = W - (i + 1) * segW;
    d += ` A ${segW / 2} ${segW / 2} 0 0 ${sweep} ${x} ${H}`;
  }
  for (let i = 0; i < n; i++) {
    const y = H - (i + 1) * segH;
    d += ` A ${segH / 2} ${segH / 2} 0 0 ${sweep} 0 ${y}`;
  }
  return d + ' Z';
}

const Scalloped: ShapeModule<ScallopedParams> = {
  Component: ({ variant, focused, params }) => {
    const d = scallopedPath(params?.bumpsPerSide ?? DEFAULTS.bumpsPerSide);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && (
          <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />
        )}
      </>
    );
  },
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Scalloped;
