/**
 * Running a layout against a scene: `LAYOUTS`, one batch of pose writes, and
 * the action that reaches both. A layout is a pure function of the graph;
 * `applyLayout` is the only thing that touches a scene.
 */
import {
  translatePoseViaDescriptor,
  carriedDescendants,
  composeWorldPose,
  rebaseLocalPose,
  sceneCarrySource,
  scenePoseAdapter,
  AUTO_POSE_DESCRIPTOR,
  type NodeId,
  type Action,
  type PoseDescriptor,
  type Scene,
} from '@weasel-js/core';
import { force } from './force';
import { buildGraph, type GraphSource } from './graph';
import { chain } from './chain';
import { layered } from './layered';
import { radial } from './radial';
import { tree } from './tree';
import { planOf, type LayoutFn, type LayoutOptions, type LayoutResult } from './layout';
import { routeWrites, routesOf, type LayoutRoutes } from './routeWrites';
import type { DiagramNodeReader } from './trait';

/** The layouts this package ships. A consumer's own go in the same shape. */
export const LAYOUTS: Readonly<Record<string, LayoutFn>> = Object.freeze({
  layered,
  tree,
  force,
  chain,
  radial,
});

/** Options for {@link applyLayout}. */
export interface ApplyLayoutOptions<TPose> {
  geometry?: PoseDescriptor<TPose>;
  /** The undo entry's name. Default `'Layout'`. */
  label?: string;
  /** Edge routes to write in the same batch, from `routesOf`. */
  routes?: LayoutRoutes;
}

/**
 * Write a layout's answer to the scene, as one undoable batch.
 *
 * Returns how many nodes moved. A layout with nothing to do, nodes or routes,
 * writes nothing and pushes no history entry.
 *
 * Nodes are **translated**, never re-posed from the layout's numbers: a node's
 * pose can be a path or anything else a consumer wired, and only its own
 * descriptor knows how to move one.
 *
 * A participant that is a container takes what its frame holds along.
 */
export function applyLayout<TPose>(
  scene: Scene<unknown, string, TPose>,
  result: LayoutResult,
  opts: ApplyLayoutOptions<TPose> = {},
): number {
  const poses = layoutPoses(scene, result, opts.geometry);
  const data = opts.routes === undefined ? new Map<string, unknown>() : routeWrites(scene as never, opts.routes);
  if (poses.size === 0 && data.size === 0) return 0;
  // A node on a locked layer stays put, as it does under a live run.
  const open = [...poses].filter(([id]) => !scene.isLocked(id as never));
  if (open.length === 0 && data.size === 0) return 0;
  scene.batch(opts.label ?? 'Layout', () => {
    for (const [id, pose] of open) scene.setPose(id as never, pose);
    for (const [id, d] of data) scene.update(id as never, { data: d });
  });
  // Participants, not the descendants they carried along: a caller asking how
  // much a layout did means the nodes it placed.
  const wrote = new Set(open.map(([id]) => id));
  let moved = 0;
  for (const id of result.keys()) if (wrote.has(id)) moved++;
  return moved;
}

/**
 * The poses a layout result implies, without writing any of them: each moved
 * node translated so its box starts where the layout put it, in world, and
 * stored in its container's frame. What a moved container's frame holds rides
 * it; a node under an envelope moved with it is written too.
 *
 * The translation is measured from the node's document pose, which a live run
 * in flight never changes, so a frame's answer does not depend on the frame
 * before it.
 */
export function layoutPoses<TPose>(
  scene: Scene<unknown, string, TPose>,
  result: LayoutResult,
  geometry: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): Map<string, TPose> {
  const sc = scene as unknown as Scene<unknown, string, unknown>;
  const { compose, decompose } = sc.composition;
  const stored = scenePoseAdapter(sc);
  const out = new Map<string, TPose>();
  // Reads what is already decided, so a node under a moved one is stored in its new frame.
  const decided = { ...stored, getPose: (id: string) => (out.has(id) ? out.get(id) : stored.getPose(id)) };
  const depth = (id: string) => {
    let d = 0;
    for (let at = scene.get(id as never)?.parent; at != null; at = scene.get(at)?.parent) d++;
    return d;
  };
  const ids = [...result.keys()].filter((id) => scene.get(id as never) !== undefined).sort((a, b) => depth(a) - depth(b));
  for (const id of ids) {
    const at = result.get(id)!;
    const world = composeWorldPose(stored, id, compose) as TPose;
    const bounds = geometry.getBounds(world);
    const dx = at.x - bounds.x;
    const dy = at.y - bounds.y;
    if (dx === 0 && dy === 0) continue;
    const parent = scene.get(id as never)!.parent;
    out.set(id, rebaseLocalPose(decided, translatePoseViaDescriptor(world, dx, dy, geometry), parent, compose, decompose) as TPose);
    const carried = carriedDescendants(sceneCarrySource(sc), id as NodeId, (w) => translatePoseViaDescriptor(w as TPose, dx, dy, geometry));
    for (const [d, pose] of carried) out.set(d, pose as TPose);
  }
  return out;
}

/** The default action id. */
export const LAYOUT_ACTION_ID = 'diagram.layout';

/** Options for {@link createLayoutAction}. Only `source` is required. */
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
  geometry?: PoseDescriptor<TPose>;
}

/** Options for {@link layoutDiagram}. */
export interface LayoutDiagramOptions<TPose> {
  layout?: LayoutOptions;
  read?: DiagramNodeReader;
  geometry?: PoseDescriptor<TPose>;
  /** The undo entry's name. Default `'Layout'`. */
  label?: string;
}

/** Builds the graph `source` reads, runs `algorithm` on it — a key of {@link LAYOUTS} or a layout of
 *  the caller's own — and writes the moves and routes as one undo entry. Returns how many nodes moved. */
export function layoutDiagram<TPose>(
  scene: Scene<unknown, string, TPose>,
  source: GraphSource<TPose>,
  algorithm: string | LayoutFn,
  opts: LayoutDiagramOptions<TPose> = {},
): number {
  const fn = typeof algorithm === 'function' ? algorithm : LAYOUTS[algorithm] ?? layered;
  const graph = buildGraph(source, {
    ...(opts.read ? { read: opts.read } : {}),
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
  });
  const plan = planOf(fn, graph, opts.layout);
  return applyLayout(scene, plan.moves, {
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    ...(opts.label ? { label: opts.label } : {}),
    routes: routesOf(graph, plan),
  });
}

/**
 * `diagram.layout` — rebuild the graph, run a layout, write the result.
 */
export function createLayoutAction<TPose>(opts: LayoutActionOptions<TPose>): Action {
  const { read, geometry, layout, label } = opts;
  const options = {
    ...(read ? { read } : {}), ...(geometry ? { geometry } : {}), ...(layout ? { layout } : {}), ...(label ? { label } : {}),
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
        if (scene !== undefined) layoutDiagram(scene, opts.source, opts.algorithm ?? 'layered', options);
      },
    },
    enabled: () => true as const,
  };
}
