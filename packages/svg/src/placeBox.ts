/**
 * Carry an axis-aligned box through an affine matrix and back, for the nodes
 * that are a box in a frame of their own (`<text>`, `<image>`) and so cannot
 * have a matrix baked into their geometry the way a path can.
 */
import type { Matrix } from './types';
import { invert } from '@weasel-js/geom';
import { poseFrameOf, poseLinearOf, type PoseLinear } from '@weasel-js/core';
import { applyMatrix, decomposeRotation, formatMatrix, isIdentity, trimNumber } from './transform';

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
  /** What the matrix holds beyond the box, rotation, and flips, in the
   *  `PoseLinear` convention; absent when they hold all of it. */
  transform?: PoseLinear;
}

const near = (v: number, target: number): boolean => Math.abs(v - target) <= 1e-9;

/**
 * Split a non-singular `m` into the box it makes of `box`, a rotation, flips,
 * and the residual `transform` that none of them hold.
 *
 * `stretch` says the node can scale its two axes independently and mirror
 * (an image), which leaves only a skew for the residual; without it the box
 * takes the uniform scale alone (text).
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
    };
  }
  // Turned back by the x axis's angle, the linear part is `[[p, q], [0, r]]`.
  const p = Math.hypot(a, b);
  const q = (a * c + b * d) / p;
  const r = (a * d - b * c) / p;
  // A scale within the rounding of a written `matrix(...)` is no scale, or a
  // font size would drift a little on every export and import.
  const settle = (v: number): number => (Math.abs(v - 1) <= 1e-5 ? 1 : v);
  const sx = settle(stretch ? p : scale);
  const sy = settle(stretch ? Math.abs(r) : scale);
  const flipY = stretch && r < 0;
  const ry = flipY ? -sy : sy;
  const linear: PoseLinear = [p / sx, 0, q / ry, r / ry];
  const center = applyMatrix(m, box.x + box.width / 2, box.y + box.height / 2);
  const width = box.width * sx;
  const height = box.height * sy;
  const placed: BoxPlacement = {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: Math.atan2(b, a),
    scale: settle(scale),
    flipX: false,
    flipY,
  };
  if (!near(linear[0], 1) || !near(linear[2], 0) || !near(linear[3], 1)) placed.transform = linear;
  return placed;
}

/**
 * Take the box `node` holds in its element's own coordinates through `m`,
 * the element's whole transform (inherited and own): the box moves and
 * scales, a rotation lands on `node.rotation`, and a skew or a scale the
 * box cannot take lands on `node.transform`.
 *
 * Returns the uniform scale the caller owes the lengths inside the box.
 */
export function placeNode(
  node: Box & { rotation?: number; flipX?: boolean; flipY?: boolean; transform?: PoseLinear },
  tag: string,
  m: Matrix,
  stretch: boolean,
  onWarn: (m: string) => void,
): number {
  if (isIdentity(m)) return 1;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  if (!invert(m)) {
    onWarn(`<${tag}> sits under a singular transform; kept its size`);
    const center = applyMatrix(m, cx, cy);
    node.x = center.x - node.width / 2;
    node.y = center.y - node.height / 2;
    return 1;
  }
  // The form `boxTransformAttr` writes for a rotation: the box stays put, to the last bit.
  const turn = decomposeRotation(m, cx, cy);
  if (turn != null) {
    node.rotation = turn;
    return 1;
  }
  const placed = placeBox(node, m, stretch);
  node.x = placed.x;
  node.y = placed.y;
  node.width = placed.width;
  node.height = placed.height;
  if (Math.abs(placed.rotation) > 1e-9) node.rotation = placed.rotation;
  if (placed.flipX) node.flipX = !node.flipX;
  if (placed.flipY) node.flipY = !node.flipY;
  if (placed.transform) node.transform = placed.transform;
  return placed.scale;
}

/**
 * The `transform` attribute a text or image node's own frame is written as,
 * or `null` when it has none. A rotation alone is `rotate(deg cx cy)`; with a
 * `transform` it is the whole frame as a `matrix(...)`, which `placeNode`
 * splits back into the same parts.
 */
export function boxTransformAttr(
  node: Box & { rotation?: number; transform?: PoseLinear },
): string | null {
  if (poseLinearOf(node)) {
    const frame = poseFrameOf(node);
    const m = frame && formatMatrix(frame);
    return m ? `transform="${m}"` : null;
  }
  if (!node.rotation) return null;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const deg = (node.rotation * 180) / Math.PI;
  return `transform="rotate(${trimNumber(deg)} ${trimNumber(cx)} ${trimNumber(cy)})"`;
}
