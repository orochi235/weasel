import type { BaseModule, BaseSampler, PerimeterPoint } from './types';

export interface ChamferedRectParams {
  /** CSS px length of each 45° corner chamfer. */
  chamfer?: number;
}

const DEFAULTS: Required<ChamferedRectParams> = { chamfer: 6 };

const ChamferedRect: BaseModule<ChamferedRectParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW;
    const sy = 100 / boxH;
    // Chamfer per axis (CSS px → viewBox per-axis).
    const cx = cfg.chamfer * sx;
    const cy = cfg.chamfer * sy;
    // 8 vertices traced clockwise from top-left chamfer start.
    const verts: [number, number][] = [
      [cx, 0],
      [100 - cx, 0],
      [100, cy],
      [100, 100 - cy],
      [100 - cx, 100],
      [cx, 100],
      [0, 100 - cy],
      [0, cy],
    ];
    // Pre-compute CSS lengths of each segment and cumulative sums.
    const cssLens: number[] = [];
    const cumulative: number[] = [0];
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      const dx = (b[0] - a[0]) / sx;
      const dy = (b[1] - a[1]) / sy;
      const len = Math.hypot(dx, dy);
      cssLens.push(len);
      cumulative.push(cumulative[cumulative.length - 1] + len);
    }
    const totalCss = cumulative[cumulative.length - 1];

    const bodyPath = `M ${verts[0][0]} ${verts[0][1]} ` +
      verts.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ') + ' Z';

    const perimeterAt = (s: number): PerimeterPoint => {
      const sm = ((s % totalCss) + totalCss) % totalCss;
      for (let i = 0; i < cssLens.length; i++) {
        const segStart = cumulative[i];
        const segEnd = cumulative[i + 1];
        if (sm <= segEnd + 1e-9) {
          const t = cssLens[i] > 0 ? (sm - segStart) / cssLens[i] : 0;
          const a = verts[i];
          const b = verts[(i + 1) % verts.length];
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t;
          // Outward normal: edge direction in CSS rotated 90° clockwise.
          const ex = (b[0] - a[0]) / sx;
          const ey = (b[1] - a[1]) / sy;
          const el = Math.hypot(ex, ey) || 1;
          // Going clockwise around the body, outward = (-tangent_y, tangent_x)... actually
          // for clockwise traversal in SVG (y-down), outward is to the LEFT of direction,
          // which is (ey, -ex) normalised.
          const nx = ey / el;
          const ny = -ex / el;
          return { x, y, nx, ny };
        }
      }
      return { x: verts[0][0], y: verts[0][1], nx: 0, ny: -1 };
    };

    const sampler: BaseSampler = { bodyPath, perimeterAt, totalCss };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};

export default ChamferedRect;
