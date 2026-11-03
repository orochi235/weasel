import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { isFollower, keepOnPage, pasteboardOn, placedPage } from 'core/pages/pagePlacement';
import { pageAt } from 'core/pages/pages';
import { placedPagesOf } from 'core/pages/pageNodes';
import { refusalOf } from '../../dropVerdict';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import type { MoveSession } from '../session';
import { rootTranslateOps, translateOps, unreleasedIds } from '../translate';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import { landedLocalPose } from './reparent';

/** What a release does with one dragged root: move it into `into` (a page, or `null` for the top of the
 *  tree), or keep its parent and add `shift` to the drag. */
type RootDrop = { into: NodeId | null } | { shift: { dx: number; dy: number } };

const STAY: RootDrop = { shift: { dx: 0, dy: 0 } };

/**
 * Where a release at `at` puts each dragged root that is a page's child or,
 * with the pasteboard on, a root of the scene: into the page under the
 * point; off every page, to the top of the tree with the pasteboard on, and
 * otherwise kept in its page, shifted so part of it is still on it. A page
 * that refuses the roots counts as no page, and one that refuses with a
 * reason refuses the move (`'refused'`). `null` when no root is either kind,
 * or none of them changes parent or shifts.
 */
export function pageDrops(
  session: MoveSession,
  at: { x: number; y: number },
  delta: { dx: number; dy: number },
): Map<NodeId, RootDrop> | 'refused' | null {
  const { scene } = session;
  const pasteboard = pasteboardOn(scene);
  const isPage = (id: NodeId | null) => id !== null && scene.get(id)?.page !== undefined;
  const ours = session.ids.filter((id) => {
    const node = scene.get(id);
    if (!session.startPoses.has(id) || node === undefined) return false;
    return isPage(node.parent) || (pasteboard && node.parent === null && !isFollower(node));
  });
  if (ours.length === 0) return null;

  let under = pageAt(placedPagesOf(scene), at)?.id as NodeId | undefined;
  if (under !== undefined) {
    const verdict = session.verdict(under);
    if (refusalOf(verdict) !== null) return 'refused';
    if (verdict !== true) under = undefined;
  }
  const adapter = grabbedPoseAdapter(session, sceneViewPoseAdapter(scene));
  const drops = new Map<NodeId, RootDrop>();
  for (const id of ours) {
    const parent = scene.get(id)!.parent;
    if (under !== undefined) {
      if (under !== parent) drops.set(id, { into: under });
    } else if (pasteboard) {
      if (parent !== null) drops.set(id, { into: null });
    } else {
      const page = placedPage(scene, parent!)!;
      const shift = keepOnPage(page, session.descriptorOf(id).getBounds(draggedWorldPose(session, adapter, id, delta)));
      if (shift.dx !== 0 || shift.dy !== 0) drops.set(id, { shift });
    }
  }
  return drops.size === 0 ? null : drops;
}

/** The commit for `drops`: each root moved into its page or the top of the tree at the world place the drag
 *  showed, with its descendants; each shifted root and every other dragged root translated. */
export function pageDropOps(
  session: MoveSession,
  drops: ReadonlyMap<NodeId, RootDrop>,
  delta: { dx: number; dy: number },
): Op[] {
  const { scene } = session;
  const label = session.lifecycle.label;
  const ops: Op[] = [];
  const crossing = new Set<NodeId>();
  for (const [id, drop] of drops) {
    if (!('into' in drop)) continue;
    const node = scene.get(id)!;
    crossing.add(id);
    ops.push(createReparentOp({ id: id as string, fromParentId: node.parent, toParentId: drop.into as string | null, label }));
    ops.push(createTransformOp<unknown>({
      id: id as string, from: node.pose, to: landedLocalPose(session, id, drop.into, node.layer, delta), label,
    }));
  }
  const rest = new Set(session.ids.filter((id) => !crossing.has(id)));
  const carried = unreleasedIds(session, rest).filter((id) => !crossing.has(id));
  ops.push(...translateOps(session, carried, delta));
  for (const id of rest) {
    const { shift } = (drops.get(id) ?? STAY) as { shift: { dx: number; dy: number } };
    ops.push(...rootTranslateOps(session, [id], { dx: delta.dx + shift.dx, dy: delta.dy + shift.dy }));
  }
  return ops;
}
