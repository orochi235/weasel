import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';

/** An axis-aligned box in output pixels. */
export interface PlacedBox { x0: number; y0: number; x1: number; y1: number }

/** Every rect path in `commands`, carried through the group transforms above it into output pixels. */
export function placedRects(commands: readonly DrawCommand[], at: GlMat3 = mat3.identity()): PlacedBox[] {
  const out: PlacedBox[] = [];
  for (const c of commands) {
    if (c.kind === 'group') {
      const m = c.transform ? mat3.multiply(Float64Array.from(at), c.transform) : at;
      out.push(...placedRects(c.children, m));
    } else if (c.kind === 'path' && c.path.kind === 'rect') {
      const { x, y, width, height } = c.path;
      const [ax, ay] = mat3.apply(at, x, y);
      const [bx, by] = mat3.apply(at, x + width, y + height);
      out.push({ x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) });
    }
  }
  return out;
}
