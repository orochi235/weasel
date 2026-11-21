/**
 * The lane affordances on every pool: the boundary after each lane, which a
 * drag moves to resize that lane, and the add-lane button past the end of the
 * stack. Built the way the edge-end handles are: regions with a `null`
 * `targetId`, composed into a layer whose id is the kind a press reports.
 */
import { worldWith } from '../worldWith';
import {
  composeAffordanceLayer,
  ellipsePath,
  paintsLayer,
  PathBuilder,
  polylineFromPoints,
  rotatedRectCorners,
  viewToTransform,
  type Affordance,
  type AffordanceRegion,
  type ChromeState,
  type CommandFill,
  type CommandStroke,
  type NodeId,
  type RectPose,
  type RenderLayer,
  type AnyScene,
} from '@weasel-js/core';
import { lanesOf, poolAxisOf } from './containerStencils';
import { diagramContainerOf, titleIdOf } from './trait';
import { payloadOf } from '../payload';

/** The layer id the lane affordances are composed into. */
export const LANE_LAYER_ID = 'diagram-lanes';
/** The affordance kind a press on a lane affordance reports. */
export const LANE_AFFORDANCE_KIND = `layer:${LANE_LAYER_ID}` as const;

/** What a press on a lane affordance hands the action: the boundary after
 *  `laneId`, or, with no lane, the add-lane button. */
export interface LaneScratch {
  targetId: string;
  poolId: string;
  laneId?: string;
}

/** Read a lane press's scratch back off the hit an action was handed. */
export function laneScratchOf(hit: unknown): LaneScratch | null {
  const payload = payloadOf(hit) as LaneScratch | undefined;
  return payload !== undefined && typeof payload.poolId === 'string' ? payload : null;
}

/** A pool as the affordances see it: its box, the axis it stacks along, and its lanes in order.
 *  `pose` is as stored, `at` where it draws. */
export interface PoolLanes {
  id: string;
  axis: 'x' | 'y';
  pose: RectPose;
  at: RectPose;
  lanes: { id: string; pose: RectPose; at: RectPose }[];
}

/** Pool `id` as the affordances see it, whether or not it is drawn or locked; null for no pool. */
export function poolLanesOf(scene: AnyScene, id: string, world = worldWith(scene)): PoolLanes | null {
  const node = scene.get(id as NodeId);
  const trait = node === undefined ? null : diagramContainerOf(node);
  if (node === undefined || trait?.role !== 'pool') return null;
  return {
    id: node.id,
    axis: poolAxisOf(trait),
    pose: node.pose as RectPose,
    at: world(node.id) as RectPose,
    lanes: lanesOf(scene, node.id).map((l) => ({ id: l, pose: scene.get(l)!.pose as RectPose, at: world(l) as RectPose })),
  };
}

/** Every pool in `scene` that is drawn and not locked. */
export function poolsOf(scene: AnyScene): PoolLanes[] {
  const out: PoolLanes[] = [];
  const world = worldWith(scene);
  for (const node of scene.renderOrderNodes()) {
    if (scene.isHidden(node.id) || scene.isLocked(node.id)) continue;
    const pool = poolLanesOf(scene, node.id, world);
    if (pool !== null) out.push(pool);
  }
  return out;
}

/** Whether resizing the lane at `index` of `pool` would write a locked node: the lane, the lanes after it, or the
 *  lane's or the pool's title. The boundary is offered, and the resize runs, only where this is false. */
export function laneResizeLocked(scene: AnyScene, pool: PoolLanes, index: number): boolean {
  const writes = [titleIdOf(pool.id), titleIdOf(pool.lanes[index]!.id), ...pool.lanes.slice(index).map((l) => l.id)];
  return writes.some((id) => scene.isLocked(id as NodeId));
}

/** Whether adding a lane at the end of `pool` would write a locked node: the pool's title, which grows with it. The
 *  add-lane button is offered, and the add runs, only where this is false. */
export function addLaneLocked(scene: AnyScene, pool: Pick<PoolLanes, 'id'>): boolean {
  return [pool.id, titleIdOf(pool.id)].some((id) => scene.isLocked(id as NodeId));
}

/** Options for {@link createLaneLayer}. */
export interface LaneLayerOptions {
  /** Screen-pixel reach of a boundary either side of it. Default 4. */
  hitRadiusPx?: number;
  /** Screen-pixel diameter of the add-lane button. Default 14; 0 hides it. */
  addSizePx?: number;
  fill?: CommandFill;
  stroke?: CommandStroke;
}

const DEFAULT_FILL: CommandFill = { paint: { kind: 'solid', color: '#ffffff' } };
const DEFAULT_STROKE: CommandStroke = { paint: { kind: 'solid', color: '#3b6fd4' }, width: 1.5 };
/** How far past the end of the stack the add-lane button sits, in screen pixels. */
const ADD_STANDOFF_PX = 14;

type Point = { x: number; y: number };

/** A region's two edges across a stack along `axis`, as `at` draws them — turned and transformed with it: where
 *  the stack enters it and where it leaves, each as its two ends. */
export function stackEdges(axis: 'x' | 'y', at: RectPose): { start: [Point, Point]; end: [Point, Point] } {
  const [tl, tr, br, bl] = rotatedRectCorners({ ...at, rotation: at.rotation ?? 0 }) as [Point, Point, Point, Point];
  return axis === 'y' ? { start: [tl, tr], end: [bl, br] } : { start: [tl, bl], end: [tr, br] };
}

const midOf = ([a, b]: [Point, Point]): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** The way a region at `at` stacks along `axis` where it is drawn: the unit direction, and how far it runs. */
export function stackDirection(axis: 'x' | 'y', at: RectPose): { dir: Point; length: number } {
  const { start, end } = stackEdges(axis, at);
  const a = midOf(start), b = midOf(end);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return { dir: length === 0 ? { x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0 } : { x: (b.x - a.x) / length, y: (b.y - a.y) / length }, length };
}

/** The far edge of a lane: the boundary between it and the next. */
function boundaryOf(axis: 'x' | 'y', lane: RectPose) {
  const [a, b] = stackEdges(axis, lane).end;
  return new PathBuilder().moveTo(a.x, a.y).lineTo(b.x, b.y).build();
}

/** The add-lane button: a ring with a plus, drawn in screen pixels. */
function addPaint(sizePx: number, fill: CommandFill, stroke: CommandStroke): AffordanceRegion['paint'] {
  return {
    kind: 'custom',
    draw: ({ world, view }) => {
      const t = viewToTransform(view);
      const cx = t.panX + world.x * t.zoom.x;
      const cy = t.panY + world.y * t.zoom.y;
      const r = sizePx / 2;
      const arm = r * 0.55;
      return [
        { kind: 'path', path: ellipsePath({ x: cx - r, y: cy - r, width: sizePx, height: sizePx }), fill, stroke },
        { kind: 'path', path: polylineFromPoints([{ x: cx - arm, y: cy }, { x: cx + arm, y: cy }]), stroke },
        { kind: 'path', path: polylineFromPoints([{ x: cx, y: cy - arm }, { x: cx, y: cy + arm }]), stroke },
      ];
    },
  };
}

/** The affordance: a boundary region after each lane of each pool, and an add-lane button per pool. */
export function createLaneAffordance(scene: AnyScene, opts: LaneLayerOptions = {}): Affordance {
  const { hitRadiusPx = 4, addSizePx = 14 } = opts;
  const fill = opts.fill ?? DEFAULT_FILL;
  const stroke = opts.stroke ?? DEFAULT_STROKE;
  return {
    id: LANE_LAYER_ID,
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const out: AffordanceRegion[] = [];
      for (const pool of poolsOf(scene)) {
        if (!paintsLayer(state, scene.get(pool.id as NodeId)!.layer)) continue;
        const cursor = pool.axis === 'y' ? 'row-resize' : 'col-resize';
        for (const [index, lane] of pool.lanes.entries()) {
          if (laneResizeLocked(scene, pool, index)) continue;
          out.push({
            id: `${lane.id}:boundary`,
            targetId: null,
            shape: { kind: 'outline', path: boundaryOf(pool.axis, lane.at), hitRadiusPx },
            cursor,
            strength: 'exclusive',
            claimedKinds: ['pointer'],
            bind: () => ({ initialScratch: { targetId: pool.id, poolId: pool.id, laneId: lane.id } satisfies LaneScratch }),
          });
        }
        if (addSizePx <= 0 || addLaneLocked(scene, pool)) continue;
        const { dir } = stackDirection(pool.axis, pool.at);
        const end = { ...midOf(stackEdges(pool.axis, pool.at).end), normal: dir };
        out.push({
          id: `${pool.id}:add-lane`,
          targetId: null,
          shape: { kind: 'point', x: end.x, y: end.y, hitRadiusPx: addSizePx / 2 + 2, standoff: { px: ADD_STANDOFF_PX, normal: end.normal } },
          paint: addPaint(addSizePx, fill, stroke),
          cursor: 'pointer',
          strength: 'exclusive',
          claimedKinds: ['pointer'],
          bind: () => ({ initialScratch: { targetId: pool.id, poolId: pool.id } satisfies LaneScratch }),
        });
      }
      return out;
    },
  };
}

/** The composed layer, for `CanvasExtensionApi.registerLayer`. */
export function createLaneLayer(scene: AnyScene, opts: LaneLayerOptions = {}): RenderLayer<unknown> {
  return composeAffordanceLayer(LANE_LAYER_ID, 'Diagram lanes', [createLaneAffordance(scene, opts)]) as unknown as RenderLayer<unknown>;
}
