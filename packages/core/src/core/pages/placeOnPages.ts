/** Putting content placed in world space onto a paged scene's pages. */
import {
  RECT_POSE_DESCRIPTOR, poseDescriptorForNode, translatePoseViaDescriptor, type PoseDescriptor,
} from '../geometry/poseDescriptor';
import { composeWorldPose, rebaseLocalPose } from '../scene/composePose';
import { sameValue } from '../scene/sameValue';
import { scenePoseAdapter } from '../scene/scenePoseAdapter';
import type { NodeId, Scene } from '../scene/types';
import { treePreorder } from '../scene/treeOrder';
import { pageNodeOf, pageRunOf, placedPagesOf } from './pageNodes';
import {
  asFollower, followerLandings, keepOnPage, pageForBounds, pasteboardOn, type FollowerOf,
} from './pagePlacement';

type AnyScene = Scene<unknown, string, unknown>;

/** Where a root goes: its page, or `null` for the run, and how far it moves to have part of it on that page. */
interface Destination {
  readonly page: string | null;
  readonly shift: { readonly dx: number; readonly dy: number };
}

const STILL = { dx: 0, dy: 0 };

/** Where each of `roots` goes, in their order: the page for its bounds (`pageForBounds`), moved onto it when
 *  it lies wholly off it with the pasteboard off; a node following others where the follower rule puts it, by
 *  where the roots it follows go (`followerLandings`); or nowhere, a root left on the pasteboard. */
function destinations(scene: AnyScene, roots: readonly NodeId[], descriptor: PoseDescriptor<unknown>): Map<NodeId, Destination> {
  const poses = scenePoseAdapter(scene);
  const placed = placedPagesOf(scene);
  const pasteboard = pasteboardOn(scene);
  const content = new Map<NodeId, Destination>();
  const followers: FollowerOf[] = [];
  for (const id of roots) {
    const node = scene.get(id)!;
    const follower = asFollower(id, node);
    if (follower !== null) {
      followers.push(follower);
      continue;
    }
    const bounds = poseDescriptorForNode(descriptor, node).getBounds(composeWorldPose(poses, id, scene.composition.compose));
    const page = pageForBounds(scene, bounds, placed);
    if (page) content.set(id, { page: page.id, shift: pasteboard ? STILL : keepOnPage(page, bounds) });
  }
  const landed = new Map<string, string | null>(roots.map((id) => [id, content.get(id)?.page ?? null]));
  for (const f of followers) landed.delete(f.id);
  const pages = followerLandings(scene, landed, followers);
  const out = new Map<NodeId, Destination>();
  for (const id of roots) {
    const at = pages.has(id) ? { page: pages.get(id)!, shift: STILL } : content.get(id);
    if (at) out.set(id, at);
  }
  return out;
}

/**
 * Move each of `roots`, roots of a paged scene, onto the page holding it
 * (`pageHolding`) at the world place it has, shifted so part of it is on that
 * page, each in the order given. A node following others goes on the page
 * every node it follows lands on, else into the page run. With the
 * pasteboard on, a root off every page stays where it is, and one on a page is
 * not moved. Content read from a format that places it in the world, such as
 * an opened file, goes onto its pages this way. Call inside the caller's
 * batch; a scene without pages is left alone.
 */
export function placeOnPages<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  roots: readonly NodeId[],
  options: { descriptor?: PoseDescriptor<unknown> } = {},
): void {
  const s = scene as unknown as AnyScene;
  const run = pageRunOf(s);
  if (run === null) return;
  const descriptor = options.descriptor ?? (RECT_POSE_DESCRIPTOR as PoseDescriptor<unknown>);
  const content = roots.filter((id) => id !== run && s.get(id)?.parent == null);
  moveIn(s, destinations(s, content, descriptor), run, descriptor);
}

/** Move each root into its page, or into `run` when it has none, keeping where its subtree is in the world
 *  but for its destination's shift. */
function moveIn(
  s: AnyScene,
  going: ReadonlyMap<NodeId, Destination>,
  run: NodeId,
  descriptor: PoseDescriptor<unknown>,
): void {
  const poses = scenePoseAdapter(s);
  const { compose, decompose } = s.composition;
  for (const [root, { page, shift }] of going) {
    const subtree = treePreorder([root], s.nodes).map((n) => n.id);
    const world = new Map(subtree.map((id) => {
      const at = composeWorldPose(poses, id, compose);
      const d = poseDescriptorForNode(descriptor, s.get(id)!);
      return [id, shift.dx === 0 && shift.dy === 0 ? at : translatePoseViaDescriptor(at, shift.dx, shift.dy, d)];
    }));
    s.move(root, page === null ? run : pageNodeOf(s, page)!);
    for (const id of subtree) {
      const local = rebaseLocalPose(poses, world.get(id), s.get(id)!.parent, compose, decompose);
      if (!sameValue(local, s.get(id)!.pose)) s.setPose(id, local);
    }
  }
}
