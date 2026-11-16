import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { SelectionApi, WorldPoint } from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { Tool } from 'tools/overlayBinding';
import type { SceneCanvasAdapter } from '../sceneAdapter';
import type { SurfaceContribution } from '../surfaceContribution';
import type { FeaturePreset } from './features';
import type { SceneCanvasSelectTool } from './selectToolProps';
import type { SceneCanvasToolOptions } from './toolProps';

/** The canvas's pickers, as a press reads them. */
export interface CanvasPickers {
  /** Every id under `world` a press routed to `viewId`'s view (the surface's, absent) lands on, back to front. */
  pressEvery(world: WorldPoint, viewId?: string | null): string[];
  /** The one id a bare press there settles on, or null. */
  bestIn(world: WorldPoint, viewId?: string | null): string | null;
  /** The nodes a range press from `from` to `to` covers, walking the scene as this canvas paints it. */
  between(from: string, to: string): readonly string[];
  /** `id`'s world box as the chrome draws it, or null. */
  boundsOf(id: string): Bounds | null;
}

/** What a canvas hands a preset's `build`: its scene and adapter, and the rest read live. */
export interface PresetBuildContext {
  readonly scene: Scene<unknown, string, unknown>;
  /** The adapter the canvas's tools and actions drive. */
  readonly adapter: SceneCanvasAdapter<unknown, string, unknown>;
  readonly poseDescriptor: PoseDescriptor<unknown>;
  readonly pick: CanvasPickers;
  /** `<SceneCanvas toolOptions>`, stable while its entries' fields are. */
  readonly toolOptions: SceneCanvasToolOptions;
  /** The canvas's selection. */
  selection(): SelectionApi;
  /** `<SceneCanvas selectTool>`, with `extendClickLocked` set while a path's anchors are edited. */
  selectTool(): SceneCanvasSelectTool<unknown> & { extendClickLocked?: () => boolean };
}

/** What the canvas reads its presets' `build` context from. */
export interface PresetBuildSource {
  scene: unknown;
  adapter: unknown;
  poseDescriptor: unknown;
  picking: {
    pressEvery: CanvasPickers['pressEvery'];
    pickBestIn: CanvasPickers['bestIn'];
    between: CanvasPickers['between'];
    boundsOf: (id: string) => Bounds | null;
  };
  selection: SelectionApi;
  selectTool: unknown;
  toolOptions: SceneCanvasToolOptions | undefined;
}

/** What every enabled preset's `build` makes on this canvas: the tools offered by id, later presets' winning, and
 *  the contributions in preset order. The context is stable while the scene, adapter and tool options are, with
 *  the selection, the pickers and the select tool's options read live. */
export function usePresetBuilds(
  builds: readonly NonNullable<FeaturePreset['build']>[],
  source: PresetBuildSource,
): { tools: Readonly<Record<string, Tool>>; contributions: readonly SurfaceContribution[] } {
  const live = useLatest(source);
  const toolOptions = useStableToolOptions(source.toolOptions);
  const { scene, adapter, poseDescriptor } = source;
  const ctx = useMemo<PresetBuildContext>(() => ({
    scene: scene as PresetBuildContext['scene'],
    adapter: adapter as PresetBuildContext['adapter'],
    poseDescriptor: poseDescriptor as PresetBuildContext['poseDescriptor'],
    toolOptions,
    selection: () => live.current.selection,
    selectTool: () => (live.current.selectTool ?? {}) as ReturnType<PresetBuildContext['selectTool']>,
    pick: {
      pressEvery: (world, viewId) => live.current.picking.pressEvery(world, viewId),
      bestIn: (world, viewId) => live.current.picking.pickBestIn(world, viewId),
      between: (from, to) => live.current.picking.between(from, to),
      boundsOf: (id) => live.current.picking.boundsOf(id),
    },
  }), [scene, adapter, poseDescriptor, toolOptions, live]);
  return useMemo(() => {
    const tools: Record<string, Tool> = {};
    const contributions: SurfaceContribution[] = [];
    for (const build of builds) {
      const out = build(ctx);
      Object.assign(tools, out.tools);
      contributions.push(...(out.contributions ?? []));
    }
    return { tools, contributions };
  }, [builds, ctx]);
}

const serials = new WeakMap<object, number>();
let nextSerial = 0;
/** A key naming `v`: its value when primitive, a serial per identity otherwise. */
function keyOf(v: unknown): string {
  if ((typeof v !== 'object' && typeof v !== 'function') || v === null) return `${typeof v}:${String(v)}`;
  let n = serials.get(v);
  if (n === undefined) serials.set(v, (n = nextSerial++));
  return `#${n}`;
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
