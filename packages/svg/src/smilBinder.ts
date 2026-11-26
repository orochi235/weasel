/**
 * The clip binder for an imported SVG: what turns `ParseResult.clip`'s track names into targets
 * over the scene nodes `svgNodesToKitDrafts` drafted from the same parse.
 */
import type { ClipBinder, Target } from '@weasel-js/animator';
import { getOwn } from '@weasel-js/registry';
import { boundsOfPath, sceneDataTarget, type NodeId, type Path } from '@weasel-js/core';
import type { Affine } from '@weasel-js/geom';
import type { ParseResult } from './types';
import type { SvgSceneDraft } from './unpack';
import { createFadeTargets, type FadedLeaf } from './smilFades';
import { createGeometryTargets, lerpPathData, type SvgClipScene } from './smilGeometry';
import { createSpreadTarget, paintLensFor } from './smilPaints';
import { createDraftTree } from './smilReach';
import { createTransformTargets } from './smilTransforms';

export type { SvgClipScene } from './smilGeometry';

const OPACITIES = new Set(['opacity', 'fill-opacity', 'stroke-opacity']);

/** How much a shape's lengths grew on their way into node `id`: the parse's matrix, then the placing of its box. */
function lengthScale(scene: SvgClipScene, id: string, matrix: Affine | undefined): number {
  const n = scene.get(id as NodeId);
  const path = (n?.data as { path?: Path } | undefined)?.path;
  let placed = 1;
  if (n && path) {
    const b = boundsOfPath(path);
    placed = b.width > 0 ? n.pose.width / b.width : b.height > 0 ? n.pose.height / b.height : 1;
  }
  const own = matrix ? Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2])) : 1;
  return own * placed;
}

/**
 * A `ClipBinder` for `parsed.clip` over `scene`, holding the nodes `drafts` describe: the drafts
 * as `svgNodesToKitDrafts` made them from `parsed`, ids and all, once they are in the scene.
 * `<id>.opacity` fades every leaf the element reaches, a group's included; `fill-opacity`,
 * `stroke-opacity`, `stroke-width`, `stroke-dasharray`, `stroke-dashoffset` and a shape's
 * geometry (`r`, `cx`, `width`, `points`, `d`, …) move that shape; `fill` and `stroke` set a
 * solid color on the element and every node taking that paint from it; `<id>.transform.<type>`
 * moves the pose of every leaf the element's transform reaches, a text's and an image's included. It also gives the `svg-path`
 * interpolation an animated `d` names.
 *
 * Any other name is `undefined`, for `options.target` to resolve.
 */
export function svgClipBinder(
  scene: SvgClipScene,
  parsed: Pick<ParseResult, 'clip' | 'animatedShapes' | 'animatedTransforms'>,
  drafts: readonly SvgSceneDraft<unknown>[],
  options: { target?: ClipBinder['target'] } = {},
): ClipBinder {
  const shapes = parsed.animatedShapes ?? {};
  const tree = createDraftTree(scene, drafts);

  const leaves: FadedLeaf[] = [];
  const statics = new Map<string, number>();
  for (const d of drafts) {
    if (d.kind !== 'mark' || !d.fade) continue;
    const from = d.animatedFrom;
    const own = { ...(from?.['fill-opacity'] ? { fill: from['fill-opacity'] } : {}), ...(from?.['stroke-opacity'] ? { stroke: from['stroke-opacity'] } : {}) };
    leaves.push({ node: d.id, fade: d.fade, own });
    for (const [id, o] of Object.entries(d.fade.by)) statics.set(`${id}.opacity`, o);
    if (own.fill) statics.set(`${own.fill.id}.fill-opacity`, own.fill.value);
    if (own.stroke) statics.set(`${own.stroke.id}.stroke-opacity`, own.stroke.value);
  }
  const fades = createFadeTargets(scene, leaves, statics);
  const geometry = createGeometryTargets(scene);
  const transforms = createTransformTargets(scene);
  const spreads = new Map<string, Target<unknown> | undefined>();

  const transformOf = (id: string, type: string): Target<unknown> | undefined => {
    const record = getOwn(parsed.animatedTransforms, id);
    const draft = tree.bySource(id);
    if (!record || !draft) return undefined;
    const nodes = tree.under(draft.id).filter((d) => d.kind === 'mark').map((d) => d.id);
    return transforms(id, type, record, { nodes, depth: tree.depthOf(draft.id), frameOf: tree.frameOf }) as Target<unknown> | undefined;
  };

  /** `fill` or `stroke` on element `id`: the color of its own draft and of every draft taking it from there. */
  const colorOf = (name: string, id: string, attribute: 'fill' | 'stroke'): Target<unknown> | undefined => {
    if (spreads.has(name)) return spreads.get(name);
    const own = tree.bySource(id);
    const nodes = drafts.filter((d) => d === own || d.animatedFrom?.[attribute]?.id === id).map((d) => d.id);
    const target = createSpreadTarget(scene, nodes, paintLensFor(attribute, 1)!) as Target<unknown> | undefined;
    spreads.set(name, target);
    return target;
  };

  const own = (name: string): Target<unknown> | undefined => {
    const turn = name.lastIndexOf('.transform.');
    if (turn > 0) return transformOf(name.slice(0, turn), name.slice(turn + 11));
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return undefined;
    const id = name.slice(0, dot);
    const attribute = name.slice(dot + 1);
    if (OPACITIES.has(attribute)) return fades(name) as Target<unknown> | undefined;
    if (attribute === 'fill' || attribute === 'stroke') return colorOf(name, id, attribute);
    const draft = tree.bySource(id);
    if (!draft || !scene.get(draft.id as NodeId)) return undefined;
    const shape = getOwn(shapes, id);
    if (shape && Object.hasOwn(shape.geometry, attribute)) return geometry(draft.id, shape, attribute) as Target<unknown> | undefined;
    const lens = paintLensFor(attribute, lengthScale(scene, draft.id, shape?.matrix));
    return lens && sceneDataTarget(scene, draft.id, lens);
  };

  return {
    target: (name) => own(name) ?? options.target?.(name),
    interpolate: { 'svg-path': lerpPathData },
  };
}
