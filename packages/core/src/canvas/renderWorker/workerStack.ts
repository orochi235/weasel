/**
 * The canvases of a `<SceneCanvas worker>` stack and how one frame reaches them: each page run
 * drawn through a renderer of its own, each worker run handed its layers and the frame's view.
 */
import { viewToMat3, type DrawCommand, type IdBuffer, type WeaselRenderer } from '@weasel-js/renderer';
import { drawLayers, type LayerCommandCache, type LayerRetainPolicy, type RenderLayer } from '../../core/layers/render';
import type { LayerGroup } from '../../core/layers/layerGroup';
import type { View } from '../../core/viewport/view';
import type { CanvasIdReadOptions } from '../canvasExtension';
import type { CanvasPaintOptions, CanvasRendererLease } from '../canvasRenderer';
import type { LayerRun } from './layerRuns';
import type { AnyRenderWorker } from './liveClients';
import type { SceneRenderInputs } from './startSceneRenderWorker';

/** What a canvas painted partly by a worker is told by its owner: which layers the worker paints,
 *  how to start one, and what the worker's frame reads beside the view and the size. */
export interface CanvasWorkerSurface {
  start: () => Worker;
  /** Whether the worker paints layer `id`. */
  paints(id: string): boolean;
  /** Read once a frame. */
  inputs(): Omit<SceneRenderInputs<unknown, string, unknown>, 'view' | 'width' | 'height' | 'dpr' | 'layerOrder' | 'layerVisibility'>;
}

/** One canvas of the stack as a frame finds it. */
export type StackSurface =
  | { by: 'page'; run: LayerRun; canvas: HTMLCanvasElement | null; lease: CanvasRendererLease | null }
  | { by: 'worker'; run: LayerRun; client: AnyRenderWorker | null };

/** One frame's paint, in the terms `useCanvasPaint` has it. */
export interface StackFrame {
  layers: RenderLayer<unknown>[];
  helpers: unknown;
  visibility: Record<string, boolean>;
  order: string[] | undefined;
  view: View;
  dims: { width: number; height: number; dpr: number };
  cache: LayerCommandCache;
  groups: readonly LayerGroup[] | undefined;
  paints: (id: string) => boolean;
  retain: LayerRetainPolicy | false;
  options: CanvasPaintOptions;
  inputs: ReturnType<CanvasWorkerSurface['inputs']>;
}

/** What each page canvas drew last, for an id read of it. */
export type PageFrames = Map<number, { renderer: WeaselRenderer; commands: DrawCommand[]; view: View }>;

const claims = (name: string, id: string): boolean => id === name || id.startsWith(`${name}:`);
const warnedGroups = new Set<string>();

/** The groups with a member in `ids`. A group naming a layer a worker paints is warned about once:
 *  its effects cannot reach the worker's canvas, so they apply to its page-painted members only. */
export function groupsFor(
  groups: readonly LayerGroup[] | undefined, ids: ReadonlySet<string>, paints: (id: string) => boolean,
): LayerGroup[] | undefined {
  if (!groups) return undefined;
  const out: LayerGroup[] = [];
  for (const g of groups) {
    if (g.layers.some((name) => paints(name) || name === 'scene') && !warnedGroups.has(g.id)) {
      warnedGroups.add(g.id);
      console.warn(`[weasel] layer group "${g.id}" names a layer the render worker paints; ` +
        'its effects reach only the layers the page paints.');
    }
    if ([...ids].some((id) => g.layers.some((name) => claims(name, id)))) out.push(g);
  }
  return out;
}

const onlyIds = (layers: readonly RenderLayer<unknown>[], ids: ReadonlySet<string>) => layers.filter((l) => ids.has(l.id));

/** Draw one page run into `renderer`, and record it in `frames` under `index`. */
export function paintPageRun(
  renderer: WeaselRenderer, run: LayerRun, index: number, frame: StackFrame, frames: PageFrames,
): void {
  const ids = new Set(run.ids);
  const commands = drawLayers(
    onlyIds(frame.layers, ids), frame.helpers, frame.visibility,
    frame.order?.filter((id) => ids.has(id)), frame.view, frame.dims, frame.cache, undefined,
    groupsFor(frame.groups, ids, frame.paints), undefined, frame.retain,
  );
  renderer.render(commands, viewToMat3(frame.view));
  frames.set(index, { renderer, commands, view: frame.view });
}

/** Hand one worker run its frame and ask for it. */
export function paintWorkerRun(client: AnyRenderWorker, run: LayerRun, frame: StackFrame): void {
  const whole = run.ids.length === 1 && run.ids[0] === 'scene';
  const layerVisibility: Record<string, boolean> = {};
  for (const id of run.ids) if (id in frame.visibility) layerVisibility[id] = frame.visibility[id]!;
  client.update({
    ...frame.inputs,
    view: frame.view, width: frame.dims.width, height: frame.dims.height, dpr: frame.dims.dpr,
    layerOrder: whole ? undefined : run.ids, layerVisibility,
  });
  client.sync();
}

/**
 * The ids every canvas of the stack last painted over `rect`, topmost first: a pixel takes the
 * id of the highest canvas that painted one there. Worker canvases answer a round trip later.
 */
export async function readStackIds(
  surfaces: readonly StackSurface[],
  frames: PageFrames,
  rect: { x: number; y: number; width: number; height: number },
  options: CanvasIdReadOptions | undefined,
): Promise<IdBuffer> {
  const reads = surfaces.map((s, i): IdBuffer | Promise<IdBuffer> | null => {
    if (s.by === 'worker') return s.client ? s.client.readIds(rect, options) : null;
    const last = frames.get(i);
    if (!last || last.renderer.isContextLost()) return null;
    return last.renderer.renderIds(last.commands, viewToMat3(last.view), {
      rect, minAlpha: options?.minAlpha, exclude: options?.exclude,
    });
  });
  const buffers = (await Promise.all(reads)).filter((b): b is IdBuffer => b !== null && b.width > 0 && b.height > 0);
  const top = buffers.at(-1);
  if (!top) return { x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) };
  const data = top.data.slice();
  for (let b = buffers.length - 2; b >= 0; b--) {
    const under = buffers[b]!;
    if (under.width !== top.width || under.height !== top.height) continue;
    for (let i = 0; i < data.length; i++) if (data[i] === 0) data[i] = under.data[i]!;
  }
  return { ...top, data };
}

/** Every canvas of the stack composed bottom first, as the page shows it. */
export async function snapshotStack(
  surfaces: readonly StackSurface[], width: number, height: number,
): Promise<ImageBitmap | null> {
  const layers = await Promise.all(surfaces.map((s) =>
    s.by === 'worker' ? (s.client?.snapshot() ?? Promise.resolve(null)) : Promise.resolve(s.canvas)));
  const sized = layers.find((l) => l !== null && l.width > 0);
  if (!sized) return null;
  const out = new OffscreenCanvas(sized.width || width, sized.height || height);
  const c = out.getContext('2d');
  if (!c) return null;
  for (const l of layers) if (l && l.width > 0) c.drawImage(l, 0, 0, out.width, out.height);
  return out.transferToImageBitmap();
}
