import {
  composesFrames, composeWorldPose, definesFrame, rebaseLocalPose, scenePoseAdapter, type NodeId, type Scene,
} from '@weasel-js/core';

type AnyScene = Scene<unknown, string, unknown>;

/** Where `id` draws: its pose folded through every frame above it. */
export function worldPoseOf(scene: AnyScene, id: NodeId): unknown {
  return composeWorldPose(scenePoseAdapter(scene), id, scene.composition.compose);
}

/** `world` as a pose stored under `parent`, so the node draws there. */
export function localPoseUnder(scene: AnyScene, world: unknown, parent: NodeId | null): unknown {
  const { compose, decompose } = scene.composition;
  return rebaseLocalPose(scenePoseAdapter(scene), world, parent, compose, decompose);
}

/** The nodes whose stored pose is in `id`'s frame: its children, and through
 *  a child that is an envelope, that child's own. */
function heldIn(scene: AnyScene, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  for (const c of scene.childrenOf(id)) {
    const node = scene.get(c);
    if (!node) continue;
    if (definesFrame(node)) out.push(c);
    else out.push(...heldIn(scene, c));
  }
  return out;
}

/**
 * Run `change`, which moves container `id`'s pose or moves its children to
 * another parent, and leave everything that was inside it where it drew
 * before. Nothing to do in a scene of absolute poses.
 */
export function keepContentsPut(scene: AnyScene, id: NodeId, change: () => void): void {
  if (!composesFrames(scene.composition)) {
    change();
    return;
  }
  const held = heldIn(scene, id).map((n) => ({ n, world: worldPoseOf(scene, n) }));
  change();
  for (const { n, world } of held) scene.setPose(n, localPoseUnder(scene, world, scene.get(n)!.parent));
}
