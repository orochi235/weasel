/**
 * Keeping a scene's nodes on its output grid: the edit pass that runs a
 * {@link QuantizeRule}'s `stored` half on every committed write, the same rule
 * over a document being built, a preview pose, and the walk's `drawn` pose.
 */
import type { OutputGrid } from '@weasel-js/geom';
import type { ResizeAnchor } from '@weasel-js/routing';
import { deepEqual, isDev } from '@weasel-js/registry';
import { createSetDataOp } from 'core/ops/setData';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { SceneEditPass } from './editPass';
import type { AddNodeSpec, NodeId, RectPose, Scene } from './types';
import type { QuantizeRule } from './useSceneOptions';

/** The `scene.doc` key holding the document's {@link OutputGrid}. Absent,
 *  nothing quantizes. Setting it is an undoable edit, and the stored values
 *  re-snap inside it. */
export const OUTPUT_GRID_KEY = 'kit:outputGrid';

/** Where {@link quantizePass} runs: after every other pass, on what they wrote. */
export const QUANTIZE_PASS_ORDER = Number.POSITIVE_INFINITY;

type Quantized<TData, TPose> = { data: TData; pose: TPose };
type SceneLike<TData, TPose> = Pick<Scene<TData, string, TPose>, 'doc' | 'quantize'>;

/** The output grid `scene`'s document holds, if any. */
export function outputGridOf(scene: Pick<Scene<unknown, string, unknown>, 'doc'>): OutputGrid | undefined {
  return scene.doc.get<OutputGrid>(OUTPUT_GRID_KEY);
}

/** `node` with `rule`'s stored values laid over it, or `null` when they change nothing. */
function storedOf<TData, TPose>(
  rule: QuantizeRule<TData, TPose>,
  node: Quantized<TData, TPose>,
  grid: OutputGrid,
  anchor?: ResizeAnchor,
): Quantized<TData, TPose> | null {
  const next = applied(rule, node, grid, anchor);
  if (next && isDev() && applied(rule, next, grid, anchor) !== null) {
    console.warn('quantize: `stored` is not idempotent: run on its own output it changes it again', { node, next });
  }
  return next;
}

function applied<TData, TPose>(
  rule: QuantizeRule<TData, TPose>,
  node: Quantized<TData, TPose>,
  grid: OutputGrid,
  anchor?: ResizeAnchor,
): Quantized<TData, TPose> | null {
  const r = rule.stored?.(node, grid, anchor);
  if (!r) return null;
  const pose = r.pose !== undefined && !deepEqual(r.pose, node.pose) ? r.pose : node.pose;
  const data = r.data !== undefined && !deepEqual(r.data, node.data) ? r.data : node.data;
  return pose === node.pose && data === node.data ? null : { pose, data };
}

/** The edit pass a scene with a quantize rule installs: `stored` over every
 *  node an edit added, posed or changed the data of, and over every node when
 *  the edit set the grid. Clearing the grid changes nothing. */
export function quantizePass<TData, TPose>(
  scene: Scene<TData, string, TPose>,
  rule: QuantizeRule<TData, TPose>,
): SceneEditPass {
  return (summary) => {
    const grid = outputGridOf(scene);
    if (!grid || !rule.stored) return null;
    const ids: Iterable<NodeId> = summary.docChanged.has(OUTPUT_GRID_KEY)
      ? scene.nodes.keys()
      : new Set([...summary.added, ...summary.posed, ...summary.dataChanged]);
    const ops: Op[] = [];
    for (const id of ids) {
      const node = scene.get(id);
      if (!node) continue;
      const next = storedOf(rule, node, grid);
      if (!next) continue;
      if (next.pose !== node.pose) ops.push(createTransformOp({ id, from: node.pose, to: next.pose, coalesceKey: `quantize:${id}` }));
      if (next.data !== node.data) ops.push(createSetDataOp({ id, from: node.data, to: next.data }));
    }
    return ops.length > 0 ? ops : null;
  };
}

/** Install {@link quantizePass} on `scene` when it has a rule, and answer the
 *  nodes it is built with, `initial`, on the grid its document values `doc` hold. */
export function installQuantize<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  rule: QuantizeRule<TData, TPose> | undefined,
  initial: readonly AddNodeSpec<TData, TLayer, TPose>[] | undefined,
  doc: Readonly<Record<string, unknown>> | undefined,
): readonly AddNodeSpec<TData, TLayer, TPose>[] | undefined {
  if (rule) scene.addEditPass(quantizePass(scene, rule), { order: QUANTIZE_PASS_ORDER });
  return quantizedSpecs(initial, rule, doc);
}

/** `specs` with `stored` run over each, for a document being constructed or
 *  loaded with the document values `doc`. */
export function quantizedSpecs<T extends readonly AddNodeSpec<TData, TLayer, TPose>[] | undefined, TData, TLayer extends string, TPose>(
  specs: T,
  rule: QuantizeRule<TData, TPose> | undefined,
  doc: Readonly<Record<string, unknown>> | undefined,
): T {
  const grid = doc?.[OUTPUT_GRID_KEY] as OutputGrid | undefined;
  if (!specs || !rule?.stored || !grid) return specs;
  return specs.map((spec) => {
    const next = storedOf(rule, spec, grid);
    return next ? { ...spec, pose: next.pose, data: next.data } : spec;
  }) as unknown as T;
}

/** `pose`, a live preview of node `id`, as `stored` would commit it, so the
 *  release lands where the preview showed. `anchor` is the side a resize holds. */
export function quantizedPreview<TPose>(
  scene: Pick<Scene<unknown, string, TPose>, 'doc' | 'quantize' | 'get'>,
  id: NodeId,
  pose: TPose,
  anchor?: ResizeAnchor,
): TPose {
  const node = scene.quantize?.stored ? scene.get(id) : undefined;
  return node ? quantizedNodePose(scene, { data: node.data, pose }, anchor) : pose;
}

/** `node`'s pose as `stored` would commit it, for a node the scene does not
 *  hold yet: an insert's, while it is dragged out. */
export function quantizedNodePose<TData, TPose>(
  scene: Pick<Scene<TData, string, TPose>, 'doc' | 'quantize'>,
  node: { data: TData; pose: TPose },
  anchor?: ResizeAnchor,
): TPose {
  const rule = scene.quantize;
  const grid = rule?.stored ? outputGridOf(scene) : undefined;
  if (!rule || !grid) return node.pose;
  return storedOf(rule, node, grid, anchor)?.pose ?? node.pose;
}

/** `node`, a stored pose and data of node `id` the scene does not hold yet,
 *  as its quantize rule would commit them: a live preview's. */
export function quantizedShape<TData, TPose>(
  scene: Pick<Scene<TData, string, TPose>, 'doc' | 'quantize'>,
  node: { data: TData; pose: TPose },
): { data: TData; pose: TPose } {
  const rule = scene.quantize;
  const grid = rule?.stored ? outputGridOf(scene) : undefined;
  if (!rule || !grid) return node;
  return storedOf(rule, node, grid) ?? node;
}

/** Where the scene walk draws a node: `drawn`'s pose for its world pose, when
 *  the scene has a rule with a `drawn` half; `undefined` when nothing moves. */
export function drawnPoseOf<TData, TPose>(
  scene: SceneLike<TData, TPose>,
): ((node: { data: TData }, pose: TPose) => TPose) | undefined {
  const drawn = scene.quantize?.drawn;
  if (!drawn) return undefined;
  return (node, pose) => {
    const grid = outputGridOf(scene);
    return grid ? drawn({ data: node.data, pose }, grid) : pose;
  };
}

/** `pose` at `width` × `height`, holding the sides `anchor` names: `max` keeps
 *  the right (or bottom) edge, as a drag from the left (or top) handle does,
 *  and anything else the left (or top). Absent, the top-left holds. */
export function quantizeSize<TPose extends RectPose>(
  pose: TPose,
  width: number,
  height: number,
  anchor?: ResizeAnchor,
): TPose {
  return {
    ...pose,
    x: anchor?.x === 'max' ? pose.x + pose.width - width : pose.x,
    y: anchor?.y === 'max' ? pose.y + pose.height - height : pose.y,
    width,
    height,
  };
}
