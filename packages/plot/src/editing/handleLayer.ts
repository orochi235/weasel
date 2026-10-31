/**
 * What makes a plot's editable marks grabbable: a hit-only point region at
 * each handle its kind's editor names, composed into a layer whose id is the
 * kind a press reports.
 */
import {
  composeAffordanceLayer, composeWorldPose, scenePoseAdapter,
  type Affordance, type AffordanceRegion, type RectPose, type RenderLayer, type Scene,
} from '@weasel-js/core';
import type { PlotPoint } from '../marks/types';
import { plotMarkOf, plotRootOf, plotRootsIn } from '../plotScene';
import { plotEditorOf, type PlotHandle } from './editors';

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
}

/** A press's scratch, read back off the hit an action was handed. */
export function plotHandleScratchOf(hit: { payload?: unknown } | null | undefined): PlotHandleScratch | null {
  const p = hit?.payload as PlotHandleScratch | undefined;
  return p !== undefined && typeof p.rootId === 'string' && typeof p.markId === 'string' ? p : null;
}

type AnyScene = Scene<unknown, string, unknown>;

/** Where the plot root `rootId`'s corner stands in world coordinates. */
export function plotOrigin(scene: AnyScene, rootId: string): PlotPoint {
  const pose = composeWorldPose(scenePoseAdapter(scene as never), rootId, scene.composition.compose as never) as RectPose;
  return { x: pose.x, y: pose.y };
}

/** Every handle in `scene` an edit may take, in world coordinates, in render order. */
export function* plotHandles(scene: AnyScene): Iterable<PlotHandleScratch & PlotHandle> {
  for (const rootId of plotRootsIn(scene)) {
    const root = scene.get(rootId);
    const trait = plotRootOf(root);
    const editor = trait && plotEditorOf(trait.data);
    if (trait === null || editor === null || scene.isLocked(rootId) || scene.isHidden(rootId)) continue;
    const origin = plotOrigin(scene, rootId);
    for (const id of scene.childrenOf(rootId)) {
      const node = scene.get(id);
      const mark = plotMarkOf(node);
      if (node === undefined || mark === null) continue;
      const handle = editor.handle(trait.data, { trait: mark, pose: node.pose as RectPose });
      if (handle === null) continue;
      yield { rootId, markId: id, cursor: handle.cursor, at: { x: origin.x + handle.at.x, y: origin.y + handle.at.y } };
    }
  }
}

const HIT_RADIUS_PX = 6;

function handleAffordance(scene: AnyScene): Affordance {
  const regions = (): AffordanceRegion[] => [...plotHandles(scene)].map(({ rootId, markId, at, cursor }) => ({
    id: markId,
    targetId: null,
    shape: { kind: 'point', x: at.x, y: at.y, hitRadiusPx: HIT_RADIUS_PX },
    cursor,
    strength: 'exclusive',
    claimedKinds: ['pointer'],
    bind: () => ({ initialScratch: { rootId, markId, at } satisfies PlotHandleScratch }),
  }));
  return { id: PLOT_HANDLE_LAYER_ID, regions, regionsAt: regions };
}

/** The handle layer, for `CanvasExtensionApi.registerLayer`. */
export function plotHandleLayer(scene: Scene<unknown, string, unknown>): RenderLayer<unknown> {
  return composeAffordanceLayer(PLOT_HANDLE_LAYER_ID, 'Plot handles', [handleAffordance(scene)]) as unknown as RenderLayer<unknown>;
}
