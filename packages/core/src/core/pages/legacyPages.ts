import {
  RECT_POSE_DESCRIPTOR, poseDescriptorForNode, type PoseDescriptor,
} from '../geometry/poseDescriptor';
import { composeWorldPose, rebaseLocalPose } from '../scene/composePose';
import { sameValue } from '../scene/sameValue';
import { scenePoseAdapter } from '../scene/scenePoseAdapter';
import type { NodeId, Scene } from '../scene/types';
import { treePreorder } from '../scene/treeOrder';
import { layoutPages, pageHolding } from './pages';
import { PAGES_DOC_KEY, createPageRun, pageRunOf, type PagesDoc } from './pageNodes';

type AnyScene = Scene<unknown, string, unknown>;

/** Where each root goes: the page holding its bounds, the run for a node that follows others, or nowhere. */
function destinations(
  scene: AnyScene,
  doc: PagesDoc,
  descriptor: PoseDescriptor<unknown>,
): Map<NodeId, string | null> {
  const placed = layoutPages(doc.pages, doc.layout);
  const poses = scenePoseAdapter(scene);
  const out = new Map<NodeId, string | null>();
  for (const id of scene.roots) {
    const node = scene.get(id)!;
    const deps = node.dependsOn;
    if (Array.isArray(deps) && deps.length > 0) {
      out.set(id, null);
      continue;
    }
    const world = composeWorldPose(poses, id, scene.composition.compose);
    const page = pageHolding(placed, poseDescriptorForNode(descriptor, node).getBounds(world));
    if (page) out.set(id, page.id);
  }
  return out;
}

/**
 * Turn a scene saved with its pages as the `core:pages` document value into
 * one whose pages are nodes: build the page run from that value, move each
 * root into the page holding it (`pageHolding`) at the world place it had,
 * and each node following others into the run, then drop the value. Not an
 * undo step: it is how the document loads. Returns whether there was a value
 * to convert, so a second call is `false` and changes nothing.
 */
export function adoptLegacyPages<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: { descriptor?: PoseDescriptor<unknown> } = {},
): boolean {
  const s = scene as unknown as AnyScene;
  const doc = s.doc.get<PagesDoc>(PAGES_DOC_KEY);
  if (doc === undefined || pageRunOf(s) !== null) return false;
  const descriptor = options.descriptor ?? (RECT_POSE_DESCRIPTOR as PoseDescriptor<unknown>);
  const going = destinations(s, doc, descriptor);
  // Two passes: the run lays the pages out as its edit closes, and only then can a root be rebased into one.
  const run = s.untracked(() => createPageRun(s, doc.pages, doc.layout));
  s.untracked(() => s.batch('Adopt pages', () => {
    moveIn(s, going, run);
    s.doc.set(PAGES_DOC_KEY, undefined);
  }));
  return true;
}

/** Move each root into its page, or into `run` when it has none, keeping where its subtree is in the world. */
function moveIn(s: AnyScene, going: ReadonlyMap<NodeId, string | null>, run: NodeId): void {
  const poses = scenePoseAdapter(s);
  const { compose, decompose } = s.composition;
  for (const [root, page] of going) {
    const subtree = treePreorder([root], s.nodes).map((n) => n.id);
    const world = new Map(subtree.map((id) => [id, composeWorldPose(poses, id, compose)]));
    s.move(root, (page ?? run) as NodeId);
    for (const id of subtree) {
      const local = rebaseLocalPose(poses, world.get(id), s.get(id)!.parent, compose, decompose);
      if (!sameValue(local, s.get(id)!.pose)) s.setPose(id, local);
    }
  }
}
