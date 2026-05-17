import type { ShapeModule } from '../types';

export interface HexagonParams {
  tipHeight?: number;
  /** Truncate the top and bottom tips, leaving a horizontal flat edge.
   *  Measured as a distance from each tip vertically (0 = sharp point, tipHeight = fully flat). */
  tipTruncation?: number;
}

const DEFAULTS: Required<HexagonParams> = { tipHeight: 25, tipTruncation: 0 };

function hexPath(tip: number, truncation: number) {
  const t = Math.max(0, Math.min(tip, 49));
  const trunc = Math.max(0, Math.min(truncation, t));
  if (trunc <= 0) {
    return `M 50 0 L 100 ${t} L 100 ${100 - t} L 50 100 L 0 ${100 - t} L 0 ${t} Z`;
  }
  const ratio = trunc / t;
  const xL = 50 - 50 * ratio;
  const xR = 50 + 50 * ratio;
  return [
    `M ${xL} ${trunc}`,
    `L ${xR} ${trunc}`,
    `L 100 ${t}`,
    `L 100 ${100 - t}`,
    `L ${xR} ${100 - trunc}`,
    `L ${xL} ${100 - trunc}`,
    `L 0 ${100 - t}`,
    `L 0 ${t}`,
    'Z',
  ].join(' ');
}

const Hexagon: ShapeModule<HexagonParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = hexPath(cfg.tipHeight, cfg.tipTruncation);
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

export default Hexagon;
