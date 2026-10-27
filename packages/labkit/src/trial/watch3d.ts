import { isDev } from '@weasel-js/react';

type Hook = EventTarget;
type Global = { __THREE_DEVTOOLS__?: Hook; [ctor: string]: unknown };

const byTrial = new Map<string, Set<(how: string) => void>>();

/** How long a renderer's canvas has to join the DOM, for one created by three
 *  and appended after the constructor returns. */
const RETRIES_MS = [0, 50, 250, 1000];

function findTrial(canvas: Element, how: string, attempt = 0): void {
  if (!canvas.isConnected) {
    const wait = RETRIES_MS[attempt + 1];
    if (wait !== undefined) setTimeout(() => findTrial(canvas, how, attempt + 1), wait);
    return;
  }
  const id = canvas.closest('[data-trial-id]')?.getAttribute('data-trial-id');
  if (!id) return;
  for (const found of byTrial.get(id) ?? []) found(how);
}

/** Duck-typed: the canvas may come from another realm than this module, or be an `OffscreenCanvas`. */
const isElement = (el: unknown): el is Element =>
  typeof (el as Element | undefined)?.closest === 'function';

/** Reported later rather than now, so a trial whose watch subscribes in an effect after its instrument's still hears. */
const report = (canvas: Element, how: string): void => {
  setTimeout(() => findTrial(canvas, how), RETRIES_MS[0]);
};

let threeInstalled = false;
/** Canvases three.js announced, which its renderer's own depth testing then says nothing more of. */
const threeCanvases = new WeakSet<object>();

/**
 * Listens for three.js renderers, in development. A `WebGLRenderer` announces
 * itself on `__THREE_DEVTOOLS__` when the page defines it, which is how the
 * three.js devtools find one; labkit defines it if nothing has, and joins it
 * if something has. Call it before any renderer is constructed — during a
 * trial's render, ahead of its instrument's effects.
 */
function installThreeWatch(): void {
  if (threeInstalled || typeof EventTarget === 'undefined') return;
  threeInstalled = true;
  const g = globalThis as Global;
  g.__THREE_DEVTOOLS__ ??= new EventTarget();
  g.__THREE_DEVTOOLS__.addEventListener('observe', (event) => {
    const el = (event as CustomEvent<{ domElement?: unknown }>).detail?.domElement;
    if (!isElement(el)) return;
    threeCanvases.add(el);
    report(el, 'a three.js renderer');
  });
}

const DEPTH_TEST = 0x0b71;
let depthInstalled = false;
const depthSeen = new WeakSet<object>();

/**
 * Listens for WebGL depth testing turned on, in development: what a
 * hand-written 3D view does and weasel's 2D renderer never does, though both
 * open the same context. Wraps `enable` on the WebGL context prototypes, so it
 * must run before the view's first `enable`, as {@link installThreeWatch} must.
 */
function installDepthWatch(): void {
  if (depthInstalled) return;
  depthInstalled = true;
  const g = globalThis as Global;
  for (const name of ['WebGL2RenderingContext', 'WebGLRenderingContext']) {
    const proto = (g[name] as { prototype?: { enable?: (cap: number) => void } } | undefined)
      ?.prototype;
    const enable = proto?.enable;
    if (!proto || typeof enable !== 'function') continue;
    proto.enable = function (this: { canvas?: unknown }, cap: number) {
      const canvas = this.canvas;
      if (cap === DEPTH_TEST && isElement(canvas) && !depthSeen.has(canvas)) {
        depthSeen.add(canvas);
        // Deferred, as three announces its renderer only once its constructor has turned depth testing on.
        setTimeout(() => {
          if (!threeCanvases.has(canvas)) findTrial(canvas, 'WebGL with depth testing');
        }, RETRIES_MS[0]);
      }
      return enable.call(this, cap);
    };
  }
}

type DepthStencil = {
  format?: string;
  depthCompare?: string;
  depthWriteEnabled?: boolean;
};
type Pipeline = (this: object, descriptor?: { depthStencil?: DepthStencil }) => unknown;

/** A stencil-only format, or a depth test that always passes and writes nothing, is no depth testing. */
const testsDepth = (ds: DepthStencil | undefined): boolean =>
  !!ds?.format?.startsWith('depth') &&
  (ds.depthWriteEnabled === true || (ds.depthCompare ?? 'always') !== 'always');

let gpuInstalled = false;
/** Canvases configured with each device, and the devices that have built a depth-tested pipeline. */
const gpuCanvases = new WeakMap<object, Set<Element>>();
const gpuDepth = new WeakSet<object>();

function gpuFound(canvas: Element): void {
  if (depthSeen.has(canvas)) return;
  depthSeen.add(canvas);
  // Deferred, as three may build a pipeline before it announces its renderer.
  setTimeout(() => {
    if (!threeCanvases.has(canvas)) findTrial(canvas, 'WebGPU with depth testing');
  }, RETRIES_MS[0]);
}

/**
 * The WebGPU counterpart of {@link installDepthWatch}. A pipeline belongs to a
 * device rather than a canvas, so a canvas counts once the device it is
 * configured with builds a render pipeline that tests depth, in either order.
 * Wraps `GPUCanvasContext.configure` and `GPUDevice.createRenderPipeline[Async]`.
 */
function installGpuDepthWatch(): void {
  if (gpuInstalled) return;
  gpuInstalled = true;
  const g = globalThis as Global;
  const ctxProto = (g.GPUCanvasContext as { prototype?: Record<string, unknown> } | undefined)
    ?.prototype;
  const configure = ctxProto?.configure;
  if (ctxProto && typeof configure === 'function') {
    ctxProto.configure = function (this: { canvas?: unknown }, config?: { device?: object }) {
      const { canvas } = this;
      const device = config?.device;
      if (device && isElement(canvas)) {
        const set = gpuCanvases.get(device) ?? new Set();
        gpuCanvases.set(device, set);
        set.add(canvas);
        if (gpuDepth.has(device)) gpuFound(canvas);
      }
      return configure.call(this, config);
    };
  }
  const devProto = (g.GPUDevice as { prototype?: Record<string, unknown> } | undefined)?.prototype;
  if (!devProto) return;
  for (const name of ['createRenderPipeline', 'createRenderPipelineAsync']) {
    const create = devProto[name];
    if (typeof create !== 'function') continue;
    const wrapped: Pipeline = function (this, descriptor) {
      if (testsDepth(descriptor?.depthStencil) && !gpuDepth.has(this)) {
        gpuDepth.add(this);
        for (const canvas of gpuCanvases.get(this) ?? []) gpuFound(canvas);
      }
      return (create as Pipeline).call(this, descriptor);
    };
    devProto[name] = wrapped;
  }
}

/** Starts watching for 3D views drawn by hand — three.js renderers, raw WebGL and raw WebGPU — in
 *  development. */
export function install3dWatch(): void {
  if (!isDev()) return;
  installThreeWatch();
  installDepthWatch();
  installGpuDepthWatch();
}

/** Calls `found` with how, whenever a three.js renderer or a depth-tested WebGL or WebGPU canvas draws
 *  into trial `trialId`'s DOM. */
export function watch3d(trialId: string, found: (how: string) => void): () => void {
  const set = byTrial.get(trialId) ?? new Set();
  byTrial.set(trialId, set);
  set.add(found);
  return () => {
    set.delete(found);
    if (set.size === 0) byTrial.delete(trialId);
  };
}
