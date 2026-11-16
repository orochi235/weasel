/**
 * The container stencils a palette offers, what one becomes when it is drawn,
 * and the edits on one: adding a lane to a pool, and releasing a container's
 * members.
 */
import { RIGID_POSE_COMPOSITION, createInsertOp, localizeWorldPoses, reachesLocked, scenePoseFrame, type NodeId, type Op, type PoseComposition, type RectPose, type AnyScene } from '@weasel-js/core';
import type { IconSpec } from '@weasel-js/icons';
import type { NodeStyle } from '../dataTypes';
import { diagramThemeOf } from '../theme/resolve';
import { themeWrites, type ThemedScene } from '../theme/themeWrites';
import { DIAGRAM_THEME_KEY } from '../theme/types';
import { firstLanes, regionSpecs, type ContainerBuildOptions } from './regionSpecs';
import { diagramContainerOf, titleIdOf, type DiagramContainer } from './trait';
import type { Rect } from '@weasel-js/geom';

export type { ContainerBuildOptions };

/** One container a palette offers. A pool stacks its lanes along `axis`. */
export interface ContainerStencil {
  id: string;
  label: string;
  /** Its tool's presentation `description`: what a palette's tooltip reads. */
  description?: string;
  role: 'container' | 'pool';
  axis?: 'x' | 'y';
  size: { width: number; height: number };
  /** The glyph a palette draws on its button. */
  icon?: IconSpec;
  /** The title a new one is drawn with. Default `label`, and `'Pool'` for a pool. */
  title?: string;
  /** A new pool's lanes, by title, in the order they stack. Default two, `Lane 1` and `Lane 2`. */
  lanes?: readonly string[];
}

export { CONTAINER_STENCILS } from '../stencils/containers';

/** A lane added to a pool, along its stack. */
const NEW_LANE_SIZE = 120;

/** A zero-size box — a click rather than a drag — becomes the stencil's own size centered on it. */
function placedBounds(stencil: ContainerStencil, b: Rect): RectPose {
  if (b.width > 0 && b.height > 0) return { ...b };
  const { width, height } = stencil.size;
  return { x: b.x + b.width / 2 - width / 2, y: b.y + b.height / 2 - height / 2, width, height };
}

/** The ops that insert `stencil` at `bounds`: the region and its title, and a
 *  pool's first lanes. Applied as one batch, they are one undo entry. */
export function containerBuild<TLayer extends string>(
  stencil: ContainerStencil,
  bounds: Rect,
  opts: ContainerBuildOptions<TLayer>,
): { id: string; ops: Op[] } {
  const id = opts.newId();
  const axis = stencil.axis ?? 'y';
  const at = placedBounds(stencil, bounds);
  const title = stencil.title ?? (stencil.role === 'pool' ? 'Pool' : stencil.label);
  const style = stencil.role === 'pool' && opts.laneStyles ? opts.laneStyles.header : opts.style;
  const specs = [
    ...regionSpecs(stencil.role, axis, at, title, {
      id, layer: opts.layer, parent: opts.parent ?? null, ...(style ? { style } : {}),
    }),
    ...(stencil.role === 'pool' ? firstLanes(id, axis, at, opts, stencil.lanes) : []),
  ];
  const label = `Insert ${stencil.label}`;
  // Built in one frame; each lane and title is stored in its container's.
  const stored = localizeWorldPoses(specs, RIGID_POSE_COMPOSITION);
  return { id, ops: stored.map((node) => createInsertOp({ node, label })) };
}

/** The axis a pool stacks its lanes along, read off its header. */
export const poolAxisOf = (pool: DiagramContainer): 'x' | 'y' => (pool.header?.side === 'top' ? 'x' : 'y');

/** The lanes of `poolId`, in the order they stack. */
export function lanesOf(scene: AnyScene, poolId: string): NodeId[] {
  const pool = scene.get(poolId as NodeId);
  const trait = pool === undefined ? null : diagramContainerOf(pool);
  if (pool === undefined || trait?.role !== 'pool') return [];
  const axis = poolAxisOf(trait);
  const start = (id: NodeId) => {
    const p = scene.get(id)!.pose as RectPose;
    return axis === 'y' ? p.y : p.x;
  };
  return scene.childrenOf(pool.id)
    .filter((id) => diagramContainerOf(scene.get(id)!)?.role === 'lane')
    .sort((a, b) => start(a) - start(b));
}

/**
 * Add a lane to `poolId` before the lane at `index`, or at the end of the
 * stack, as one history entry. The pool grows to hold it. Returns the new
 * lane's id, or null when `poolId` is not a pool.
 */
export function addLane(scene: AnyScene, poolId: string, index?: number, style?: NodeStyle): string | null {
  const pool = scene.get(poolId as NodeId);
  const trait = pool === undefined ? null : diagramContainerOf(pool);
  if (pool === undefined || trait?.role !== 'pool') return null;
  const axis = poolAxisOf(trait);
  const lanes = lanesOf(scene, poolId);
  // In the pool's own frame, where its lanes are stored.
  const { width, height } = pool.pose as RectPose;
  const b: RectPose = { x: 0, y: 0, width, height };
  const at = index === undefined || index >= lanes.length ? null : scene.get(lanes[index]!)!.pose as RectPose;
  const boundary = at !== null ? (axis === 'y' ? at.y : at.x) : axis === 'y' ? b.y + b.height : b.x + b.width;
  // Centered on the boundary it goes in at: the stack orders lanes by where they sit.
  const start = boundary - NEW_LANE_SIZE / 2;
  const offset = trait.header?.size ?? 0;
  const pose: RectPose = axis === 'y'
    ? { x: b.x + offset, y: start, width: b.width - offset, height: NEW_LANE_SIZE }
    : { x: start, y: b.y + offset, width: NEW_LANE_SIZE, height: b.height - offset };
  const id = scene.mintId() as string;
  const specs = localizeWorldPoses(regionSpecs('lane', axis, pose, `Lane ${lanes.length + 1}`, {
    id, layer: pool.layer, parent: poolId, ...(style ? { style } : {}),
  }), scene.composition as PoseComposition<RectPose>);
  scene.batch('Add lane', () => {
    for (const spec of specs) scene.add(spec as never);
    // A themed scene colors the lane as a theme change would, by its place in the stack.
    if (style === undefined && scene.doc.get(DIAGRAM_THEME_KEY) !== undefined) {
      const writes = themeWrites(scene as unknown as ThemedScene, diagramThemeOf(scene), new Set([id]));
      for (const [at, data] of writes) scene.update(at as never, { data } as never);
    }
  });
  return id;
}

/** The node a release lands members beside: `id`, or the pool around a lane. */
function releasedFrom(scene: AnyScene, id: NodeId): NodeId {
  const parent = scene.get(id)!.parent;
  const around = parent === null ? undefined : scene.get(parent);
  return around !== undefined && diagramContainerOf(around)?.role === 'pool' ? around.id : id;
}

/** What releasing container `id` writes: each member, moved to `parent` at `index` on, stored at its `locals`.
 *  Null when there is nothing to release: `id` is no container, the release would write a locked node, or a
 *  member would land in a singular frame and could not keep its place. */
function releasePlan(scene: AnyScene, id: string) {
  const node = scene.get(id as NodeId);
  const trait = node === undefined ? null : diagramContainerOf(node);
  if (node === undefined || trait === null || reachesLocked(scene as never, [node.id])) return null;
  const membersOf = (c: NodeId) => scene.childrenOf(c).filter((m) => m !== titleIdOf(c as string));
  const members = trait.role === 'pool' ? membersOf(node.id).flatMap(membersOf) : membersOf(node.id);
  const beside = releasedFrom(scene, node.id);
  // A lane's pool restacks the lanes left: it, its title and they are written too.
  const restacked = beside === node.id ? [] : [beside, titleIdOf(beside), ...membersOf(beside)];
  if (restacked.some((id) => scene.isLocked(id as NodeId))) return null;
  const parent = scene.get(beside)!.parent;
  const index = (parent === null ? scene.roots : scene.childrenOf(parent)).indexOf(beside);
  // Read where each draws before the first move: it is stored in a frame that is about to go.
  const frame = scenePoseFrame(scene);
  const locals = members.map((m) => frame.localUnder(parent, frame.world(m)));
  if (locals.some((p) => p === null)) return null;
  return { id: node.id, members, parent, index, locals };
}

/** Whether {@link releaseMembers} would change anything for `id`. */
export function canReleaseMembers(scene: AnyScene, id: string): boolean {
  return releasePlan(scene, id) !== null;
}

/**
 * Remove container `id` and keep its members, which take its place in its
 * parent, as one history entry. A pool's members are its lanes' members, and
 * a lane's go past its pool. Connectors on what is removed go with it.
 * Nothing changes when that parent's frame is singular, where the members
 * could not keep their places, or when the release would write a locked node.
 */
export function releaseMembers(scene: AnyScene, id: string): void {
  const plan = releasePlan(scene, id);
  if (plan === null) return;
  const { members, parent, index, locals } = plan;
  scene.batch('Release members', () => {
    members.forEach((m, k) => {
      scene.move(m, parent, index + k);
      scene.setPose(m, locals[k]);
    });
    scene.remove(plan.id);
  });
}
