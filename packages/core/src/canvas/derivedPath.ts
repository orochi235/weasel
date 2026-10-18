/**
 * The render walk's half of derived paths: resolving one against a scene, and
 * handing it to the painter.
 *
 * The resolver itself lives in `core/scene/derivedPath.ts`, beside
 * `derivedPose` — a *pose* can derive from a dependency's path, so
 * `effectivePose` has to be able to reach it.
 */
import type { DerivedDep, Node, NodeId, Scene } from 'core/scene/types';
import { multiply, poseFrameInverseOf, poseFrameOf, type Path } from '@weasel-js/geom';
import { asNodeId } from 'core/scene/types';
import { definesFrame, derivedDepOf, effectivePose } from 'core/scene/effectivePose';
import { composesFrames, composeWorldPose, type PoseAdapter } from 'core/scene/composeFrame';
import { resolveDerivedPath } from 'core/scene/derivedPath';
import { createNodeMemoScope, type NodeMemoScope } from 'core/scene/nodeMemo';
import { carryBoxPath, carryPathBy } from 'core/scene/depFrame';
import type { SceneViewDrawOne } from './NodeShape';

export { resolveDerivedPath } from 'core/scene/derivedPath';

type ToPose<TData, TLayer extends string, TPose> = (node: Node<TData, TLayer, TPose>) => TPose;

/** `node` as the scene shows it, its `pose` an override's or a derived one: the stored node
 *  itself where the two agree. */
function shownNode<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  node: Node<TData, TLayer, TPose>,
): Node<TData, TLayer, TPose> {
  const pose = effectivePose(scene, node);
  return pose === node.pose ? node : { ...node, pose };
}

/** A slot's `toPose`, handed each node as the scene shows it, so a view drawn through one
 *  shows a drag in flight and a rig's motion as every other view does. */
export function sceneShownToPose<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose: ToPose<TData, TLayer, TPose>,
): ToPose<TData, TLayer, TPose> {
  return (node) => toPose(shownNode(scene, node));
}

/**
 * `(node) => the path its pose override shows it by`, in the frame the reader paints in: as
 * the override has it, or under a `toPose` carried from the box the scene shows the node at
 * to the box `toPose` answers.
 */
function sceneOverridePathOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: ToPose<TData, TLayer, TPose>,
): (node: Node<TData, TLayer, TPose>) => Path | undefined {
  if (toPose === undefined) return (node) => scene.overrides.read(node.id)?.path;
  return (node) => {
    const path = scene.overrides.read(node.id)?.path;
    if (path === undefined) return undefined;
    const shown = shownNode(scene, node);
    return carryBoxPath(path, shown.pose, toPose(shown));
  };
}

/**
 * `(node) => the pose it is painted at`: the slot's `toPose` of the node as the scene shows
 * it if it has one, else the scene's effective pose, folded through the parent chain when
 * the scene's composition makes a stored pose local to its container.
 */
export function scenePaintedPoseOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): (node: Node<TData, TLayer, TPose>) => TPose {
  const local = toPose
    ? sceneShownToPose(scene, toPose)
    : (node: Node<TData, TLayer, TPose>) => effectivePose(scene, node);
  if (!composesFrames(scene.composition)) return local;
  const chain: PoseAdapter<TPose> = {
    getPose: (id) => {
      const n = scene.get(asNodeId(id));
      return n ? local(n) : (undefined as unknown as TPose);
    },
    getParent: (id) => scene.get(asNodeId(id))?.parent ?? null,
    definesFrame: (id) => {
      const n = scene.get(asNodeId(id));
      return n === undefined || definesFrame(n);
    },
  };
  return (node) => composeWorldPose(chain, node.id, scene.composition.compose);
}

/**
 * `(id) => that node, the pose it is painted at, and the path it derives` —
 * resolved against the scene, so a dependency that is itself derived resolves
 * before it is read.
 *
 * A derived edge is drawn from these coordinates and must meet the nodes it
 * connects, so this reads the pose each one is painted at: see
 * {@link scenePaintedPoseOf}.
 */
export function sceneDepLookup<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): (id: NodeId) => DerivedDep<TPose> | undefined {
  const slot = memoSlotFor(toPose, composesFrames(scene.composition));
  if (slot === undefined) return (id) => derivedDepOf(scene, id);
  const ctx: SlotLookup<TPose> = {
    at: scenePaintedPoseOf(scene, toPose) as (node: unknown) => TPose,
    slot,
    shown: sceneOverridePathOf(scene, toPose) as (node: unknown) => Path | undefined,
    childrenOf: (id: NodeId) => scene.childrenOf(id),
    lookup: (id: NodeId) => {
      const node = scene.get(id);
      return node === undefined ? undefined : new SlotDep(node, ctx);
    },
  };
  return ctx.lookup;
}

interface SlotLookup<TPose> {
  at: (node: unknown) => TPose;
  slot: string | NodeMemoScope;
  /** The path a pose override shows a node by, where it has one. */
  shown: (node: unknown) => Path | undefined;
  childrenOf: (id: NodeId) => readonly NodeId[];
  lookup: (id: NodeId) => DerivedDep<TPose> | undefined;
}

/** A class, not an object literal with a `get path()` — see `SceneDep` in
 *  `core/scene/effectivePose.ts` for why. */
class SlotDep<TPose> implements DerivedDep<TPose> {
  readonly node: Node<unknown, string, TPose>;
  readonly pose: TPose;

  constructor(posed: unknown, private readonly ctx: SlotLookup<TPose>) {
    this.node = posed as Node<unknown, string, TPose>;
    this.pose = ctx.at(posed);
  }

  get path(): Path | null {
    return this.ctx.shown(this.node) ?? resolveDerivedPath(
      this.node as never, this.ctx.lookup, this.ctx.childrenOf, this.ctx.slot,
    );
  }
}

/** Whether something outside `node`'s data says what path it shows: it derives one, or a
 *  pose override carries one. The gate both scene walks check before resolving a path. */
export function showsComputedPath<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  node: { id: NodeId; dependsOn?: readonly NodeId[] | 'children' },
): boolean {
  return node.dependsOn !== undefined || scene.overrides.read(node.id)?.path !== undefined;
}

/**
 * `(node) => the path it shows in place of its data's`: a pose override's `path`, else the
 * one it derives, read through {@link sceneDepLookup}. A reader painting through a `toPose`
 * is answered the override's path carried into the box its `toPose` answers.
 */
export function sceneDerivedPathOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): (node: Node<TData, TLayer, TPose>) => Path | null {
  const depOf = sceneDepLookup(scene, toPose);
  const slot = memoSlotFor(toPose, composesFrames(scene.composition));
  const childrenOf = (id: NodeId): readonly NodeId[] => scene.childrenOf(id);
  const derived = (node: Node<TData, TLayer, TPose>): Path | null =>
    resolveDerivedPath(node, depOf, childrenOf, slot);
  const overridePathOf = sceneOverridePathOf(scene, toPose);
  return (node) => overridePathOf(node) ?? derived(node);
}

const toPoseScopes = new WeakMap<object, { local?: NodeMemoScope; world?: NodeMemoScope }>();

/** Where one way of reading poses memoizes its paths, or `undefined` for the
 *  scene's own slot: two readers painting one scene at different poses must
 *  not serve each other's paths. Every reader composing stored poses shares a
 *  slot; a `toPose` gets a scope that is collected with the function. */
function memoSlotFor(
  toPose: object | undefined,
  composes: boolean,
): string | NodeMemoScope | undefined {
  const frame = composes ? 'world' : 'local';
  if (toPose === undefined) return frame === 'world' ? 'kit:derivedPath:world' : undefined;
  let scopes = toPoseScopes.get(toPose);
  if (scopes === undefined) {
    scopes = {};
    toPoseScopes.set(toPose, scopes);
  }
  return (scopes[frame] ??= createNodeMemoScope());
}

/**
 * Wrap a `drawOne` so a node that derives its geometry, or whose pose override
 * carries a path, arrives at the painter with the resolved path. The painter has no scene handle and so cannot read
 * the dependencies' poses itself; both scene walks wrap here instead.
 *
 * A node that derives nothing passes the caller's `ctx` through untouched —
 * this runs per node per frame, and an added `{ derivedPath: null }` would be
 * an allocation per node for a field no painter reads.
 */
export function withDerivedPaths<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const derivedPathOf = sceneDerivedPathOf(scene, toPose);
  const ownPoseOf = composesFrames(scene.composition)
    ? (toPose ? sceneShownToPose(scene, toPose) : (node: Node<TData, TLayer, TPose>) => effectivePose(scene, node))
    : null;
  return (node, pose, view, ctx) => {
    if (!showsComputedPath(scene, node)) return drawOne(node, pose, view, ctx);
    let path = derivedPathOf(node);
    if (path !== null && ownPoseOf !== null && scene.overrides.read(node.id)?.path === undefined) {
      path = withoutInheritedFrame(path, pose, ownPoseOf(node));
    }
    return drawOne(node, pose, view, { ...ctx, derivedPath: path });
  };
}

/**
 * A derived path is drawn from its dependencies' painted poses, so it is already where it
 * shows; but the pose rotation the walk wraps every node in is `painted`'s, which carries its
 * containers' turns as well as its own. Carried back through what the containers add, the
 * wrap turns it by its own frame alone, as it does a root's.
 */
function withoutInheritedFrame(path: Path, painted: unknown, own: unknown): Path {
  const undo = poseFrameInverseOf(painted);
  if (undo === null) return path;
  const box = painted as { x: number; y: number; width: number; height: number };
  const o = own as { rotation?: number; transform?: unknown } | null;
  const redo = poseFrameOf({ x: box.x, y: box.y, width: box.width, height: box.height, rotation: o?.rotation, transform: o?.transform });
  return carryPathBy(path, redo === null ? undo : multiply(undo, redo));
}
