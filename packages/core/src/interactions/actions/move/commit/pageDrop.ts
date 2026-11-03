import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { followerHome, isFollower, keepOnPage, pasteboardOn, placedPage } from 'core/pages/pagePlacement';
import { pageAt, pageOfBounds, type PlacedPage } from 'core/pages/pages';
import { pageOfNode, pageRunOf, placedPagesOf } from 'core/pages/pageNodes';
import { composeWorldPose, rebaseLocalPose } from 'core/scene/composePose';
import { refusalOf } from '../../dropVerdict';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import type { MoveSession } from '../session';
import { rootTranslateOps, translateOps, unreleasedIds } from '../translate';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import { landedLocalPose, resolveDrop } from './reparent';

/** What a release does with one dragged root: add `shift` to the drag and, when `into` is given, move it into
 *  that container (a page, a group on one, or `null` for the top of the tree). */
interface RootDrop {
  readonly into?: NodeId | null;
  readonly shift: { readonly dx: number; readonly dy: number };
}

const STAY: RootDrop = { shift: { dx: 0, dy: 0 } };

/** The node a release over `under` drops into on that page when the binding reparents on drop: a group on
 *  it under the pointer (`resolveDrop`), else `under` itself. `'refused'` when that drop is refused. */
function containerOn(session: MoveSession, under: PlacedPage, at: { x: number; y: number }): NodeId | 'refused' {
  if (session.reparentOnDrop() === 'off') return under.id as NodeId;
  const drop = resolveDrop(session, at);
  if (drop !== null && 'refused' in drop) return 'refused';
  const inner = drop?.newParent ?? null;
  return inner !== null && pageOfNode(session.scene, inner) === under.id ? inner : under.id as NodeId;
}

/**
 * Where a release at `at` puts each dragged root that is a page's child or,
 * with the pasteboard on, a root of the scene. Each root goes by where its own
 * dragged box lands: on the page under the pointer when it overlaps that page
 * (into a group there under the pointer, when the binding reparents on drop),
 * else on the page it overlaps most. Off every page it goes to the top of the
 * tree with the pasteboard on, and otherwise stays in its page. With the
 * pasteboard off, each root ending on a page is shifted so part of it is on
 * it. A page that refuses the roots silently is not landed on; a refusal with
 * a reason refuses the move (`'refused'`). `null` when no root is either kind,
 * or none changes parent or shifts.
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
    return !isFollower(node) && (isPage(node.parent) || (pasteboard && node.parent === null));
  });
  if (ours.length === 0) return null;

  const placed = placedPagesOf(scene);
  let under = pageAt(placed, at);
  if (under !== null) {
    const verdict = session.verdict(under.id as NodeId);
    if (refusalOf(verdict) !== null) return 'refused';
    if (verdict !== true) under = null;
  }
  const into = under === null ? null : containerOn(session, under, at);
  if (into === 'refused') return 'refused';

  const adapter = grabbedPoseAdapter(session, sceneViewPoseAdapter(scene));
  const drops = new Map<NodeId, RootDrop>();
  for (const id of ours) {
    const parent = scene.get(id)!.parent;
    const bounds = session.descriptorOf(id).getBounds(draggedWorldPose(session, adapter, id, delta));
    const takers = placed.filter((p) => p.id === parent || session.verdict(p.id as NodeId) === true);
    const page = under !== null && pageOfBounds([under], bounds) !== null ? under : pageOfBounds(takers, bounds);
    let target: NodeId | null = page === null ? null : page === under ? into : page.id as NodeId;
    let landing = page;
    if (page === null && !pasteboard) {
      target = parent;
      landing = placedPage(scene, parent!);
    }
    const shift = landing !== null && !pasteboard ? keepOnPage(landing, bounds) : STAY.shift;
    if (target !== parent) drops.set(id, { into: target, shift });
    else if (shift.dx !== 0 || shift.dy !== 0) drops.set(id, { shift });
  }
  rehomeFollowers(session, drops);
  return drops.size === 0 ? null : drops;
}

/** Add to `drops` each follower on a page or in the run whose home (`followerHome`) the drops change: it
 *  goes to the page everything it follows lands on, else into the run. */
function rehomeFollowers(session: MoveSession, drops: Map<NodeId, RootDrop>): void {
  const { scene } = session;
  const run = pageRunOf(scene);
  if (run === null || ![...drops.values()].some((d) => d.into !== undefined)) return;
  const pageOf = (dep: NodeId) => {
    for (let at: NodeId | null | undefined = dep; at != null; at = scene.get(at)?.parent) {
      const into = drops.get(at)?.into;
      if (into !== undefined) return into === null ? null : pageOfNode(scene, into);
    }
    return pageOfNode(scene, dep);
  };
  const tops = [run, ...scene.childrenOf(run).filter((id) => scene.get(id)?.page !== undefined)];
  for (const id of tops.flatMap((top) => scene.childrenOf(top))) {
    const node = scene.get(id)!;
    const home = followerHome(scene, node, pageOf);
    if (home !== null && home !== node.parent) drops.set(id, { into: home, shift: STAY.shift });
  }
}

/** A follower the drag did not take moved into `into` at the world place it has. */
function followOps(session: MoveSession, id: NodeId, into: NodeId | null, label: string | undefined): Op[] {
  const { scene, pc } = session;
  const node = scene.get(id)!;
  const adapter = sceneViewPoseAdapter(scene);
  const world = composeWorldPose(adapter, id as string, pc.compose);
  return [
    createReparentOp({ id: id as string, fromParentId: node.parent, toParentId: into as string | null, label }),
    createTransformOp<unknown>({
      id: id as string, from: node.pose, to: rebaseLocalPose(adapter, world, into as string | null, pc.compose, pc.decompose), label,
    }),
  ];
}

/** `id`'s descendants that the drag carries along with it, but not `id`. */
function cascadeOf(session: MoveSession, id: NodeId): NodeId[] {
  return unreleasedIds(session, new Set(session.ids.filter((other) => other !== id))).filter((d) => d !== id);
}

/** The commit for `drops`: each dragged root translated by the drag plus its shift, and moved into its new
 *  container at the world place that gives, its descendants with it. */
export function pageDropOps(
  session: MoveSession,
  drops: ReadonlyMap<NodeId, RootDrop>,
  delta: { dx: number; dy: number },
): Op[] {
  const { scene } = session;
  const label = session.lifecycle.label;
  const ops: Op[] = [];
  const dragged = new Set(session.ids);
  for (const [id, drop] of drops) {
    if (!dragged.has(id) && drop.into !== undefined) ops.push(...followOps(session, id, drop.into, label));
  }
  for (const id of session.ids) {
    const drop = drops.get(id) ?? STAY;
    const d = { dx: delta.dx + drop.shift.dx, dy: delta.dy + drop.shift.dy };
    if (drop.into === undefined) {
      ops.push(...rootTranslateOps(session, [id], d));
      continue;
    }
    const node = scene.get(id)!;
    ops.push(createReparentOp({ id: id as string, fromParentId: node.parent, toParentId: drop.into as string | null, label }));
    ops.push(createTransformOp<unknown>({
      id: id as string, from: node.pose, to: landedLocalPose(session, id, drop.into, node.layer, d), label,
    }));
    ops.push(...translateOps(session, cascadeOf(session, id), d));
  }
  return ops;
}
