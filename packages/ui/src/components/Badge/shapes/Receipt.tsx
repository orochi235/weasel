import type { ShapeModule } from '../types';

export interface ReceiptParams {
  teeth?: number;
  tearDepth?: number;
  sideToTopRatio?: number;
}

const DEFAULTS: Required<ReceiptParams> = { teeth: 11, tearDepth: 4, sideToTopRatio: 3 };

function receiptPath(teeth: number, depth: number) {
  const N = Math.max(3, Math.floor(teeth));
  const baseDepth = Math.max(1, depth);
  const depthAt = (i: number) => baseDepth * (0.55 + 0.55 * Math.abs(Math.sin(i * 1.73 + 0.5)));
  let d = `M 0 0 L 100 0`;
  for (let i = 0; i < N; i++) {
    const yMid = ((i + 0.5) / N) * 100;
    const yEnd = ((i + 1) / N) * 100;
    d += ` L ${(100 - depthAt(i)).toFixed(3)} ${yMid.toFixed(3)} L 100 ${yEnd.toFixed(3)}`;
  }
  d += ` L 0 100`;
  for (let i = N - 1; i >= 0; i--) {
    const yMid = ((i + 0.5) / N) * 100;
    const yStart = (i / N) * 100;
    d += ` L ${depthAt(i + N).toFixed(3)} ${yMid.toFixed(3)} L 0 ${yStart.toFixed(3)}`;
  }
  return d + ' Z';
}

const BASE_TOP = 2;

const Receipt: ShapeModule<ReceiptParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = receiptPath(cfg.teeth, cfg.tearDepth);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && (
          <path className="badge-focus" d={d} transform="translate(50 50) scale(1.04) translate(-50 -50)" />
        )}
      </>
    );
  },
  insets: (params) => {
    const ratio = Math.max(0.2, Math.min(params.sideToTopRatio ?? DEFAULTS.sideToTopRatio, 10));
    const top = BASE_TOP;
    const side = Math.round(top * ratio);
    return { top, right: side, bottom: top, left: side };
  },
  stretches: true,
  defaults: DEFAULTS,
};

export default Receipt;
