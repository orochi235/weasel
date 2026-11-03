import {
  RECT_POSE_DESCRIPTOR, poseDescriptorForNode, translatePoseViaDescriptor, type PoseDescriptor,
} from '../geometry/poseDescriptor';
import { composeWorldPose, rebaseLocalPose } from '../scene/composePose';
import { sameValue } from '../scene/sameValue';
import { scenePoseAdapter } from '../scene/scenePoseAdapter';
import type { NodeId, Scene } from '../scene/types';
import { treePreorder } from '../scene/treeOrder';
import { layoutPages, pageHolding } from './pages';
import { PAGES_DOC_KEY, createPageRun, pageRunOf, type PagesDoc } from './pageNodes';
import { isFollower, keepOnPage } from './pagePlacement';

type AnyScene = Scene<unknown, string, unknown>;

/** Where a root goes: its page, or `null` for the run, and how far it moves to have part of it on that page. */
interface Destination {
  readonly page: string | null;
  readonly shift: { readonly dx: number; readonly dy: number };
}

const STILL = { dx: 0, dy: 0 };

/** Where each root goes: the page holding its bounds, moved onto it when it lies wholly off it, the run for a
 *  node that follows others, or nowhere. */
function destinations(
  scene: AnyScene,
  doc: PagesDoc,
  descriptor: PoseDescriptor<unknown>,
): Map<NodeId, Destination> {
  const placed = layoutPages(doc.pages, doc.layout);
  const poses = scenePoseAdapter(scene);
  const out = new Map<NodeId, Destination>();
  for (const id of scene.roots) {
    const node = scene.get(id)!;
    if (isFollower(node)) {
      out.set(id, { page: null, shift: STILL });
      continue;
    }
    const world = composeWorldPose(poses, id, scene.composition.compose);
    const bounds = poseDescriptorForNode(descriptor, node).getBounds(world);
    const page = pageHolding(placed, bounds);
    if (page) out.set(id, { page: page.id, shift: keepOnPage(page, bounds) });
  }
  return out;
}

/**
 * Turn a scene saved with its pages as the `core:pages` document value into
 * one whose pages are nodes: build the page run from that value, move each
 * root into the page holding it (`pageHolding`) at the world place it had,
 * and each node following others into the run, then drop the value. Not an
 * undo step: it is how the document loads. Returns whether there was a value
 * to convert into a scene without pages, so a second call is `false` and
 * changes nothing; a value beside an existing page run is dropped.
 */
export function adoptLegacyPages<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: { descriptor?: PoseDescriptor<unknown> } = {},
): boolean {
  const s = scene as unknown as AnyScene;
  const doc = s.doc.get<PagesDoc>(PAGES_DOC_KEY);
  if (doc === undefined) return false;
  if (pageRunOf(s) !== null) {
    s.untracked(() => s.doc.set(PAGES_DOC_KEY, undefined));
    return false;
  }
  const descriptor = options.descriptor ?? (RECT_POSE_DESCRIPTOR as PoseDescriptor<unknown>);
  const going = destinations(s, doc, descriptor);
  s.untracked(() => s.batch('Adopt pages', () => {
    moveIn(s, going, createPageRun(s, doc.pages, doc.layout), descriptor);
    s.doc.set(PAGES_DOC_KEY, undefined);
  }));
  return true;
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
    s.move(root, (page ?? run) as NodeId);
    for (const id of subtree) {
      const local = rebaseLocalPose(poses, world.get(id), s.get(id)!.parent, compose, decompose);
      if (!sameValue(local, s.get(id)!.pose)) s.setPose(id, local);
    }
  }
}
