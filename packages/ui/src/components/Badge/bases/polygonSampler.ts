import type { BaseSampler, PerimeterPoint } from './types';

/** Build a BaseSampler from a clockwise polygon's vertex list (viewBox 0..100). */
export function polygonSampler(verts: [number, number][], boxW: number, boxH: number): BaseSampler {
  const sx = 100 / boxW;
  const sy = 100 / boxH;
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
        const ex = (b[0] - a[0]) / sx;
        const ey = (b[1] - a[1]) / sy;
        const el = Math.hypot(ex, ey) || 1;
        const nx = ey / el;
        const ny = -ex / el;
        return { x, y, nx, ny };
      }
    }
    return { x: verts[0][0], y: verts[0][1], nx: 0, ny: -1 };
  };
  return { bodyPath, perimeterAt, totalCss };
}
