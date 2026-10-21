import { ellipsePath, type NodeShapeEntry, type RectPose, rectPath } from '@weasel-js/core';
import { lensShapeOf } from './lensScene';
import type { LensNodeData, LensScene, LensSettings } from './lensTypes';

const RIM_PX = 2;

/** The lens canvas's colors, read from the theme the lab is in. */
export interface LensColors {
  rim: string;
  reticle: string;
}

type LensNode = { layer: string; data: LensNodeData<unknown> };
const isRole = (node: unknown, role: LensNodeData<unknown>['role']): boolean =>
  (node as LensNode).layer === 'lenses' && (node as LensNode).data?.role === role;

/** How each node of a lens draws and picks. A body and a reticle are picked by
 *  their whole silhouette; a leader is drawn and never picked. A reticle is
 *  drawn in its body's shape, so it reads the body from `scene`, and
 *  answers only for that scene's nodes. */
export function lensShapes<C>(
  colors: LensColors,
  scene: LensScene<C>,
): NodeShapeEntry<LensNodeData<unknown>, RectPose>[] {
  const ring = (color: string) => ({ paint: { color }, width: { px: RIM_PX } });
  const shaped = (shape: LensSettings<C>['shape'], p: RectPose) =>
    shape === 'square' ? rectPath(p.x, p.y, p.width, p.height) : ellipsePath(p);
  const outline = (node: { data: LensNodeData<unknown> }, p: RectPose) =>
    shaped(node.data.role === 'lens-body' ? node.data.shape : 'circle', p);
  const patch = (node: { data: LensNodeData<unknown> }, p: RectPose) =>
    shaped(lensShapeOf(scene, node.data.lensId) ?? 'circle', p);
  return [
    {
      id: 'labkit:lens-body',
      matches: (node) => isRole(node, 'lens-body'),
      paint: (node, p) => [{ kind: 'path', path: outline(node, p), stroke: ring(colors.rim) }],
      silhouette: (node, p) => outline(node, p),
    },
    {
      id: 'labkit:lens-reticle',
      matches: (node) => isRole(node, 'lens-reticle') && scene.get(node.id) === node,
      paint: (node, p) => [{ kind: 'path', path: patch(node, p), stroke: ring(colors.reticle) }],
      silhouette: (node, p) => patch(node, p),
    },
    {
      id: 'labkit:lens-leader',
      matches: (node) => isRole(node, 'lens-leader'),
      paint: (_node, _p, ctx) =>
        ctx?.derivedPath ? [{ kind: 'path', path: ctx.derivedPath, stroke: ring(colors.rim) }] : [],
      silhouette: () => null,
    },
  ];
}
