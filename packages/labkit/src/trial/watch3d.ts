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

/** Starts watching for 3D views drawn by hand — three.js renderers and raw WebGL — in development. */
export function install3dWatch(): void {
  if (!isDev()) return;
  installThreeWatch();
  installDepthWatch();
}

/** Calls `found` with how, whenever a three.js renderer or a depth-tested WebGL canvas draws into trial
 *  `trialId`'s DOM. */
export function watch3d(trialId: string, found: (how: string) => void): () => void {
  const set = byTrial.get(trialId) ?? new Set();
  byTrial.set(trialId, set);
  set.add(found);
  return () => {
    set.delete(found);
    if (set.size === 0) byTrial.delete(trialId);
  };
}
