import type { Scene, NodeId } from 'core/scene/types';
import type { CanDropIntoDep } from 'interactions/actions/layoutDeps';
import { insertParent } from 'interactions/actions/insert/parent';
import { composeChildFrame, composesFrames, type PoseAdapter } from 'core/scene/composeFrame';
import { viewPoseAdapter } from 'core/scene/scrollOffsets';
import { definesFrame } from 'core/scene/effectivePose';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { keepOnPage, pasteboardOn, placedPage } from 'core/pages/pagePlacement';
import type { PlacedPage } from 'core/pages/pages';

/** Where a new node lands: its parent, its layer, and how a world pose becomes its stored one. */
export interface InsertSite {
  parent: NodeId | null;
  layer: string;
  local: (world: unknown) => unknown;
}

type SiteScene = Scene<unknown, string, unknown>;

/**
 * A new node under `parentId`: on that container's layer, with the pose made
 * local to it when the scene composes frames — through its scroll offset,
 * since the world pose is where the view shows it — or at the top of the
 * tree, on the first layer, for `null`.
 */
export function siteIn(sc: SiteScene, parentId: NodeId | null): InsertSite {
  if (parentId === null) {
    return { parent: null, layer: (sc.layers[0]?.id ?? 'default') as string, local: (p) => p };
  }
  const parent = sc.get(parentId)!;
  const composition = sc.composition;
  if (composition === undefined || !composesFrames(composition)) {
    return { parent: parent.id, layer: parent.layer, local: (p) => p };
  }
  const frame = composeChildFrame(viewPoseAdapter(sc, {
    getPose: (id) => sc.get(id as NodeId)!.pose,
    getParent: (id) => sc.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => definesFrame(sc.get(id as NodeId) ?? {}),
  } as PoseAdapter<unknown>), parent.id, composition.compose);
  return { parent: parent.id, layer: parent.layer, local: (p) => composition.decompose(frame, p) };
}

/** `world` shifted by {@link keepOnPage}, so part of it is on `page`. */
function ontoPage(page: PlacedPage, world: unknown): unknown {
  const { dx, dy } = keepOnPage(page, AUTO_POSE_DESCRIPTOR.getBounds(world));
  return dx === 0 && dy === 0 ? world : AUTO_POSE_DESCRIPTOR.translate!(world, dx, dy);
}

/** What {@link insertSite} places by. */
export interface InsertSiteOptions {
  /** The world point the insert is made at, which picks its page in a paged scene. */
  at?: { x: number; y: number };
  /** The container the insert is asked into, as the `insertInto` dep names it. */
  into?: string | null;
  /** The `canDropInto` dep, which may refuse `into`. */
  canDropInto?: CanDropIntoDep;
}

/**
 * Where an insert lands ({@link siteIn}): the container `into` names, when it
 * admits the insert; else, in a paged scene, the page for `at`
 * (`insertParent`); else the top of the tree. A node landing on a page with
 * the pasteboard off is moved so part of it is on the page.
 */
export function insertSite(sc: SiteScene, { at, into, canDropInto }: InsertSiteOptions = {}): InsertSite {
  const site = siteIn(sc, insertParent(sc, into, canDropInto, at));
  const page = site.parent === null || pasteboardOn(sc) ? null : placedPage(sc, site.parent);
  return page === null ? site : { ...site, local: (p) => site.local(ontoPage(page, p)) };
}
