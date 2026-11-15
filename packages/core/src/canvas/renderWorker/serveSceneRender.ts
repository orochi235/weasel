/**
 * The worker's side of worker rendering: the renderer on the `OffscreenCanvas` the page handed
 * over, and the scene copy it paints. It runs no loop of its own. The page's frame loop, which
 * stops while nothing can see the canvas, sends a frame when one is due, and the worker paints
 * it as the message arrives.
 */
import {
  WeaselRenderer, subscribeGlyphReady, subscribeImageReady, viewToMat3,
  type DrawCommand, type FlattenTolerance, type IdBuffer, type ImageMinification, type ShaderProgramHandle,
} from '@weasel-js/renderer';
import type { Node } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { CANVAS_CONTEXT_ATTRIBUTES } from '../contextAttributes';
import { defaultDrawOne, paintBoundsFor } from '../defaultDrawOne';
import { subscribeNodeShapes } from '../NodeShape';
import type { SceneViewDrawOne } from '../nodeShapeTypes';
import type { PaintBoundsFn } from '../paintCull';
import { registerShaders } from '../registerShaders';
import { buildSceneViewCommands } from '../sceneViewRender';
import type { FrameInputs, FromWorker, ToWorker } from './protocol';
import { createSceneMirror, type SceneMirror, type SceneMirrorOptions } from './sceneMirror';
import { createWorkerAnimations, type WorkerAnimation } from './workerAnimations';
import { loadFromPage } from './workerImages';

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
  /** Programs the page can play on the worker's animator by key, through `workerRef`'s
   *  `animator.play(key, params)`. Their color and trim overrides paint as an `animator` does on
   *  the page. */
  animations?: Readonly<Record<string, WorkerAnimation>>;
  flattenTolerance?: FlattenTolerance;
  imageMinification?: ImageMinification;
  retainBudget?: number;
}

/** The two ends of a worker's message channel the host uses: a worker's own scope, or a
 *  `MessagePort`. What crosses it is the page's and the host's private business. */
export interface RenderPort {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

interface Painting {
  renderer: WeaselRenderer;
  canvas: OffscreenCanvas;
  /** `null` until the first frame names one. */
  view: View | null;
  /** What the last frame drew, for an id read of it. */
  last: { commands: DrawCommand[]; view: View } | null;
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
  registerShaders(renderer, options.shaders);
  return renderer;
}

/** What the worker paints with, from the canvas the page handed it: `null`, said to the page as
 *  fatal, when it cannot open a context on it. */
function openPainting(
  msg: Extract<ToWorker, { type: 'init' }>, options: SceneRenderServeOptions,
  post: (msg: FromWorker) => void, dirty: () => void,
): Painting | null {
  let renderer: WeaselRenderer;
  try {
    renderer = openRenderer(msg, options);
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e), fatal: true });
    return null;
  }
  msg.canvas.addEventListener('webglcontextrestored', dirty);
  post({ type: 'ready' });
  return {
    renderer, canvas: msg.canvas, size: { width: msg.width, height: msg.height, dpr: msg.dpr }, view: null, last: null,
    inputs: { layers: {}, cull: false, extraCommands: undefined },
  };
}

/** Paint the scene over `port`. {@link serveSceneRender} is this over the worker's own scope. */
export function hostSceneRender(port: RenderPort, options: SceneRenderServeOptions = {}): void {
  const drawOne = (options.drawOne ?? defaultDrawOne) as SceneViewDrawOne<unknown, string, unknown>;
  const paintBounds = (options.paintBounds ?? paintBoundsFor(drawOne)) as PaintBoundsFn<AnyNode, unknown> | undefined;
  const mirror = createSceneMirror(options.scene);
  const post = (msg: FromWorker, transfer?: Transferable[]): void => {
    if (transfer) port.postMessage(msg, transfer);
    else port.postMessage(msg);
  };
  const dirty = () => post({ type: 'dirty' });
  const report = (e: unknown) => post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  const animations = createWorkerAnimations(options.animations ?? {}, dirty);
  const answerImage = loadFromPage(post);
  subscribeImageReady(dirty);
  subscribeGlyphReady(dirty);
  subscribeNodeShapes(dirty);
  let painting: Painting | null = null;
  const alphas = new Map<string, number>();
  const alphaFor = (id: string): number => alphas.get(id) ?? 1;
  /** Whether the last paint that threw has had its retry. */
  let retried = false;

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
    animations.at(msg.at, msg.resumed === true);
    const failed = scene && msg.animations ? animations.run(msg.animations, scene) : [];
    animations.advance();
    try {
      paint(scene);
      retried = false;
    } catch (e) {
      // As the page's frame loop does: the page sends a frame only when something changes, so a
      // failed paint would otherwise stand until then. One retry, so a paint that always throws doesn't spin.
      if (!retried) { retried = true; dirty(); }
      throw e;
    } finally {
      for (const e of failed) report(e);
    }
  };

  const paint = (scene: SceneMirror['scene']): void => {
    if (!painting) return;
    const { renderer, view, size, inputs } = painting;
    if (!scene || !view || renderer.isContextLost()) return;
    // `defaultDrawOne` reads the density it paints at here, as it reads `window`'s on the page.
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio = size.dpr;
    const commands = buildSceneViewCommands(
      scene, view, drawOne, inputs.extraCommands ?? undefined, alphas.size > 0 ? alphaFor : undefined, inputs.layers, animations.animator,
      inputs.cull ? { ...size, paintBounds } : undefined, size.dpr,
    );
    renderer.render(commands, viewToMat3(view));
    painting.last = { commands, view };
  };

  const receive = (msg: ToWorker): void => {
    switch (msg.type) {
      case 'init':
        painting = openPainting(msg, options, post, dirty);
        return;
      case 'frame':
        frame(msg);
        post({ type: 'drawn', id: msg.id });
        return;
      case 'ping':
        post({ type: 'pong', id: msg.id });
        return;
      case 'snapshot':
        void snapshot(painting?.canvas ?? null).then((bitmap) =>
          post({ type: 'snapshot', id: msg.id, bitmap }, bitmap ? [bitmap] : []));
        return;
      case 'image':
        answerImage(msg);
        return;
      case 'readIds': {
        const ids = readIds(painting, msg);
        post({ type: 'ids', id: msg.id, ids }, ids ? [ids.data.buffer] : []);
      }
    }
  };

  port.addEventListener('message', (event) => {
    const msg = event.data as ToWorker;
    try {
      receive(msg);
    } catch (e) {
      // The page waits on these answers.
      if (msg.type === 'frame') post({ type: 'drawn', id: msg.id });
      else if (msg.type === 'readIds') post({ type: 'ids', id: msg.id, ids: null });
      report(e);
    }
  });
}

function readIds(painting: Painting | null, msg: Extract<ToWorker, { type: 'readIds' }>): IdBuffer | null {
  const last = painting?.last;
  if (!painting || !last || painting.renderer.isContextLost()) return null;
  return painting.renderer.renderIds(last.commands, viewToMat3(last.view), {
    rect: msg.rect, minAlpha: msg.minAlpha, ...(msg.exclude ? { exclude: new Set(msg.exclude) } : {}),
  });
}

/** What `canvas` shows, or `null` when it shows nothing or cannot be read: the page waits on it. */
async function snapshot(canvas: OffscreenCanvas | null): Promise<ImageBitmap | null> {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  return createImageBitmap(canvas).catch(() => null);
}

/**
 * Serve scene rendering from the worker this runs in. A worker module is two lines — import
 * this, call it — plus whatever the page registers that paints: node shapes, fonts, paint kinds,
 * shader programs, and the scene registry. Hand the module to `<SceneViewCanvas worker>`.
 */
export function serveSceneRender(options: SceneRenderServeOptions = {}): void {
  hostSceneRender(globalThis as unknown as RenderPort, options);
}
