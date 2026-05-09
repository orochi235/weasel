import type { Path, RectPath } from '@orochi235/weasel';
import type { Mesh } from './mesh';

export function tessellate(path: Path): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  throw new Error(`tessellate: PolygonPath not yet supported (added in next task)`);
}

function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  const vertices = new Float32Array([
    x, y,
    x + w, y,
    x + w, y + h,
    x, y + h,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  return { vertices, indices };
}
