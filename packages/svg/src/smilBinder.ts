/**
 * The clip binder for an imported SVG: what turns `ParseResult.clip`'s track names into targets
 * over the scene nodes `svgNodesToKitDrafts` drafted from the same parse.
 */
import type { ClipBinder, Target } from '@weasel-js/animator';
import { getOwn } from '@weasel-js/registry';
import { boundsOfPath, sceneDataTarget, type DataTargetScene, type NodeId, type Path } from '@weasel-js/core';
import type { Affine } from '@weasel-js/geom';
import type { ParseResult } from './types';
import type { SvgDraftPose } from './draftPose';
import type { SvgSceneDraft } from './unpack';
import { createFadeTargets, type FadedLeaf } from './smilFades';
import { createGeometryTargets, lerpPathData, type GeometryScene } from './smilGeometry';
import { paintLensFor } from './smilPaints';
import { createTransformTargets } from './smilTransforms';

/** The part of a scene `svgClipBinder` reads and writes. A `Scene` of the drafts' poses satisfies it. */
export type SvgClipScene = DataTargetScene<Record<string, unknown>> & GeometryScene & {
  get(id: NodeId): { pose: SvgDraftPose; data: Record<string, unknown> } | undefined;
};

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
 * solid color on a shape or on a group whose children take it; `<id>.transform.<type>` moves
 * the pose of every shape the element's transform reaches. It also gives the `svg-path`
 * interpolation an animated `d` names.
 *
 * Any other name is `undefined`, for `options.target` to resolve. A text or an image under an
 * animated transform does not move with it.
 */
export function svgClipBinder(
  scene: SvgClipScene,
  parsed: Pick<ParseResult, 'clip' | 'animatedShapes' | 'animatedTransforms'>,
  drafts: readonly SvgSceneDraft<unknown>[],
  options: { target?: ClipBinder['target'] } = {},
): ClipBinder {
  const shapes = parsed.animatedShapes ?? {};
  const named = new Set((parsed.clip?.tracks ?? []).flatMap((t) => (t.kind === 'sampled' && t.target ? [t.target] : [])));
  const bySource = new Map<string, SvgSceneDraft<unknown>>();
  for (const d of drafts) if (d.source !== undefined && !bySource.has(d.source)) bySource.set(d.source, d);

  const leaves: FadedLeaf[] = [];
  const statics = new Map<string, number>();
  for (const d of drafts) {
    if (d.kind !== 'mark' || !d.fade) continue;
    const shape = d.source === undefined ? undefined : getOwn(shapes, d.source);
    const own = {
      ...(shape && named.has(`${d.source}.fill-opacity`) ? { fill: shape.fillOpacity } : {}),
      ...(shape && named.has(`${d.source}.stroke-opacity`) ? { stroke: shape.strokeOpacity } : {}),
    };
    leaves.push({ node: d.id, source: d.source, fade: d.fade, own });
    for (const [id, o] of Object.entries(d.fade.by)) statics.set(`${id}.opacity`, o);
    if (own.fill !== undefined) statics.set(`${d.source}.fill-opacity`, own.fill);
    if (own.stroke !== undefined) statics.set(`${d.source}.stroke-opacity`, own.stroke);
  }
  const fades = createFadeTargets(scene, leaves, statics);
  const geometry = createGeometryTargets(scene);
  const transforms = createTransformTargets(scene);
  const under = (top: string): string[] => {
    const inside = new Set([top]);
    for (const d of drafts) if (d.parentId !== null && inside.has(d.parentId)) inside.add(d.id);
    return drafts.filter((d) => d.kind === 'mark' && inside.has(d.id)).map((d) => d.id);
  };

  const own = (name: string): Target<unknown> | undefined => {
    const turn = name.lastIndexOf('.transform.');
    if (turn > 0) {
      const id = name.slice(0, turn);
      const record = getOwn(parsed.animatedTransforms, id);
      const draft = bySource.get(id);
      return record && draft ? transforms(id, name.slice(turn + 11), record, under(draft.id)) as Target<unknown> | undefined : undefined;
    }
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return undefined;
    const id = name.slice(0, dot);
    const attribute = name.slice(dot + 1);
    if (OPACITIES.has(attribute)) return fades(name) as Target<unknown> | undefined;
    const draft = bySource.get(id);
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
