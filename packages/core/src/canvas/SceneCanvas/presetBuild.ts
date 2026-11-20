import { identityKeyOf } from '@weasel-js/registry';
import { useMemo, type RefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import type { SelectionApi, WorldPoint } from '@weasel-js/routing';
import { asNodeId, type Scene } from 'core/scene/types';
import { pressTarget } from 'canvas/pressTarget';
import type { EnteredGroupApi } from '../deps/enteredGroup';
import type { InsertNodeFactories } from '../deps/insertFactories';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Tool } from 'tools/overlayBinding';
import type { SceneCanvasAdapter } from '../sceneAdapter';
import type { SurfaceContribution } from '../surfaceContribution';
import { presetOwnToolPools, type EnabledPresets } from './features';
import { mergeByKey } from './presetMerge';
import type { SceneCanvasSelectTool } from './selectToolProps';
import type { SceneCanvasToolOptions } from './toolProps';

/** The canvas's pickers, as a press reads them. */
export interface CanvasPickers {
  /** Every id under `world` a press routed to `viewId`'s view (the surface's, absent) lands on, back to front. */
  everyIn(world: WorldPoint, viewId?: string | null): string[];
  /** The one id a bare press there settles on, or null. */
  bestIn(world: WorldPoint, viewId?: string | null): string | null;
  /** The nodes a range press from `from` to `to` covers, walking the scene as this canvas paints it. */
  between(from: string, to: string): readonly string[];
  /** `id`'s world box as the chrome draws it, or null. */
  boundsOf(id: string): Bounds | null;
  /** Whether `id` takes hits: what a region select may take, as a press may. */
  reachable(id: string): boolean;
  /** The node selecting a hit on `id` selects, inside the entered group, as a click picks. */
  targetOf(id: string): string;
  /** The composed paint alpha, where the canvas fades anything, so a region select passes over what is painted
   *  at zero; absent, everything paints whole. */
  alphaOf(): ((id: string) => number) | undefined;
}

/** What a canvas hands a preset's `build`: `toolOptions`, and everything else read live, so a tool built once
 *  reads the canvas as it is when a gesture runs. */
export interface PresetBuildContext {
  scene(): Scene<unknown, string, unknown>;
  /** The adapter the canvas's tools and actions drive. */
  adapter(): SceneCanvasAdapter<unknown, string, unknown>;
  poseDescriptor(): PoseDescriptor<unknown>;
  readonly pick: CanvasPickers;
  /** `<SceneCanvas toolOptions>`, stable while its entries' fields are. */
  readonly toolOptions: SceneCanvasToolOptions;
  /** The canvas's selection. */
  selection(): SelectionApi;
  /** `<SceneCanvas selectTool>`, with `extendClickLocked` set while a path's anchors are edited. */
  selectTool(): SceneCanvasSelectTool<unknown> & { extendClickLocked?: () => boolean };
  /** Ask for a frame: for a tool whose preview changes between pointer events, as a polygon's side count does. */
  requestRedraw(): void;
  /** The insert factories the canvas builds with: its presets', then its `insertNodeFactories` prop by kind. */
  insertNodeFactories(): InsertNodeFactories | undefined;
}

/** What the canvas reads its presets' `build` context from. */
export interface PresetBuildSource {
  scene: unknown;
  adapter: unknown;
  poseDescriptor: unknown;
  picking: {
    pickEveryIn: CanvasPickers['everyIn'];
    pickBestIn: CanvasPickers['bestIn'];
    between: CanvasPickers['between'];
    boundsOf: (id: string) => Bounds | null;
    reachable: (id: string) => boolean;
    alphaOf: ((id: string) => number) | undefined;
    enteredGroup: EnteredGroupApi;
  };
  selection: SelectionApi;
  insertNodeFactories: InsertNodeFactories | undefined;
  selectTool: unknown;
  toolOptions: SceneCanvasToolOptions | undefined;
  /** The surface's handle, which a redraw is asked of. */
  canvasApiRef: RefObject<{ requestRedraw(): void } | null>;
}

/** What every enabled preset's `build` makes on this canvas: the tools offered by id, a refining preset's winning
 *  an id two offer, and the contributions in preset order. A preset's own tools are weighed with the offered ones,
 *  so `tools` holds the winner of each id either gives. The context is stable while the tool options are. */
export function usePresetBuilds(
  enabled: Pick<EnabledPresets, 'presets' | 'builds' | 'buildOwners' | 'refines'>,
  source: PresetBuildSource,
): { tools: Readonly<Record<string, Tool>>; contributions: readonly SurfaceContribution[]; ctx: PresetBuildContext } {
  const live = useLatest(source);
  const toolOptions = useStableToolOptions(source.toolOptions);
  const ctx = useMemo<PresetBuildContext>(() => ({
    scene: () => live.current.scene as ReturnType<PresetBuildContext['scene']>,
    adapter: () => live.current.adapter as ReturnType<PresetBuildContext['adapter']>,
    poseDescriptor: () => live.current.poseDescriptor as ReturnType<PresetBuildContext['poseDescriptor']>,
    toolOptions,
    selection: () => live.current.selection,
    selectTool: () => (live.current.selectTool ?? {}) as ReturnType<PresetBuildContext['selectTool']>,
    requestRedraw: () => { live.current.canvasApiRef.current?.requestRedraw(); },
    insertNodeFactories: () => live.current.insertNodeFactories,
    pick: {
      everyIn: (world, viewId) => live.current.picking.pickEveryIn(world, viewId),
      bestIn: (world, viewId) => live.current.picking.pickBestIn(world, viewId),
      between: (from, to) => live.current.picking.between(from, to),
      boundsOf: (id) => live.current.picking.boundsOf(id),
      reachable: (id) => live.current.picking.reachable(id),
      alphaOf: () => live.current.picking.alphaOf,
      targetOf: (id) => {
        const { scene, picking } = live.current;
        const sc = scene as Scene<unknown, string, unknown>;
        const tree = { getParent: (n: string) => sc.get(asNodeId(n))?.parent ?? null, getNode: (n: string) => sc.get(asNodeId(n)) };
        return pressTarget(tree, id, picking.enteredGroup.get());
      },
    },
  }), [toolOptions, live]);
  const { presets, builds, buildOwners, refines } = enabled;
  return useMemo(() => {
    const offered: { preset: string; values: Readonly<Record<string, Tool>> | undefined }[] = [];
    const contributions: SurfaceContribution[] = [];
    builds.forEach((build, i) => {
      const out = build(ctx);
      offered.push({ preset: buildOwners[i]!, values: out.tools });
      contributions.push(...(out.contributions ?? []));
    });
    return { tools: mergeByKey([...offered, ...presetOwnToolPools(presets)], refines, 'tool'), contributions, ctx };
  }, [presets, builds, buildOwners, refines, ctx]);
}

/** `options`, kept while every entry's fields are the same values: an inline `toolOptions={{ lasso: { mode } }}`
 *  or `toolOptions={{ insert: { behaviors: [snap] } }}` does not rebuild the tools. An array or plain object is
 *  compared by what it holds, anything else by identity. */
function useStableToolOptions(options: SceneCanvasToolOptions | undefined): SceneCanvasToolOptions {
  const key = contentKeyOf(options ?? {}, new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => options ?? {}, [key]);
}

/** A key equal for two values holding the same things: arrays and plain objects by their contents, anything
 *  else, and a value reached again inside itself, by identity. */
function contentKeyOf(v: unknown, open: Set<object>): string {
  if (typeof v !== 'object' || v === null || open.has(v)) return identityKeyOf(v);
  const proto: unknown = Object.getPrototypeOf(v);
  if (!Array.isArray(v) && proto !== Object.prototype && proto !== null) return identityKeyOf(v);
  open.add(v);
  const key = Array.isArray(v)
    ? `[${v.map((x) => contentKeyOf(x, open)).join(',')}]`
    : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${contentKeyOf((v as Record<string, unknown>)[k], open)}`).join(',')}}`;
  open.delete(v);
  return key;
}
