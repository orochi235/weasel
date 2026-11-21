import { trimNumber } from '@weasel-js/geom';
import { clampParam, repeatCount, withDefaults } from './params';
import type { ShapeModule } from '../types';

/** What `shapeParams` takes on a `receipt` badge. */
export interface BadgeReceiptShapeParams {
  teeth?: number;
  /** How far each tear reaches in, 1 to 45 viewBox units. */
  tearDepth?: number;
  sideToTopRatio?: number;
}

const DEFAULTS: Required<BadgeReceiptShapeParams> = { teeth: 11, tearDepth: 4, sideToTopRatio: 3 };

/** The deepest a tear's base reaches, so its deepest tooth (1.1 times it) stops short of the centerline. */
const MAX_TEAR_DEPTH = 45;

function receiptPath(teeth: number, depth: number) {
  const N = repeatCount(teeth, 3);
  const baseDepth = clampParam(depth, 1, MAX_TEAR_DEPTH, DEFAULTS.tearDepth);
  const depthAt = (i: number) => baseDepth * (0.55 + 0.55 * Math.abs(Math.sin(i * 1.73 + 0.5)));
  let d = `M 0 0 L 100 0`;
  for (let i = 0; i < N; i++) {
    const yMid = ((i + 0.5) / N) * 100;
    const yEnd = ((i + 1) / N) * 100;
    d += ` L ${trimNumber(100 - depthAt(i), 3)} ${trimNumber(yMid, 3)} L 100 ${trimNumber(yEnd, 3)}`;
  }
  d += ` L 0 100`;
  for (let i = N - 1; i >= 0; i--) {
    const yMid = ((i + 0.5) / N) * 100;
    const yStart = (i / N) * 100;
    d += ` L ${trimNumber(depthAt(i + N), 3)} ${trimNumber(yMid, 3)} L 0 ${trimNumber(yStart, 3)}`;
  }
  return d + ' Z';
}

const BASE_TOP = 2;

const Receipt: ShapeModule<BadgeReceiptShapeParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = withDefaults(DEFAULTS, params);
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
    const ratio = clampParam(params.sideToTopRatio ?? DEFAULTS.sideToTopRatio, 0.2, 10, DEFAULTS.sideToTopRatio);
    const top = BASE_TOP;
    const side = Math.round(top * ratio);
    return { top, right: side, bottom: top, left: side };
  },
  stretches: true,
  defaults: DEFAULTS,
};

export default Receipt;
