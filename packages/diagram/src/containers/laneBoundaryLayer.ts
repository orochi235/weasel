/**
 * The lane affordances on every pool: the boundary after each lane, which a
 * drag moves to resize that lane, and the add-lane button past the end of the
 * stack. Built the way the edge-end handles are: regions with a `null`
 * `targetId`, composed into a layer whose id is the kind a press reports.
 */
import {
  composeAffordanceLayer,
  ellipsePath,
  paintsLayer,
  PathBuilder,
  polylineFromPoints,
  viewToTransform,
  type Affordance,
  type AffordanceRegion,
  type ChromeState,
  type CommandFill,
  type CommandStroke,
  type NodeId,
  type RectPose,
  type RenderLayer,
  type Scene,
} from '@weasel-js/core';
import { lanesOf, poolAxisOf } from './containerStencils';
import { diagramContainerOf } from './trait';

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
export function laneScratchOf(hit: { payload?: unknown } | null | undefined): LaneScratch | null {
  const payload = hit?.payload as LaneScratch | undefined;
  return payload !== undefined && typeof payload.poolId === 'string' ? payload : null;
}

type AnyScene = Scene<unknown, string, unknown>;

/** A pool as the affordances see it: its box, the axis it stacks along, and its lanes in order. */
export interface PoolLanes {
  id: string;
  axis: 'x' | 'y';
  pose: RectPose;
  lanes: { id: string; pose: RectPose }[];
}

/** Every pool in `scene` that is drawn and not locked. */
export function poolsOf(scene: AnyScene): PoolLanes[] {
  const out: PoolLanes[] = [];
  for (const node of scene.renderOrderNodes()) {
    const trait = diagramContainerOf(node);
    if (trait?.role !== 'pool' || scene.isHidden(node.id) || scene.isLocked(node.id)) continue;
    out.push({
      id: node.id,
      axis: poolAxisOf(trait),
      pose: node.pose as RectPose,
      lanes: lanesOf(scene, node.id).map((id) => ({ id, pose: scene.get(id)!.pose as RectPose })),
    });
  }
  return out;
}

/** Options for {@link laneLayer}. */
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

/** The far edge of a lane: the boundary between it and the next. */
function boundaryOf(axis: 'x' | 'y', lane: RectPose) {
  const b = new PathBuilder();
  return axis === 'y'
    ? b.moveTo(lane.x, lane.y + lane.height).lineTo(lane.x + lane.width, lane.y + lane.height).build()
    : b.moveTo(lane.x + lane.width, lane.y).lineTo(lane.x + lane.width, lane.y + lane.height).build();
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
        for (const lane of pool.lanes) {
          out.push({
            id: `${lane.id}:boundary`,
            targetId: null,
            shape: { kind: 'outline', path: boundaryOf(pool.axis, lane.pose), hitRadiusPx },
            cursor,
            strength: 'exclusive',
            claimedKinds: ['pointer'],
            bind: () => ({ initialScratch: { targetId: pool.id, poolId: pool.id, laneId: lane.id } satisfies LaneScratch }),
          });
        }
        if (addSizePx <= 0) continue;
        const p = pool.pose;
        const end = pool.axis === 'y'
          ? { x: p.x + p.width / 2, y: p.y + p.height, normal: { x: 0, y: 1 } }
          : { x: p.x + p.width, y: p.y + p.height / 2, normal: { x: 1, y: 0 } };
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
export function laneLayer(scene: AnyScene, opts: LaneLayerOptions = {}): RenderLayer<unknown> {
  return composeAffordanceLayer(LANE_LAYER_ID, 'Diagram lanes', [createLaneAffordance(scene, opts)]) as unknown as RenderLayer<unknown>;
}
