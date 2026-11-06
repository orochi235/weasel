import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { isFollower, keepOnPage, pasteboardOn, placedPage, rehomedFollowers } from 'core/pages/pagePlacement';
import { pageAt, pageOfBounds, type PlacedPage } from 'core/pages/pages';
import { pageNodeOf, pageOfNode, placedPagesOf } from 'core/pages/pageNodes';
import { followerMove, followerMoveOps } from '../../followerMoves';
import { refusalOf } from '../../dropVerdict';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import type { MoveSession } from '../session';
import { rootTranslateOps, translateOps } from '../translate';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import { landAbove, landedCascadeOps, landedLocalPose, landOps, resolveDrop } from './reparent';

/** What a release does with one dragged root: add `shift` to the drag and, when `into` is given, move it into
 *  that container (a page, a group on one, or `null` for the top of the tree), just above `above` and onto
 *  `layer` when given. */
interface RootDrop {
  readonly into?: NodeId | null;
  readonly above?: NodeId | null;
  readonly layer?: string;
  readonly shift: { readonly dx: number; readonly dy: number };
}

const STAY: RootDrop = { shift: { dx: 0, dy: 0 } };

/** The node a release over `under` drops into on that page when the binding reparents on drop: a group on
 *  it under the pointer (`resolveDrop`), on the layer that drop gives, else `under` itself; and, when the
 *  binding lands above the node hit, that node. `'refused'` when that drop is refused. */
function containerOn(
  session: MoveSession,
  under: PlacedPage,
  at: { x: number; y: number },
): { into: NodeId; above: NodeId | null; layer?: string } | 'refused' {
  const page = pageNodeOf(session.scene, under.id)!;
  const mode = session.reparentOnDrop();
  if (mode === 'off') return { into: page, above: null };
  const drop = resolveDrop(session, at);
  if (drop !== null && 'refused' in drop) return 'refused';
  const inner = drop?.newParent ?? null;
  const above = mode === 'above' ? drop?.hitSibling ?? null : null;
  return inner !== null && pageOfNode(session.scene, inner) === under.id
    ? { into: inner, above, layer: drop!.newLayer }
    : { into: page, above: null };
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
    const verdict = session.verdict(pageNodeOf(scene, under.id)!);
    if (refusalOf(verdict) !== null) return 'refused';
    if (verdict !== true) under = null;
  }
  const site = under === null ? null : containerOn(session, under, at);
  if (site === 'refused') return 'refused';

  const adapter = grabbedPoseAdapter(session, sceneViewPoseAdapter(scene));
  const drops = new Map<NodeId, RootDrop>();
  for (const id of ours) {
    const parent = scene.get(id)!.parent;
    const from = parent === null ? null : pageOfNode(scene, parent);
    const bounds = session.descriptorOf(id).getBounds(draggedWorldPose(session, adapter, id, delta));
    const takers = placed.filter((p) => p.id === from || session.verdict(pageNodeOf(scene, p.id)!) === true);
    const page = under !== null && pageOfBounds([under], bounds) !== null ? under : pageOfBounds(takers, bounds);
    let target: NodeId | null = page === null ? null : page === under ? site!.into : pageNodeOf(scene, page.id);
    let landing = page;
    if (page === null && !pasteboard) {
      target = parent;
      landing = placedPage(scene, from!);
    }
    const shift = landing !== null && !pasteboard ? keepOnPage(landing, bounds) : STAY.shift;
    const landsInSite = page !== null && page === under;
    const above = landsInSite ? site!.above : null;
    const layer = landsInSite ? site!.layer : undefined;
    if (target !== parent) drops.set(id, { into: target, shift, above, ...(layer === undefined ? {} : { layer }) });
    else if (shift.dx !== 0 || shift.dy !== 0) drops.set(id, { shift });
  }
  const landed = new Map<string, string | null>();
  for (const [id, { into }] of drops) {
    if (into !== undefined) landed.set(id, into === null ? null : pageOfNode(scene, into));
  }
  for (const [id, into] of rehomedFollowers(scene, landed)) drops.set(id, { into, shift: STAY.shift });
  return drops.size === 0 ? null : drops;
}

/** Each dragged node below one of `roots`, selected or not, keyed by that root. */
function belowRoots(session: MoveSession, roots: ReadonlySet<NodeId>): Map<NodeId, NodeId[]> {
  const out = new Map<NodeId, NodeId[]>();
  for (const id of new Set([...session.ids, ...session.cascadeIds])) {
    let cur = session.scene.get(id)?.parent ?? null;
    while (cur !== null && !roots.has(cur)) cur = session.scene.get(cur)?.parent ?? null;
    if (cur !== null) out.set(cur, [...(out.get(cur) ?? []), id]);
  }
  return out;
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
  const children = new Map<NodeId | null, NodeId[]>();
  const childrenOf = (parent: NodeId | null) => {
    if (!children.has(parent)) children.set(parent, [...(parent === null ? scene.roots : scene.childrenOf(parent))]);
    return children.get(parent)!;
  };
  for (const [id, drop] of drops) {
    if (!dragged.has(id) && drop.into !== undefined) ops.push(...followerMoveOps([followerMove(scene, id, drop.into)], label));
  }
  const below = belowRoots(session, new Set([...drops.keys()].filter((id) => dragged.has(id))));
  const ridden = new Set([...below.values()].flat());
  for (const id of session.ids) {
    if (ridden.has(id)) continue;
    const drop = drops.get(id) ?? STAY;
    const d = { dx: delta.dx + drop.shift.dx, dy: delta.dy + drop.shift.dy };
    if (drop.into === undefined) {
      ops.push(...(drops.has(id) ? translateOps(session, [id, ...below.get(id) ?? []], d) : rootTranslateOps(session, [id], d)));
      continue;
    }
    const node = scene.get(id)!;
    const layer = drop.layer ?? node.layer;
    const toIndex = landAbove(childrenOf(drop.into), id, drop.above ?? null);
    ops.push(...landOps(session, id, drop.into, toIndex, layer));
    ops.push(createTransformOp<unknown>({
      id: id as string, from: node.pose, to: landedLocalPose(session, id, drop.into, layer, d), label,
    }));
    ops.push(...landedCascadeOps(session, below.get(id) ?? [], drop.into, d, layer));
  }
  return ops;
}
