/**
 * The worker's side of worker rendering: the renderer on the `OffscreenCanvas` the page handed
 * over, and the scene copy it paints. It runs no loop of its own. The page's frame loop, which
 * stops while nothing can see the canvas, sends a frame when one is due, and the worker paints
 * it as the message arrives.
 */
import {
  WeaselRenderer, subscribeGlyphReady, subscribeImageReady, viewToMat3,
  type FlattenTolerance, type ImageMinification, type ShaderProgramHandle,
} from '@weasel-js/renderer';
import type { Node } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { CANVAS_CONTEXT_ATTRIBUTES } from '../contextAttributes';
import { defaultDrawOne, paintBoundsFor } from '../defaultDrawOne';
import type { SceneViewDrawOne } from '../nodeShapeTypes';
import type { PaintBoundsFn } from '../paintCull';
import { buildSceneViewCommands } from '../sceneViewRender';
import type { FrameInputs, FromWorker, ToWorker } from './protocol';
import { createSceneMirror, type SceneMirrorOptions } from './sceneMirror';
import { loadVectorsFromPage } from './workerImages';

type AnyNode = Node<unknown, string, unknown>;

/** How a render worker paints. Everything here is code, so it is the worker module's to give:
 *  a function cannot cross from the page. */
export interface SceneRenderServeOptions {
  /** Paints one node. Default `defaultDrawOne`, which draws every registered node shape — so a
   *  shape the page registers with `registerNodeShape` has to be registered in the worker module
   *  too. */
  drawOne?: SceneViewDrawOne<never, string, never>;
  /** Where `drawOne`'s output for a node can reach, for a page that asks for `cull`. Defaults to
   *  `defaultPaintBounds` when `drawOne` is `defaultDrawOne`. */
  paintBounds?: PaintBoundsFn<never, never>;
  /** What the worker's copy of the scene is built with: the page scene's `registry`, which its
   *  node functions resolve against, and its `composition`, `layoutFrame` and `quantize`. */
  scene?: SceneMirrorOptions;
  /** Custom programs the paint draws with — a handle from `registerProgram`, its source in
   *  GLSL, WGSL or both. */
  shaders?: readonly ShaderProgramHandle[];
  flattenTolerance?: FlattenTolerance;
  imageMinification?: ImageMinification;
  retainBudget?: number;
}

/** The two ends of a worker's message channel the host uses. */
export interface RenderPort {
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<ToWorker>) => void): void;
}

interface Painting {
  renderer: WeaselRenderer;
  canvas: OffscreenCanvas;
  /** `null` until the first frame names one. */
  view: View | null;
  size: { width: number; height: number; dpr: number };
  inputs: Required<Pick<FrameInputs, 'layers' | 'cull'>> & { extraCommands: FrameInputs['extraCommands'] };
}

function openRenderer(
  msg: Extract<ToWorker, { type: 'init' }>, options: SceneRenderServeOptions,
): WeaselRenderer {
  const gl = msg.canvas.getContext('webgl2', CANVAS_CONTEXT_ATTRIBUTES);
  if (!gl) throw new Error('weasel render worker: no WebGL2 context on the canvas');
  const renderer = new WeaselRenderer({
    gl, canvas: msg.canvas, width: msg.width, height: msg.height, dpr: msg.dpr,
    flattenTolerance: options.flattenTolerance,
    imageMinification: options.imageMinification,
    retainBudget: options.retainBudget,
  });
  for (const handle of options.shaders ?? []) renderer.registerProgram(handle);
  return renderer;
}

/** Paint the scene over `port`. {@link serveSceneRender} is this over the worker's own scope. */
export function hostSceneRender(port: RenderPort, options: SceneRenderServeOptions = {}): void {
  const drawOne = (options.drawOne ?? defaultDrawOne) as SceneViewDrawOne<unknown, string, unknown>;
  const paintBounds = (options.paintBounds ?? paintBoundsFor(drawOne)) as PaintBoundsFn<AnyNode, unknown> | undefined;
  const mirror = createSceneMirror(options.scene);
  const dirty = () => port.postMessage({ type: 'dirty' });
  const answerImage = loadVectorsFromPage((src, size) => port.postMessage({ type: 'image', src, size }));
  subscribeImageReady(dirty);
  subscribeGlyphReady(dirty);
  let painting: Painting | null = null;
  const alphas = new Map<string, number>();
  const alphaFor = (id: string): number => alphas.get(id) ?? 1;

  const frame = (msg: Extract<ToWorker, { type: 'frame' }>): void => {
    if (!painting) return;
    if (msg.scene) {
      if (msg.scene.reset) alphas.clear();
      mirror.apply(msg.scene);
    }
    if (msg.overrides) mirror.setOverrides(msg.overrides);
    if (msg.scroll) mirror.setScroll(msg.scroll);
    for (const [id, a] of msg.alpha ?? []) {
      if (a === 1) alphas.delete(id);
      else alphas.set(id, a);
    }
    if (msg.view) painting.view = msg.view;
    if (msg.layers) painting.inputs.layers = msg.layers;
    if (msg.cull !== undefined) painting.inputs.cull = msg.cull;
    if (msg.extraCommands !== undefined) painting.inputs.extraCommands = msg.extraCommands;
    if (msg.size) {
      painting.size = msg.size;
      painting.renderer.resize(msg.size);
    }
    const { scene } = mirror;
    const { renderer, view, size, inputs } = painting;
    if (!scene || !view || renderer.isContextLost()) return;
    // `defaultDrawOne` reads the density it paints at here, as it reads `window`'s on the page.
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio = size.dpr;
    const commands = buildSceneViewCommands(
      scene, view, drawOne, inputs.extraCommands ?? undefined, alphas.size > 0 ? alphaFor : undefined, inputs.layers, undefined,
      inputs.cull ? { ...size, paintBounds } : undefined,
    );
    renderer.render(commands, viewToMat3(view));
  };

  const receive = (msg: ToWorker): void => {
    switch (msg.type) {
      case 'init': {
        const renderer = openRenderer(msg, options);
        const size = { width: msg.width, height: msg.height, dpr: msg.dpr };
        painting = {
          renderer, canvas: msg.canvas, size, view: null,
          inputs: { layers: {}, cull: false, extraCommands: undefined },
        };
        msg.canvas.addEventListener('webglcontextrestored', dirty);
        return;
      }
      case 'frame':
        frame(msg);
        port.postMessage({ type: 'drawn' });
        return;
      case 'snapshot':
        void snapshot(painting?.canvas ?? null).then((bitmap) =>
          port.postMessage({ type: 'snapshot', id: msg.id, bitmap }, bitmap ? [bitmap] : []));
        return;
      case 'image':
        answerImage(msg);
    }
  };

  port.addEventListener('message', (event) => {
    try {
      receive(event.data);
    } catch (e) {
      if (event.data.type === 'frame') port.postMessage({ type: 'drawn' });
      port.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  });
}

async function snapshot(canvas: OffscreenCanvas | null): Promise<ImageBitmap | null> {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  return createImageBitmap(canvas);
}

/**
 * Serve scene rendering from the worker this runs in. A worker module is two lines — import
 * this, call it — plus whatever the page registers that paints: node shapes, fonts, paint kinds,
 * shader programs, and the scene registry. Hand the module to `<SceneViewCanvas worker>`.
 */
export function serveSceneRender(options: SceneRenderServeOptions = {}): void {
  hostSceneRender(globalThis as unknown as RenderPort, options);
}
