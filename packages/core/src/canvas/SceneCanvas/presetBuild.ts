import { createPart } from '@weasel-js/registry';
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
import type { EnabledPresets } from './features';
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
 *  an id two offer, and the contributions in preset order. The context is stable while the tool options are. */
export function usePresetBuilds(
  enabled: Pick<EnabledPresets, 'builds' | 'buildOwners' | 'refines'>,
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
  const { builds, buildOwners, refines } = enabled;
  return useMemo(() => {
    const offered: { preset: string; values: Readonly<Record<string, Tool>> | undefined }[] = [];
    const contributions: SurfaceContribution[] = [];
    builds.forEach((build, i) => {
      const out = build(ctx);
      offered.push({ preset: buildOwners[i]!, values: out.tools });
      contributions.push(...(out.contributions ?? []));
    });
    return { tools: mergeByKey(offered, refines, 'tool'), contributions, ctx };
  }, [builds, buildOwners, refines, ctx]);
}

let nextSerial = 0;
const serials = createPart((_v: object) => nextSerial++);
/** A key naming `v`: its value when primitive, a serial per identity otherwise. */
function keyOf(v: unknown): string {
  if ((typeof v !== 'object' && typeof v !== 'function') || v === null) return `${typeof v}:${String(v)}`;
  return `#${serials(v)}`;
}

/** `options`, kept while every entry's fields are the same values: an inline `toolOptions={{ lasso: { mode } }}`
 *  does not rebuild the tools. */
function useStableToolOptions(options: SceneCanvasToolOptions | undefined): SceneCanvasToolOptions {
  const parts: string[] = [];
  for (const [tool, entry] of Object.entries(options ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
    parts.push(tool);
    if (entry && typeof entry === 'object') {
      for (const [k, v] of Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : 1))) parts.push(k, keyOf(v));
    } else parts.push(keyOf(entry));
  }
  const key = parts.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => options ?? {}, [key]);
}
