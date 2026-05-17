import type { ShapeModule } from '../types';

export interface BatParams {
  earHeight?: number;
  wingDepth?: number;
}

const DEFAULTS: Required<BatParams> = { earHeight: 18, wingDepth: 22 };

function batPath(earH: number, wingD: number) {
  const e = Math.max(4, Math.min(earH, 28));
  void wingD;
  // Coordinates derived from a top half, then mirrored to the bottom.
  // y values: top extremes around (50 - 45) = 5, central axis at 50.
  // y mirror: y' = 100 - y.
  const topY = 50 - 45;            // 5
  const earTipY = topY + e;        // ear tip distance from top
  const wingTipX = 0;              // wing tips at left/right edges
  const wingY = 50;                // wing center on horizontal axis
  const dipY = topY + e * 0.55;    // central head dip below ear tops
  const innerNotchY = topY + e + 6;// inner notch below ear tops

  const pts: [number, number][] = [
    [50, dipY],          // top center dip
    [35, innerNotchY],   // inner notch right of left ear
    [22, topY + e * 0.05],// left ear tip
    [12, innerNotchY + 4],// outer side of left ear
    [wingTipX, wingY],   // left wing tip
  ];

  // Build the full silhouette: top half clockwise from center-top-dip,
  // around to left wing tip, then mirror to bottom-left, across bottom,
  // mirror to right wing tip, back to top.
  const topLeft: [number, number][] = [...pts];
  // Mirror across x-axis (y' = 100 - y) for bottom-left:
  const botLeft: [number, number][] = pts.slice(0, -1).reverse().map(([x, y]) => [x, 100 - y]);
  // Mirror left across y-axis (x' = 100 - x) for bottom-right:
  const botRight: [number, number][] = [...botLeft].reverse().map(([x, y]) => [100 - x, y]);
  // Top-right is botRight mirrored across x-axis:
  const topRight: [number, number][] = [...botRight].reverse().map(([x, y]) => [x, 100 - y]);

  const all = [
    ...topLeft,
    ...botLeft,
    [100 - wingTipX, 100 - wingY] as [number, number], // identical to wing tip, ignore
    ...botRight,
    ...topRight,
  ];

  // Build path. Using a manual cleaner construction:
  void earTipY; void all;
  const left = topLeft;
  const path: string[] = [];
  path.push(`M ${left[0][0]} ${left[0][1]}`);
  for (let i = 1; i < left.length; i++) path.push(`L ${left[i][0]} ${left[i][1]}`);
  // bottom-left (mirror y)
  for (let i = left.length - 2; i >= 0; i--) path.push(`L ${left[i][0]} ${100 - left[i][1]}`);
  // bottom-right (mirror x of bottom-left)
  for (let i = 1; i < left.length; i++) path.push(`L ${100 - left[i][0]} ${100 - left[i][1]}`);
  // top-right (mirror y of bottom-right)
  for (let i = left.length - 2; i >= 0; i--) path.push(`L ${100 - left[i][0]} ${left[i][1]}`);
  path.push('Z');
  return path.join(' ');
}

const Bat: ShapeModule<BatParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = batPath(cfg.earHeight, cfg.wingDepth);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && (
          <path className="badge-focus" d={d} transform="translate(50 50) scale(1.05) translate(-50 -50)" />
        )}
      </>
    );
  },
  insets: { top: 6, right: 8, bottom: 6, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Bat;
