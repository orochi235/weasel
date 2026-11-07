/**
 * A group's `transform` carried down onto what it holds, the way `parseSvg`
 * collapses one at parse time: a path's geometry and paints go through it, a
 * text or image box is placed by it, and a clip moves with its group.
 */
import { boundsOfPath, poseFrameOf, transformPath } from '@weasel-js/core';
import { placeNode } from './placeBox';
import { placeTextNode } from './readText';
import { paintThroughMatrix, strokeThroughMatrix } from './paintThroughMatrix';
import { isIdentity, multiply } from './transform';
import { IDENTITY_MATRIX, type Matrix, type SvgNode } from './types';

const quiet = (): void => {};

function bake(n: SvgNode, m: Matrix): SvgNode {
  if (n.kind === 'group') {
    const { transform, ...rest } = n;
    const own = transform ? multiply(m, transform) : m;
    if (isIdentity(own)) return { ...rest, children: n.children.map((c) => bake(c, own)) };
    return {
      ...rest,
      children: n.children.map((c) => bake(c, own)),
      ...(n.clip ? { clip: transformPath(n.clip, own) } : {}),
      ...(n.fill ? { fill: paintThroughMatrix(n.fill, own) } : {}),
      ...(n.stroke ? { stroke: strokeThroughMatrix(n.stroke, own) } : {}),
    };
  }
  if (isIdentity(m)) return n;
  if (n.kind === 'path') {
    const { rotation, ...rest } = n;
    const box = boundsOfPath(n.path);
    const turn = rotation ? poseFrameOf({ x: box.x, y: box.y, width: box.width, height: box.height, rotation }) : null;
    const whole = turn ? multiply(m, turn) : m;
    return {
      ...rest,
      path: transformPath(n.path, whole),
      fill: paintThroughMatrix(n.fill, whole),
      ...(n.stroke ? { stroke: strokeThroughMatrix(n.stroke, whole) } : {}),
    };
  }
  const frame = poseFrameOf(n);
  const whole = frame ? multiply(m, frame) : m;
  if (n.kind === 'text') {
    const { rotation: _r, transform: _t, ...placed } = n;
    placeTextNode(placed, whole, quiet);
    return placed;
  }
  const { rotation: _r, transform: _t, ...placed } = n;
  placeNode(placed, 'image', whole, true, quiet);
  return placed;
}

/** `nodes` with every group `transform` baked into what lies under it. */
export function withTransformsBaked(nodes: readonly SvgNode[]): SvgNode[] {
  return nodes.map((n) => bake(n, IDENTITY_MATRIX));
}
