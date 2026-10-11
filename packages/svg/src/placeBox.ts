/**
 * Carry an axis-aligned box through an affine matrix, for the nodes that are
 * a box plus a rotation about its center (`<text>`, `<image>`) and so cannot
 * have a matrix baked into their geometry the way a path can.
 */
import type { Matrix } from './types';
import { applyMatrix, decomposeRotation, isIdentity, rebaseTransform } from './transform';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoxPlacement extends Box {
  /** Radians, about the placed box's center. */
  rotation: number;
  /** The matrix's uniform scale, `sqrt(|det|)`: what a font size or stroke
   *  width inside the box is multiplied by. */
  scale: number;
  flipX: boolean;
  flipY: boolean;
  /** False when the matrix holds something the placement does not: a skew,
   *  or a non-uniform scale or mirror the node cannot take. */
  exact: boolean;
}

/**
 * `stretch` says the node can scale its two axes independently and mirror
 * (an image); without it only a uniform scale is exact (text).
 */
export function placeBox(box: Box, m: Matrix, stretch: boolean): BoxPlacement {
  const [a, b, c, d] = m;
  const scale = Math.sqrt(Math.abs(a * d - b * c));
  const eps = 1e-4 * Math.hypot(a, b, c, d);
  const uniform = Math.abs(a - d) <= eps;
  if (Math.abs(b) <= eps && Math.abs(c) <= eps && (stretch || (uniform && a > 0))) {
    const p0 = applyMatrix(m, box.x, box.y);
    const p1 = applyMatrix(m, box.x + box.width, box.y + box.height);
    return {
      x: Math.min(p0.x, p1.x),
      y: Math.min(p0.y, p1.y),
      width: Math.abs(p1.x - p0.x),
      height: Math.abs(p1.y - p0.y),
      rotation: 0,
      scale,
      flipX: a < 0,
      flipY: d < 0,
      exact: true,
    };
  }
  const center = applyMatrix(m, box.x + box.width / 2, box.y + box.height / 2);
  const width = box.width * scale;
  const height = box.height * scale;
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: Math.atan2(b, a),
    scale,
    flipX: false,
    flipY: false,
    exact: uniform && Math.abs(b + c) <= eps && a * d - b * c > 0,
  };
}

/**
 * Apply an element's own `transform` to the box `node` already holds in the
 * frame of its inherited `ctm`: the box moves and scales, a rotation lands
 * on `node.rotation`, and what the node cannot hold is reported.
 *
 * Returns the uniform scale the caller owes the lengths inside the box.
 */
export function applyOwnTransform(
  node: Box & { rotation?: number; flipX?: boolean; flipY?: boolean },
  tag: string,
  ctm: Matrix,
  local: Matrix,
  stretch: boolean,
  onWarn: (m: string) => void,
): number {
  if (isIdentity(local)) return 1;
  const worldLocal = rebaseTransform(ctm, local);
  if (!worldLocal) {
    onWarn(`<${tag}> transform sits under a singular parent transform; dropped`);
    return 1;
  }
  // The form `serialize.ts` writes: the box stays put, to the last bit.
  const turn = decomposeRotation(worldLocal, node.x + node.width / 2, node.y + node.height / 2);
  if (turn != null) {
    node.rotation = turn;
    return 1;
  }
  const placed = placeBox(node, worldLocal, stretch);
  node.x = placed.x;
  node.y = placed.y;
  node.width = placed.width;
  node.height = placed.height;
  if (Math.abs(placed.rotation) > 1e-9) node.rotation = placed.rotation;
  if (placed.flipX) node.flipX = !node.flipX;
  if (placed.flipY) node.flipY = !node.flipY;
  if (!placed.exact) {
    onWarn(`<${tag}> transform has a skew or non-uniform scale the node cannot hold; kept its position, rotation, and uniform scale`);
  }
  return placed.scale;
}
