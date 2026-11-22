/**
 * The container stencils a palette offers, what one becomes when it is drawn,
 * and the edits on one: adding a lane to a pool, and releasing a container's
 * members.
 */
import {
  RIGID_POSE_COMPOSITION, composesFrames, localizeInScene, localizeWorldPoses, reachesLocked, scenePoseFrame, type NodeId, type Op, type RectPose,
  type AnyScene,
} from '@weasel-js/core';
import type { IconSpec } from '@weasel-js/icons';
import type { NodeStyle } from '../dataTypes';
import { diagramThemeOf } from '../theme/resolve';
import { themeWrites, type ThemedScene } from '../theme/themeWrites';
import { DIAGRAM_THEME_KEY } from '../theme/types';
import { laneMiddle, poolHeader, regionAxisOf, stackedLanes } from './laneStack';
import { firstLanes, regionSpecs, type ContainerBuildOptions } from './regionSpecs';
import { bodyBox, diagramContainerOf, titleIdOf, type DiagramContainer } from './trait';
import { EPS, type Rect } from '@weasel-js/geom';
import * as ops from '@weasel-js/core/ops';

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
  const stored = localizeWorldPoses(specs, opts.composition ?? RIGID_POSE_COMPOSITION);
  return { id, ops: stored.map((node) => ops.insert({ node, label })) };
}

/** The axis a pool stacks its lanes along: its layout's, else its header's, else rows. Pass the pool's node; a bare
 *  trait is read by its header alone. */
export const poolAxisOf = (pool: DiagramContainer | { data: unknown; layout?: unknown }): 'x' | 'y' =>
  ('data' in pool ? regionAxisOf(pool) : pool.header === undefined ? undefined : pool.header.side === 'top' ? 'x' : 'y') ?? 'y';

/** The lanes of `poolId`, in the order they stack. */
export function lanesOf(scene: AnyScene, poolId: string): NodeId[] {
  const pool = scene.get(poolId as NodeId);
  const trait = pool === undefined ? null : diagramContainerOf(pool);
  if (pool === undefined || trait?.role !== 'pool') return [];
  const axis = poolAxisOf(pool);
  const mid = (id: NodeId) => laneMiddle(axis, scene.get(id)!.pose as RectPose);
  return scene.childrenOf(pool.id)
    .filter((id) => diagramContainerOf(scene.get(id)!)?.role === 'lane')
    .sort((a, b) => mid(a) - mid(b));
}

/** Pool `pool`'s own box, where its layout lays its lanes out: the box in world, the box at the origin, and where a
 *  node draws in it. Upright where poses do not compose. */
function poolBox(scene: AnyScene, pool: { id: NodeId; pose: unknown }) {
  const frame = scenePoseFrame(scene);
  const world = frame.world(pool.id) as RectPose;
  const box = composesFrames(scene.composition) ? world : { x: world.x, y: world.y, width: world.width, height: world.height };
  const { width, height } = pool.pose as RectPose;
  const local: RectPose = { x: 0, y: 0, width, height };
  const inBox = (id: NodeId) => RIGID_POSE_COMPOSITION.decompose(box, frame.world(id) as RectPose);
  return { box, local, inBox };
}

/** Whether restacking pool `poolId` would write a locked node: the pool, its title, a lane of `kept` (which lead the
 *  stack) not already where the stack puts it, or a lane of `moved` or anything one of those holds. */
function restackLocked(scene: AnyScene, poolId: NodeId, kept: readonly NodeId[], moved: readonly NodeId[]): boolean {
  const pool = scene.get(poolId);
  const trait = pool === undefined ? null : diagramContainerOf(pool);
  if (pool === undefined || trait === null) return false;
  if ([poolId, titleIdOf(poolId)].some((id) => scene.isLocked(id as NodeId))) return true;
  const axis = poolAxisOf(pool);
  const { box, local, inBox } = poolBox(scene, pool);
  const at = kept.map(inBox);
  // A lane's place in the pool is read back through its world pose, so it carries rounding as large as the pool's.
  const scale = Math.max(1, Math.abs(box.x) + box.width, Math.abs(box.y) + box.height);
  const near = (a: number, b: number) => Math.abs(a - b) <= EPS * scale;
  const sizes = kept.map((id, k) => ({ id: id as string, size: (axis === 'y' ? at[k]?.height : at[k]?.width) ?? 0 }));
  const stacked = stackedLanes(axis, local, trait.header ?? poolHeader(axis), sizes);
  const shifted = kept.filter((id, k) => {
    const p = at[k];
    const to = stacked.get(id)!;
    return p == null || !near(p.x, to.x) || !near(p.y, to.y) || !near(p.width, to.width) || !near(p.height, to.height);
  });
  return reachesLocked(scene as never, [...shifted, ...moved]);
}

/** Whether {@link addLane} at `index` would write a locked node, and so writes nothing. */
export function addLaneLocked(scene: AnyScene, poolId: string, index?: number): boolean {
  const lanes = lanesOf(scene, poolId);
  const at = index === undefined ? lanes.length : Math.min(index, lanes.length);
  return restackLocked(scene, poolId as NodeId, lanes.slice(0, at), lanes.slice(at));
}

/**
 * Add a lane to `poolId` before the lane at `index`, or at the end of the
 * stack when `index` is absent or past the last lane, as one history entry.
 * The pool grows to hold it. Returns the new lane's id, or null, changing
 * nothing, when `poolId` is not a pool or the add would move or restyle a
 * locked node. Throws a `RangeError` for a negative or fractional `index`.
 */
export function addLane(scene: AnyScene, poolId: string, index?: number, style?: NodeStyle): string | null {
  const pool = scene.get(poolId as NodeId);
  const trait = pool === undefined ? null : diagramContainerOf(pool);
  if (pool === undefined || trait?.role !== 'pool') return null;
  if (index !== undefined && !(Number.isInteger(index) && index >= 0)) {
    throw new RangeError(`addLane: index ${index} is not a lane's place; pass a whole number from 0, or none for the end`);
  }
  if (addLaneLocked(scene, poolId, index)) return null;
  const axis = poolAxisOf(pool);
  const lanes = lanesOf(scene, poolId);
  // Laid out in the pool's own box, where a layout sees it.
  const { box, local: b, inBox } = poolBox(scene, pool);
  const at = index === undefined || index >= lanes.length ? null : inBox(lanes[index]!);
  const boundary = at !== null ? (axis === 'y' ? at.y : at.x) : axis === 'y' ? b.y + b.height : b.x + b.width;
  // Centered on the boundary it goes in at: the stack orders lanes by where they sit.
  const start = boundary - NEW_LANE_SIZE / 2;
  const body = bodyBox(b, trait.header ?? poolHeader(axis));
  const pose: RectPose = axis === 'y'
    ? { x: body.x, y: start, width: body.width, height: NEW_LANE_SIZE }
    : { x: start, y: body.y, width: NEW_LANE_SIZE, height: body.height };
  const id = scene.mintId() as string;
  const specs = localizeInScene(scene, regionSpecs('lane', axis, pose, `Lane ${lanes.length + 1}`, {
    id, layer: pool.layer, parent: poolId, ...(style ? { style } : {}),
  }).map((spec) => ({ ...spec, pose: RIGID_POSE_COMPOSITION.compose(box, spec.pose) })));
  scene.batch('Add lane', () => {
    for (const spec of specs) scene.add(spec as never);
    // A themed scene colors the lanes as a theme change would, by their places in the stack: those after the new
    // one, which it moved along one, and the new one unless it was given a style.
    if (scene.doc.get(DIAGRAM_THEME_KEY) !== undefined) {
      const moved = index === undefined ? [] : lanes.slice(index);
      const writes = themeWrites(scene as unknown as ThemedScene, diagramThemeOf(scene), new Set(style === undefined ? [id, ...moved] : moved));
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
  const isLane = (m: NodeId) => diagramContainerOf(scene.get(m)!)?.role === 'lane';
  const members = trait.role === 'pool' ? membersOf(node.id).flatMap((m) => (isLane(m) ? membersOf(m) : [m])) : membersOf(node.id);
  const beside = releasedFrom(scene, node.id);
  // A lane's pool restacks the lanes left: it, its title, and each lane it moves are written too.
  if (beside !== node.id) {
    const lanes = lanesOf(scene, beside);
    const at = lanes.indexOf(node.id);
    if (restackLocked(scene, beside, lanes.slice(0, at), lanes.slice(at + 1))) return null;
  }
  const parent = scene.get(beside)!.parent;
  // A lane's members go just past the pool, which stays and would draw over them; a container's take its place.
  const index = (parent === null ? scene.roots : scene.childrenOf(parent)).indexOf(beside) + (beside === node.id ? 0 : 1);
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
 * parent, as one history entry. A pool's members are its lanes' members and
 * anything else it holds, and a lane's go past its pool. Connectors on what is removed go with it.
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
