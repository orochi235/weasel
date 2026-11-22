/**
 * What makes a plot's editable marks grabbable: a hit-only point region at
 * each handle its kind's editor names, composed into a layer whose id is the
 * kind a press reports.
 */
import {
  composeAffordanceLayer,
  worldPoses,
  type Affordance,
  type AffordanceRegion,
  type RectPose,
  type RenderLayer,
  type AnyScene,
} from '@weasel-js/core';
import { boundsOfCoords } from '@weasel-js/geom';
import type { PlotBox, PlotPoint } from '../marks/types';
import { plotMarkOf, plotRootOf, plotRootsIn } from '../plotScene';
import { handlesOf, plotEditorOf, type PlotHandle } from './editors';

/** The layer id the handles are composed into. */
export const PLOT_HANDLE_LAYER_ID = 'plot-handles';

/** The affordance kind a press on a handle reports. */
export const PLOT_HANDLE_AFFORDANCE_KIND = `layer:${PLOT_HANDLE_LAYER_ID}` as const;

/** What a press on a handle hands the drag, as the hit's `payload`. */
export interface PlotHandleScratch {
  rootId: string;
  markId: string;
  /** The handle, in world coordinates. */
  at: PlotPoint;
  /** Which of the mark's handles, for a mark with more than one. */
  part?: string;
}

/** A press's scratch, read back off the hit an action was handed. */
export function plotHandleScratchOf(hit: { payload?: unknown } | null | undefined): PlotHandleScratch | null {
  const p = hit?.payload as PlotHandleScratch | undefined;
  return p !== undefined && typeof p.rootId === 'string' && typeof p.markId === 'string' ? p : null;
}

/** Where the plot root `rootId`'s corner stands in world coordinates. */
export function plotOrigin(scene: AnyScene, rootId: string): PlotPoint {
  const pose = worldPoses(scene, 'document')(rootId as never) as RectPose;
  return { x: pose.x, y: pose.y };
}

/** Where a plot's own coordinates stand in the world a press arrives in, each way. A host whose plot lies elsewhere (a 3D
 *  host with a chart on a plane) casts its pointer onto that plane in `toPlot` and projects back in `fromPlot`. Either
 *  left out is today's translation by the root's corner. */
export interface PlotFrame {
  /** From the world to the plot `rootId`'s coordinates. */
  toPlot?: (world: PlotPoint, rootId: string) => PlotPoint;
  /** From the plot `rootId`'s coordinates to the world. */
  fromPlot?: (plot: PlotPoint, rootId: string) => PlotPoint;
}

/** `frame` with each hook it leaves out filled with the translation by the root's corner in `scene`. */
export function createPlotFrame(scene: AnyScene, frame: PlotFrame = {}): Required<PlotFrame> {
  return {
    toPlot: frame.toPlot ?? ((w, rootId) => {
      const o = plotOrigin(scene, rootId);
      return { x: w.x - o.x, y: w.y - o.y };
    }),
    fromPlot: frame.fromPlot ?? ((p, rootId) => {
      const o = plotOrigin(scene, rootId);
      return { x: o.x + p.x, y: o.y + p.y };
    }),
  };
}

/** The world box holding `box`'s corners once `fromPlot` has carried them out of the plot. */
function worldBox(box: PlotBox, fromPlot: (p: PlotPoint) => PlotPoint): PlotBox {
  const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
    .flatMap(([x, y]) => { const p = fromPlot({ x: x!, y: y! }); return [p.x, p.y]; });
  const [x0, y0, x1, y1] = boundsOfCoords(corners) ?? [NaN, NaN, NaN, NaN];
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Every handle in `scene` an edit may take, in world coordinates as `frame` places them, in render order. */
export function* plotHandles(scene: AnyScene, frame: PlotFrame = {}): Iterable<PlotHandleScratch & PlotHandle> {
  const { fromPlot } = createPlotFrame(scene, frame);
  for (const rootId of plotRootsIn(scene)) {
    const root = scene.get(rootId);
    const trait = plotRootOf(root);
    const editor = trait && plotEditorOf(trait.data);
    if (trait === null || editor === null || scene.isLocked(rootId) || scene.isHidden(rootId)) continue;
    const out = (p: PlotPoint) => fromPlot(p, rootId);
    for (const id of scene.childrenOf(rootId)) {
      const node = scene.get(id);
      const mark = plotMarkOf(node);
      if (node === undefined || mark === null) continue;
      for (const handle of handlesOf(editor.handle(trait.data, { trait: mark, pose: node.pose as RectPose }))) {
        const { box, part } = handle;
        yield {
          rootId, markId: id, cursor: handle.cursor, at: out(handle.at),
          ...(part !== undefined ? { part } : {}),
          ...(box !== undefined ? { box: worldBox(box, out) } : {}),
        };
      }
    }
  }
}

const HIT_RADIUS_PX = 6;

function handleAffordance(scene: AnyScene, frame: PlotFrame): Affordance {
  // Boxes first, so a point handle inside one wins a press at an equal distance.
  const regions = (): AffordanceRegion[] => [...plotHandles(scene, frame)]
    .sort((a, b) => Number(b.box !== undefined) - Number(a.box !== undefined))
    .map(({ rootId, markId, at, cursor, part, box }) => ({
      id: part === undefined ? markId : `${markId}#${part}`,
      targetId: null,
      shape: box !== undefined ? { kind: 'rect', ...box } : { kind: 'point', x: at.x, y: at.y, hitRadiusPx: HIT_RADIUS_PX },
      cursor,
      strength: 'exclusive',
      claimedKinds: ['pointer'],
      bind: () => ({ initialScratch: { rootId, markId, at, ...(part !== undefined ? { part } : {}) } satisfies PlotHandleScratch }),
    }));
  return { id: PLOT_HANDLE_LAYER_ID, regions, regionsAt: regions };
}

/** The handle layer, for a contribution's `layers` (as `createPlotEditingContribution` carries it) or `registerLayer`,
 *  its handles placed by `frame`. */
export function createPlotHandleLayer(scene: AnyScene, frame: PlotFrame = {}): RenderLayer<unknown> {
  return composeAffordanceLayer(PLOT_HANDLE_LAYER_ID, 'Plot handles', [handleAffordance(scene, frame)]) as unknown as RenderLayer<unknown>;
}
