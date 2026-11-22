import { isDev } from '@weasel-js/react';
import { after, createKeyedEmitter } from '@weasel-js/registry';

type Hook = EventTarget;
type Global = { __THREE_DEVTOOLS__?: Hook; [ctor: string]: unknown };

const byTrial = createKeyedEmitter<string, [how: string]>();

/** How long a renderer's canvas has to join the DOM, for one created by three
 *  and appended after the constructor returns. */
const RETRIES_MS = [0, 50, 250, 1000];

/** Reports `canvas` to its trial, waiting for it to join the DOM; `done` hears whether it found one. */
function findTrial(
  canvas: Element,
  how: string,
  attempt = 0,
  done?: (found: boolean) => void,
): void {
  if (!canvas.isConnected) {
    const wait = RETRIES_MS[attempt + 1];
    if (wait !== undefined) after(wait, () => findTrial(canvas, how, attempt + 1, done));
    else done?.(false);
    return;
  }
  const id = canvas.closest('[data-trial-id]')?.getAttribute('data-trial-id');
  if (id) byTrial.emit(id, how);
  done?.(!!id);
}

/** Duck-typed: the canvas may come from another realm than this module, or be an `OffscreenCanvas`. */
const isElement = (el: unknown): el is Element =>
  typeof (el as Element | undefined)?.closest === 'function';

/** Reported later rather than now, so a trial whose watch subscribes in an effect after its instrument's still hears. */
const report = (canvas: Element, how: string): void => {
  after(0, () => findTrial(canvas, how));
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
/** Depth-tested canvases already reported to a trial, or announced by three, and those being looked for. */
const depthSeen = new WeakSet<object>();
const depthPending = new WeakSet<object>();

/** Reports a depth-tested canvas to its trial once; a search that finds none leaves the next call to try again. */
function depthFound(canvas: Element, how: string): void {
  if (depthSeen.has(canvas) || depthPending.has(canvas)) return;
  depthPending.add(canvas);
  // Deferred, as three announces its renderer only after turning depth testing on or building a pipeline.
  after(0, () => {
    const settle = (found: boolean): void => {
      depthPending.delete(canvas);
      if (found) depthSeen.add(canvas);
    };
    if (threeCanvases.has(canvas)) settle(true);
    else findTrial(canvas, how, 0, settle);
  });
}

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
  for (const name of ['WebGL2RenderingContext', 'WebGLRenderingContext'] as const) {
    const proto = (g[name] as { prototype?: { enable?: (cap: number) => void } } | undefined)
      ?.prototype;
    const enable = proto?.enable;
    if (!proto || typeof enable !== 'function') continue;
    proto.enable = function (this: { canvas?: unknown }, cap: number) {
      const canvas = this.canvas;
      if (cap === DEPTH_TEST && isElement(canvas)) depthFound(canvas, 'WebGL with depth testing');
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
/** Canvases configured with each device before it built a depth-tested pipeline, held weakly so a
 *  long-lived device keeps no closed trial's canvas; and the devices that have built one. */
const gpuCanvases = new WeakMap<object, Set<WeakRef<Element>>>();
const gpuDepth = new WeakSet<object>();

const gpuFound = (canvas: Element): void => depthFound(canvas, 'WebGPU with depth testing');

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
        if (gpuDepth.has(device)) gpuFound(canvas);
        else {
          const set = gpuCanvases.get(device) ?? new Set();
          gpuCanvases.set(device, set);
          let held = false;
          for (const ref of set) {
            const el = ref.deref();
            if (!el) set.delete(ref);
            else if (el === canvas) held = true;
          }
          if (!held) set.add(new WeakRef(canvas));
        }
      }
      return configure.call(this, config);
    };
  }
  const devProto = (g.GPUDevice as { prototype?: Record<string, unknown> } | undefined)?.prototype;
  if (!devProto) return;
  for (const name of ['createRenderPipeline', 'createRenderPipelineAsync'] as const) {
    const create = devProto[name];
    if (typeof create !== 'function') continue;
    const wrapped: Pipeline = function (this, descriptor) {
      if (testsDepth(descriptor?.depthStencil) && !gpuDepth.has(this)) {
        gpuDepth.add(this);
        for (const ref of gpuCanvases.get(this) ?? []) {
          const canvas = ref.deref();
          if (canvas) gpuFound(canvas);
        }
        gpuCanvases.delete(this);
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
  return byTrial.subscribe(trialId, found);
}
