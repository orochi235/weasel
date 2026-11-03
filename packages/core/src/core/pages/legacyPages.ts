import {
  RECT_POSE_DESCRIPTOR, poseDescriptorForNode, translatePoseViaDescriptor, type PoseDescriptor,
} from '../geometry/poseDescriptor';
import { composeWorldPose, rebaseLocalPose } from '../scene/composePose';
import { sameValue } from '../scene/sameValue';
import { scenePoseAdapter } from '../scene/scenePoseAdapter';
import type { NodeId, Scene } from '../scene/types';
import { treePreorder } from '../scene/treeOrder';
import { pageHolding, pageOfBounds, type PlacedPage } from './pages';
import { PAGES_DOC_KEY, createPageRun, pageRunOf, placedPagesOf, type PagesDoc } from './pageNodes';
import { isFollower, keepOnPage, pasteboardOn } from './pagePlacement';

type AnyScene = Scene<unknown, string, unknown>;

/** Where a root goes: its page, or `null` for the run, and how far it moves to have part of it on that page. */
interface Destination {
  readonly page: string | null;
  readonly shift: { readonly dx: number; readonly dy: number };
}

const STILL = { dx: 0, dy: 0 };

/** Where each of `roots` goes: the page holding its bounds, moved onto it when it lies wholly off it, the run
 *  for a node that follows others, or nowhere. With `pasteboard`, only a root on a page goes on it, unmoved. */
function destinations(
  scene: AnyScene,
  roots: readonly NodeId[],
  placed: readonly PlacedPage[],
  descriptor: PoseDescriptor<unknown>,
  pasteboard: boolean,
): Map<NodeId, Destination> {
  const poses = scenePoseAdapter(scene);
  const out = new Map<NodeId, Destination>();
  for (const id of roots) {
    const node = scene.get(id)!;
    if (isFollower(node)) {
      out.set(id, { page: null, shift: STILL });
      continue;
    }
    const world = composeWorldPose(poses, id, scene.composition.compose);
    const bounds = poseDescriptorForNode(descriptor, node).getBounds(world);
    const page = pasteboard ? pageOfBounds(placed, bounds) : pageHolding(placed, bounds);
    if (page) out.set(id, { page: page.id, shift: pasteboard ? STILL : keepOnPage(page, bounds) });
  }
  return out;
}

/**
 * Move each of `roots`, roots of a paged scene, onto the page holding it
 * (`pageHolding`) at the world place it has, shifted so part of it is on that
 * page, and each node following others into the page run. With the
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
  moveIn(s, destinations(s, content, placedPagesOf(s), descriptor, pasteboardOn(s)), run, descriptor);
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
  const roots = [...s.roots];
  s.untracked(() => s.batch('Adopt pages', () => {
    createPageRun(s, doc.pages, doc.layout);
    placeOnPages(s, roots, options);
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
