/**
 * Running a layout against a scene: `LAYOUTS`, one batch of pose writes, and
 * the action that reaches both. A layout is a pure function of the graph;
 * `applyLayout` is the only thing that touches a scene.
 */
import {
  ActionDisabledReason,
  translatePoseViaDescriptor,
  carriedDescendants,
  composeWorldPose,
  rebaseLocalPose,
  sceneCarrySource,
  scenePoseAdapter,
  AUTO_POSE_DESCRIPTOR,
  type NodeId,
  type Action,
  type ActionDeps,
  type PoseDescriptor,
  type Scene,
  type AnyScene,
} from '@weasel-js/core';
import { force } from './force';
import { buildGraph, type GraphNodeLike, type GraphSource } from './graph';
import { chain } from './chain';
import { grid } from './grid';
import { layered } from './layered';
import { radial } from './radial';
import { tree } from './tree';
import { planOf, type LayoutFn, type LayoutOptions, type LayoutResult } from './layout';
import { routeWrites, routesOf, type LayoutRoutes } from './routeWrites';
import type { DiagramNodeReader } from './trait';
import { getOwn } from '@weasel-js/registry';

/** The layouts this package ships. A consumer's own go in the same shape. */
export const LAYOUTS: Readonly<Record<string, LayoutFn>> = Object.freeze({
  layered,
  tree,
  force,
  chain,
  radial,
  grid,
});

/** The layout `algorithm` names: itself when it is one, else its key in {@link LAYOUTS}, else `layered`. */
export const layoutOf = (algorithm: string | LayoutFn): LayoutFn =>
  typeof algorithm === 'function' ? algorithm : getOwn(LAYOUTS, algorithm) ?? layered;

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
  return writeLayout(scene, result, layoutWrites(scene, result, opts), opts.label);
}

/** What a layout result would write: the poses of the nodes no lock holds, and the edge data. */
interface LayoutWrites<TPose> {
  poses: readonly (readonly [string, TPose])[];
  data: ReadonlyMap<string, unknown>;
}

function layoutWrites<TPose>(
  scene: Scene<unknown, string, TPose>,
  result: LayoutResult,
  opts: ApplyLayoutOptions<TPose>,
): LayoutWrites<TPose> {
  const poses = layoutPoses(scene, result, opts.geometry);
  const data = opts.routes === undefined ? new Map<string, unknown>() : routeWrites(scene as never, opts.routes);
  // A node on a locked layer stays put, as it does under a live run.
  return { poses: [...poses].filter(([id]) => !scene.isLocked(id as never)), data };
}

const writesNothing = (w: LayoutWrites<unknown>): boolean => w.poses.length === 0 && w.data.size === 0;

function writeLayout<TPose>(
  scene: Scene<unknown, string, TPose>,
  result: LayoutResult,
  writes: LayoutWrites<TPose>,
  label = 'Layout',
): number {
  if (writesNothing(writes)) return 0;
  scene.batch(label, () => {
    for (const [id, pose] of writes.poses) scene.setPose(id as never, pose);
    for (const [id, d] of writes.data) scene.update(id as never, { data: d });
  });
  // Participants, not the descendants they carried along: a caller asking how
  // much a layout did means the nodes it placed.
  const wrote = new Set(writes.poses.map(([id]) => id));
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
  const sc = scene as unknown as AnyScene;
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
    const local = rebaseLocalPose(decided, translatePoseViaDescriptor(world, dx, dy, geometry), parent, compose, decompose);
    // A node in a singular frame, which no stored pose places, stays where it is.
    if (local === null) continue;
    out.set(id, local as TPose);
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
  const { result, writes } = planDiagram(scene, source, algorithm, opts);
  return writeLayout(scene, result, writes, opts.label);
}

/** A diagram layout's moves, and what writing them would change. */
interface DiagramPlan<TPose> {
  result: LayoutResult;
  writes: LayoutWrites<TPose>;
}

function planDiagram<TPose>(
  scene: Scene<unknown, string, TPose>,
  source: GraphSource<TPose>,
  algorithm: string | LayoutFn,
  opts: LayoutDiagramOptions<TPose>,
): DiagramPlan<TPose> {
  const graph = buildGraph(source, {
    ...(opts.read ? { read: opts.read } : {}),
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
  });
  const plan = planOf(layoutOf(algorithm), graph, opts.layout);
  const writes = layoutWrites(scene, plan.moves, {
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    routes: routesOf(graph, plan),
  });
  return { result: plan.moves, writes };
}

type SourceEntry<TPose> = { node: GraphNodeLike; pose: TPose };

const sameEntries = <TPose>(a: readonly SourceEntry<TPose>[], b: readonly SourceEntry<TPose>[]): boolean =>
  a.length === b.length && a.every((e, i) => e.node === b[i]!.node && e.pose === b[i]!.pose);

/**
 * `diagram.layout` — rebuild the graph, run a layout, write the result. Disabled
 * where the layout would write nothing: no graph, one laid out already, or every
 * participant it would move locked.
 */
export function createLayoutAction<TPose>(opts: LayoutActionOptions<TPose>): Action {
  const { read, geometry, layout, label } = opts;
  const options = {
    ...(read ? { read } : {}), ...(geometry ? { geometry } : {}), ...(layout ? { layout } : {}), ...(label ? { label } : {}),
  };
  const algorithm = opts.algorithm ?? 'layered';
  // `enabled` is asked on every render of a bar holding it, so the plan is kept
  // until the scene or anything the source yields changes.
  let memo: { scene: Scene<unknown, string, TPose>; version: number; entries: SourceEntry<TPose>[]; plan: DiagramPlan<TPose> } | null = null;
  const planFor = (scene: Scene<unknown, string, TPose>): DiagramPlan<TPose> => {
    const entries = [...opts.source()];
    const version = scene.getContentVersion();
    if (memo?.scene === scene && memo.version === version && sameEntries(memo.entries, entries)) return memo.plan;
    const plan = planDiagram(scene, () => entries, algorithm, options);
    memo = { scene, version, entries, plan };
    return plan;
  };
  const sceneOf = (deps: ActionDeps | undefined) => deps?.['scene'] as Scene<unknown, string, TPose> | undefined;
  return {
    id: opts.id ?? LAYOUT_ACTION_ID,
    label: opts.label ?? 'Lay out diagram',
    group: opts.group ?? 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const scene = sceneOf(deps);
        if (scene === undefined) return;
        const { result, writes } = planFor(scene);
        writeLayout(scene, result, writes, label);
      },
    },
    enabled: (deps) => {
      const scene = sceneOf(deps);
      return scene !== undefined && !writesNothing(planFor(scene).writes) ? true : ActionDisabledReason.NotApplicable;
    },
  };
}
