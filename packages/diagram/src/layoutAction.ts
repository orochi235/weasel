/**
 * Running a layout against a scene: `LAYOUTS`, one batch of pose writes, and
 * the action that reaches both.
 *
 * The split is the point. A layout is a pure function of the graph and is
 * tested as one; `applyLayout` is the only thing that touches a scene, and it
 * writes every move inside a single `scene.batch`, so a re-layout is one undo
 * entry rather than one per node.
 */
import {
  translatePoseViaDescriptor,
  AUTO_POSE_DESCRIPTOR,
  type Action,
  type PoseProjection,
  type Scene,
} from '@weasel-js/core';
import { force } from './force';
import { buildGraph, type GraphSource } from './graph';
import { layered } from './layered';
import { tree } from './tree';
import type { LayoutFn, LayoutOptions, LayoutResult } from './layout';
import type { DiagramNodeReader } from './trait';

/** The layouts this package ships. A consumer's own go in the same shape. */
export const LAYOUTS: Readonly<Record<string, LayoutFn>> = Object.freeze({
  layered,
  tree,
  force,
});

export interface ApplyLayoutOptions<TPose> {
  geometry?: PoseProjection<TPose>;
  /** The undo entry's name. Default `'Layout'`. */
  label?: string;
}

/**
 * Write a layout's answer to the scene, as one undoable batch.
 *
 * Returns how many nodes moved, which is zero for a layout that had nothing to
 * do — nothing is written and no history entry is pushed.
 *
 * Nodes are **translated**, never re-posed from the layout's numbers: a node's
 * pose can be a path or anything else a consumer wired, and only its own
 * descriptor knows how to move one.
 *
 * A participant that is a container takes its whole subtree along. `setPose`
 * does not cascade — poses are absolute — so a built body would otherwise walk
 * out from under its own label rows with every test green.
 */
export function applyLayout<TPose>(
  scene: Scene<unknown, string, TPose>,
  result: LayoutResult,
  opts: ApplyLayoutOptions<TPose> = {},
): number {
  const poses = layoutPoses(scene, result, opts.geometry);
  if (poses.size === 0) return 0;
  scene.batch(opts.label ?? 'Layout', () => {
    for (const [id, pose] of poses) scene.setPose(id as never, pose);
  });
  // Participants, not the descendants they carried along: a caller asking how
  // much a layout did means the nodes it placed.
  let moved = 0;
  for (const id of result.keys()) if (poses.has(id)) moved++;
  return moved;
}

/**
 * The poses a layout result implies, without writing any of them: each moved
 * node translated to its new top-left, and its subtree translated with it.
 *
 * Split out because a *live* layout needs the same answer every frame and must
 * not write it — it publishes to the override channel and commits once. The
 * translation is measured from the node's document pose, which a run in flight
 * never changes, so a frame's answer does not depend on the frame before it.
 */
export function layoutPoses<TPose>(
  scene: Scene<unknown, string, TPose>,
  result: LayoutResult,
  geometry: PoseProjection<TPose> = AUTO_POSE_DESCRIPTOR as PoseProjection<TPose>,
): Map<string, TPose> {
  const out = new Map<string, TPose>();
  for (const [id, at] of result) {
    const node = scene.get(id as never);
    if (node === undefined) continue;
    const bounds = geometry.getBounds(node.pose);
    const dx = at.x - bounds.x;
    const dy = at.y - bounds.y;
    if (dx === 0 && dy === 0) continue;
    out.set(id, translatePoseViaDescriptor(node.pose, dx, dy, geometry));
    for (const descendant of subtreeOf(scene, id)) {
      const child = scene.get(descendant as never);
      if (child === undefined) continue;
      out.set(descendant, translatePoseViaDescriptor(child.pose, dx, dy, geometry));
    }
  }
  return out;
}

function subtreeOf<TPose>(scene: Scene<unknown, string, TPose>, id: string): string[] {
  const out: string[] = [];
  const stack = [...scene.childrenOf(id as never)];
  while (stack.length > 0) {
    const next = stack.pop()!;
    out.push(next);
    stack.push(...scene.childrenOf(next));
  }
  return out;
}

/** The default action id. */
export const LAYOUT_ACTION_ID = 'diagram.layout';

export interface LayoutActionOptions<TPose> {
  /** Where the graph is read from. The same thunk the port affordance takes. */
  source: GraphSource<TPose>;
  /** Default {@link LAYOUT_ACTION_ID}. */
  id?: string;
  label?: string;
  /** Which `<ActionBar group>` it lands in. Default `'diagram'`, alongside
   *  connect — give a bar of its own a group of its own. */
  group?: string;
  /** A key in {@link LAYOUTS}, or a layout of the consumer's own. Default
   *  `'layered'`. */
  algorithm?: string | LayoutFn;
  layout?: LayoutOptions;
  read?: DiagramNodeReader;
  geometry?: PoseProjection<TPose>;
}

/**
 * `diagram.layout` — rebuild the graph, run a layout, write the result.
 *
 * A factory rather than a singleton for the reason every other entry point in
 * this package is one: which nodes are in the diagram is the consumer's, and
 * this package has no scene at module scope.
 */
export function createLayoutAction<TPose>(opts: LayoutActionOptions<TPose>): Action {
  const algorithm = typeof opts.algorithm === 'function'
    ? opts.algorithm
    : LAYOUTS[opts.algorithm ?? 'layered'] ?? layered;
  const build = {
    ...(opts.read ? { read: opts.read } : {}),
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
  };

  return {
    id: opts.id ?? LAYOUT_ACTION_ID,
    label: opts.label ?? 'Lay out diagram',
    group: opts.group ?? 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const scene = deps['scene'] as Scene<unknown, string, TPose> | undefined;
        if (scene === undefined) return;
        const graph = buildGraph(opts.source, build);
        applyLayout(scene, algorithm(graph, opts.layout), {
          ...(opts.geometry ? { geometry: opts.geometry } : {}),
          ...(opts.label ? { label: opts.label } : {}),
        });
      },
    },
    enabled: () => true as const,
  };
}
