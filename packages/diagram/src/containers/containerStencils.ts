/**
 * The container stencils a palette offers, what one becomes when it is drawn,
 * and the edits on one: adding a lane to a pool, and releasing a container's
 * members.
 */
import { createInsertOp, type AddNodeSpec, type NodeId, type Op, type RectPose, type Scene } from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import { DEFAULT_FONT } from '../edgeLabel';
import { icon } from '../icons.gen';
import { NODE, type DiagramSceneData, type NodeStyle } from '../fromData';
import { diagramThemeOf } from '../theme/resolve';
import { themeWrites, type ThemedScene } from '../theme/themeWrites';
import { DIAGRAM_THEME_KEY } from '../theme/types';
import { CONTAINER_LAYOUTS, containerShape } from './layouts';
import { MIN_LANE_SIZE } from './laneStack';
import { titlePose } from './titlePose';
import { diagramContainerOf, titleIdOf, type ContainerRole, type DiagramContainer } from './trait';

/** One container a palette offers. A pool stacks its lanes along `axis`. */
export interface ContainerStencil {
  id: string;
  label: string;
  role: 'container' | 'pool';
  axis?: 'x' | 'y';
  size: { width: number; height: number };
  /** The glyph a palette draws on its button. */
  icon?: IconRef;
}

/** A titled box, and pools of rows and of columns. */
export const CONTAINER_STENCILS: readonly ContainerStencil[] = [
  { id: 'container', label: 'Container', role: 'container', size: { width: 240, height: 160 }, icon: icon('container') },
  { id: 'pool-rows', label: 'Pool (rows)', role: 'pool', axis: 'y', size: { width: 480, height: 240 }, icon: icon('poolRows') },
  { id: 'pool-columns', label: 'Pool (columns)', role: 'pool', axis: 'x', size: { width: 480, height: 300 }, icon: icon('poolColumns') },
];

/** How many lanes a new pool starts with. */
const NEW_POOL_LANES = 2;
/** A lane added to a pool, along its stack. */
const NEW_LANE_SIZE = 120;

type Bounds = { x: number; y: number; width: number; height: number };
type AnyScene = Scene<unknown, string, unknown>;
type Spec<TLayer extends string> = AddNodeSpec<DiagramSceneData, TLayer, RectPose> & { id: NodeId };

/** Options for {@link containerBuild}. */
export interface ContainerBuildOptions<TLayer extends string> {
  layer: TLayer;
  newId: () => string;
  /** The box's fill, stroke and title colors. Default `diagramScene`'s node style. */
  style?: NodeStyle;
  /** The container the new one goes in. Default the top level. */
  parent?: string | null;
  /** A pool's header colors and its lanes' bodies in turn. Default `style` for both. */
  laneStyles?: { header: NodeStyle; bodies: readonly NodeStyle[] };
}

function regionData(role: ContainerRole, axis: 'x' | 'y', style: NodeStyle): DiagramSceneData {
  const container: DiagramContainer = { role, header: containerShape(role, axis).header };
  return {
    diagram: { outline: 'rect', container },
    ...(role === 'lane' ? {} : { fill: { paint: { color: style.fill } } }),
    stroke: { paint: { color: style.stroke }, width: role === 'lane' ? 1 : style.strokeWidth ?? 2 },
  };
}

const titleData = (text: string, style: NodeStyle): DiagramSceneData => ({
  text,
  style: { ...DEFAULT_FONT, fontSize: 13, fontWeight: 700, align: 'center' },
  verticalAlign: 'center',
  fill: { paint: { color: style.text } },
});

/** The node specs of one region — a container, a pool, or a lane — and its title. */
function regionSpecs<TLayer extends string>(
  role: ContainerRole, axis: 'x' | 'y', pose: RectPose, title: string,
  opts: ContainerBuildOptions<TLayer> & { id: string },
): Spec<TLayer>[] {
  const style = opts.style ?? NODE;
  const { layout, header } = containerShape(role, axis);
  return [
    {
      id: opts.id as NodeId, kind: 'container', layer: opts.layer, pose, parent: (opts.parent ?? null) as NodeId | null,
      data: regionData(role, axis, style), layout: CONTAINER_LAYOUTS[layout],
    },
    {
      id: titleIdOf(opts.id) as NodeId, kind: 'leaf', layer: opts.layer, parent: opts.id as NodeId, pickable: false,
      pose: titlePose(pose, header), data: titleData(title, style),
    },
  ];
}

/** The lane specs a new pool at `at` starts with. */
function firstLanes<TLayer extends string>(
  poolId: string, axis: 'x' | 'y', at: RectPose, opts: ContainerBuildOptions<TLayer>,
): Spec<TLayer>[] {
  const { header } = containerShape('pool', axis);
  const size = Math.max(MIN_LANE_SIZE, (axis === 'y' ? at.height : at.width) / NEW_POOL_LANES);
  const out: Spec<TLayer>[] = [];
  for (let i = 0; i < NEW_POOL_LANES; i++) {
    const pose: RectPose = axis === 'y'
      ? { x: at.x + header.size, y: at.y + i * size, width: at.width - header.size, height: size }
      : { x: at.x + i * size, y: at.y + header.size, width: size, height: at.height - header.size };
    const bodies = opts.laneStyles?.bodies ?? [];
    const style = bodies.length > 0 ? bodies[i % bodies.length] : opts.style;
    out.push(...regionSpecs('lane', axis, pose, `Lane ${i + 1}`, {
      ...opts, id: opts.newId(), parent: poolId, ...(style ? { style } : {}),
    }));
  }
  return out;
}

/** A zero-size box — a click rather than a drag — becomes the stencil's own size centered on it. */
function placedBounds(stencil: ContainerStencil, b: Bounds): RectPose {
  if (b.width > 0 && b.height > 0) return { ...b };
  const { width, height } = stencil.size;
  return { x: b.x + b.width / 2 - width / 2, y: b.y + b.height / 2 - height / 2, width, height };
}

/** The ops that insert `stencil` at `bounds`: the region and its title, and a
 *  pool's first lanes. Applied as one batch, they are one undo entry. */
export function containerBuild<TLayer extends string>(
  stencil: ContainerStencil,
  bounds: Bounds,
  opts: ContainerBuildOptions<TLayer>,
): { id: string; ops: Op[] } {
  const id = opts.newId();
  const axis = stencil.axis ?? 'y';
  const at = placedBounds(stencil, bounds);
  const title = stencil.role === 'pool' ? 'Pool' : stencil.label;
  const specs = [
    ...regionSpecs(stencil.role, axis, at, title, {
      ...opts, id, ...(stencil.role === 'pool' && opts.laneStyles ? { style: opts.laneStyles.header } : {}),
    }),
    ...(stencil.role === 'pool' ? firstLanes(id, axis, at, opts) : []),
  ];
  const label = `Insert ${stencil.label}`;
  return { id, ops: specs.map((node) => createInsertOp({ node, label })) };
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
  const b = pool.pose as RectPose;
  const at = index === undefined || index >= lanes.length ? null : scene.get(lanes[index]!)!.pose as RectPose;
  const boundary = at !== null ? (axis === 'y' ? at.y : at.x) : axis === 'y' ? b.y + b.height : b.x + b.width;
  // Centered on the boundary it goes in at: the stack orders lanes by where they sit.
  const start = boundary - NEW_LANE_SIZE / 2;
  const offset = trait.header?.size ?? 0;
  const pose: RectPose = axis === 'y'
    ? { x: b.x + offset, y: start, width: b.width - offset, height: NEW_LANE_SIZE }
    : { x: start, y: b.y + offset, width: NEW_LANE_SIZE, height: b.height - offset };
  const id = scene.mintId() as string;
  const specs = regionSpecs('lane', axis, pose, `Lane ${lanes.length + 1}`, {
    id, layer: pool.layer, newId: () => scene.mintId(), parent: poolId, ...(style ? { style } : {}),
  });
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

/**
 * Remove container `id` and keep its members, which take its place in its
 * parent, as one history entry. A pool's members are its lanes' members, and
 * a lane's go past its pool. Connectors on what is removed go with it.
 */
export function releaseMembers(scene: AnyScene, id: string): void {
  const node = scene.get(id as NodeId);
  const trait = node === undefined ? null : diagramContainerOf(node);
  if (node === undefined || trait === null) return;
  const membersOf = (c: NodeId) => scene.childrenOf(c).filter((m) => m !== titleIdOf(c as string));
  const members = trait.role === 'pool' ? membersOf(node.id).flatMap(membersOf) : membersOf(node.id);
  const beside = releasedFrom(scene, node.id);
  const parent = scene.get(beside)!.parent;
  const index = (parent === null ? scene.roots : scene.childrenOf(parent)).indexOf(beside);
  scene.batch('Release members', () => {
    members.forEach((m, k) => scene.move(m, parent, index + k));
    scene.remove(node.id);
  });
}
