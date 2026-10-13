import { boundsOfPath, poseFrameOf, type Path } from '@weasel-js/core';
import { type Matrix, type SvgNode, IDENTITY_MATRIX } from './types';
import { multiply } from './transform';

/**
 * Tight bounding box around everything the tree draws, in the root's
 * coordinates — the fallback `viewBox` when the caller supplies none. A
 * node's `rotation` and a group's `transform` both move ink, so both are
 * applied here; a box taken from unrotated geometry crops the document. A
 * `hidden` node draws nothing and is left out.
 */
export function computeBounds(nodes: SvgNode[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (n: SvgNode, ctm: Matrix): void => {
    if (n.hidden) return;
    if (n.kind === 'group') {
      const childCtm = n.transform ? multiply(ctm, n.transform) : ctm;
      n.children.forEach((c) => visit(c, childCtm));
      return;
    }
    const b = n.kind === 'text' || n.kind === 'image'
      ? { minX: n.x, minY: n.y, maxX: n.x + n.width, maxY: n.y + n.height }
      : pathBounds(n.path);
    const frame = n.kind === 'path' ? null : poseFrameOf(n);
    const local = frame ? multiply(ctm, frame)
      : n.rotation ? rotateAboutCenter(ctm, b, n.rotation) : ctm;
    for (const [x, y] of corners(b)) {
      const px = local[0] * x + local[2] * y + local[4];
      const py = local[1] * x + local[3] * y + local[5];
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
  };
  nodes.forEach((n) => visit(n, IDENTITY_MATRIX));
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function corners(b: { minX: number; minY: number; maxX: number; maxY: number }): [number, number][] {
  return [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
}

/** `ctm` composed with the same `rotate(angle cx cy)` the element emits. */
function rotateAboutCenter(
  ctm: Matrix,
  b: { minX: number; minY: number; maxX: number; maxY: number },
  angle: number,
): Matrix {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return multiply(ctm, [c, s, -s, c, cx - cx * c + cy * s, cy - cx * s - cy * c]);
}

export function pathBounds(path: Path): { minX: number; minY: number; maxX: number; maxY: number } {
  const b = boundsOfPath(path);
  return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
}
