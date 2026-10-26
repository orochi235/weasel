/**
 * Bringing a node's descendants along when something writes the node's pose
 * and nothing writes theirs: a layout restacking a container, a drop landing
 * one, a page move. A descendant stored in a frame that moves rides it; one
 * stored above it, under an envelope, stays behind unless it is written too.
 */
import { composeWorldPose, frameAtOrAbove, rebaseLocalPose, type PoseAdapter, type PoseComposition } from './composeFrame';
import { scenePoseAdapter } from './scenePoseAdapter';
import { definesFrame } from './effectivePose';
import type { NodeId, Scene } from './types';

/** What carrying reads: the tree, every stored pose, and how poses compose. */
export interface CarrySource<TPose> {
  childrenOf(id: NodeId): readonly NodeId[];
  poses: PoseAdapter<TPose>;
  composition: PoseComposition<TPose>;
}

/** A {@link CarrySource} over a scene's document poses. */
export function sceneCarrySource(scene: Scene<unknown, string, unknown>): CarrySource<unknown> {
  return {
    childrenOf: (id) => scene.childrenOf(id),
    poses: scenePoseAdapter(scene),
    composition: scene.composition,
  };
}

/**
 * The stored poses that bring `root`'s descendants along with it: each one's
 * world pose put through `translate`, rebased into the frame it is stored in.
 * A descendant stored in the frame of `root` or of a node under it is left
 * out, since that frame carries it, and so is one `translate` answers null
 * for. A descendant `moving` names is moving on its own: it and everything
 * under it are left to whoever moves it.
 */
export function carriedDescendants<TPose>(
  source: CarrySource<TPose>,
  root: NodeId,
  translate: (world: TPose, id: NodeId) => TPose | null,
  moving: (id: NodeId) => boolean = () => false,
): Map<NodeId, TPose> {
  const { poses, composition } = source;
  const under = new Set<NodeId>([root]);
  const out = new Map<NodeId, TPose>();
  const walk = (at: NodeId): void => {
    for (const id of source.childrenOf(at)) {
      if (moving(id)) continue;
      under.add(id);
      const parent = poses.getParent(id);
      const frame = frameAtOrAbove(poses, parent);
      if (frame === null || !under.has(frame as NodeId)) {
        const world = translate(composeWorldPose(poses, id, composition.compose), id);
        if (world !== null) out.set(id, rebaseLocalPose(poses, world, parent, composition.compose, composition.decompose));
      }
      walk(id);
    }
  };
  walk(root);
  return out;
}

/** The nodes whose stored pose is in `id`'s frame: its children, and through
 *  a child that is an envelope, that child's own. */
export function heldInFrame(
  scene: { childrenOf(id: NodeId): readonly NodeId[]; get(id: NodeId): { dependsOn?: unknown; derivePose?: unknown } | undefined },
  id: NodeId,
): NodeId[] {
  const out: NodeId[] = [];
  for (const c of scene.childrenOf(id)) {
    const node = scene.get(c);
    if (!node) continue;
    out.push(c);
    if (!definesFrame(node)) out.push(...heldInFrame(scene, c));
  }
  return out;
}
