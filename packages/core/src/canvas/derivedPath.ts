/**
 * The render walk's half of derived paths: resolving one against a scene, and
 * handing it to the painter.
 *
 * The resolver itself lives in `core/scene/derivedPath.ts`, beside
 * `derivedPose` — a *pose* can derive from a dependency's path, so
 * `effectivePose` has to be able to reach it.
 */
import type { DerivedDep, Node, NodeId, Scene } from 'core/scene/types';
import type { Path } from '@weasel-js/geom';
import { asNodeId } from 'core/scene/types';
import { definesFrame, derivedDepOf, effectivePose } from 'core/scene/effectivePose';
import { composeWorldPose, type PoseAdapter, type PoseComposition } from 'core/scene/composeFrame';
import { resolveDerivedPath } from 'core/scene/derivedPath';
import { createNodeMemoScope, type NodeMemoScope } from 'core/scene/nodeMemo';
import type { SceneViewDrawOne } from './NodeShape';

export { resolveDerivedPath } from 'core/scene/derivedPath';

const composes = <TPose>(composition: PoseComposition<TPose> | undefined): composition is PoseComposition<TPose> =>
  composition !== undefined && composition.closure !== 'identity';

/**
 * `(node) => the pose it is painted at`: the slot's `toPose` if it has one,
 * else the scene's effective pose, folded through the parent chain when
 * `poseComposition` makes a stored pose local to its container.
 */
export function scenePaintedPoseOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
  poseComposition?: PoseComposition<TPose>,
): (node: Node<TData, TLayer, TPose>) => TPose {
  const local = toPose ?? ((node: Node<TData, TLayer, TPose>) => effectivePose(scene, node));
  if (!composes(poseComposition)) return local;
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
  return (node) => composeWorldPose(chain, node.id, poseComposition.compose);
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
  poseComposition?: PoseComposition<TPose>,
): (id: NodeId) => DerivedDep<TPose> | undefined {
  const slot = memoSlotFor(toPose, poseComposition);
  if (slot === undefined) return (id) => derivedDepOf(scene, id);
  const ctx: SlotLookup<TPose> = {
    at: scenePaintedPoseOf(scene, toPose, poseComposition) as (node: unknown) => TPose,
    slot,
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
    return resolveDerivedPath(
      this.node as never, this.ctx.lookup, this.ctx.childrenOf, this.ctx.slot,
    );
  }
}

/** `(node) => the path it derives`, read through {@link sceneDepLookup}. */
export function sceneDerivedPathOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
  poseComposition?: PoseComposition<TPose>,
): (node: Node<TData, TLayer, TPose>) => Path | null {
  const depOf = sceneDepLookup(scene, toPose, poseComposition);
  const slot = memoSlotFor(toPose, poseComposition);
  const childrenOf = (id: NodeId): readonly NodeId[] => scene.childrenOf(id);
  return (node) => resolveDerivedPath(node, depOf, childrenOf, slot);
}

const toPoseScopes = new WeakMap<object, { local?: NodeMemoScope; world?: NodeMemoScope }>();

/** Where one way of reading poses memoizes its paths, or `undefined` for the
 *  scene's own slot: two readers painting one scene at different poses must
 *  not serve each other's paths. Every reader composing stored poses shares a
 *  slot; a `toPose` gets a scope that is collected with the function. */
function memoSlotFor<TPose>(
  toPose: object | undefined,
  poseComposition: PoseComposition<TPose> | undefined,
): string | NodeMemoScope | undefined {
  const frame = composes(poseComposition) ? 'world' : 'local';
  if (toPose === undefined) return frame === 'world' ? 'kit:derivedPath:world' : undefined;
  let scopes = toPoseScopes.get(toPose);
  if (scopes === undefined) {
    scopes = {};
    toPoseScopes.set(toPose, scopes);
  }
  return (scopes[frame] ??= createNodeMemoScope());
}

/**
 * Wrap a `drawOne` so a node that derives its geometry arrives at the painter
 * with the resolved path. The painter has no scene handle and so cannot read
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
  poseComposition?: PoseComposition<TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const derivedPathOf = sceneDerivedPathOf(scene, toPose, poseComposition);
  return (node, pose, view, ctx) => {
    if (node.dependsOn === undefined) return drawOne(node, pose, view, ctx);
    return drawOne(node, pose, view, { ...ctx, derivedPath: derivedPathOf(node) });
  };
}
